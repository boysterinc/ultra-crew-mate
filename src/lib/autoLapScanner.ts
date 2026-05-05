// Global Bluetooth Manager for AutoLap.
// ---------------------------------------------------------------------------
// Goals:
//  - Singleton service that survives route changes (lives at module scope).
//  - Continuous scan loop (2.5s interval) — only ONE loop ever runs.
//  - Auto start when checkAutoLapAccess() is true, auto stop when false.
//  - Tracks detected devices, last RSSI, last seen timestamp.
//  - Marks a device as "signal lost" only after >30s without detection.
//  - Auto-restart if the underlying scan stops unexpectedly.
//  - Forwards RSSI samples into the existing per-device tracker / state machine
//    pipeline so all previous AutoLap logic keeps working.
// ---------------------------------------------------------------------------
import { create } from "zustand";
import { useEffect } from "react";
import { checkAutoLapAccess } from "@/lib/autoLapAccess";
import { useDeviceMappingStore } from "@/lib/deviceMapping";
import { useAutoLapRegistry } from "@/lib/autoLapMachine";
import {
  createRssiTracker,
  RssiTracker,
  RssiPeakEvent,
  RssiPhase,
} from "@/lib/rssiTracker";

// --- Public constants -------------------------------------------------------
export type ScannerStatus = "idle" | "scanning" | "unsupported" | "error";

export const RSSI_STRONG_THRESHOLD = -65;
export const STAY_DURATION_MS = 5_000;
export const SIGNAL_FRESH_MS = 4_000;

/** Continuous scan loop tick. Web Bluetooth's requestLEScan is itself
 *  continuous, so this loop is mainly used to: prune stale devices, emit
 *  signal-lost events, and verify the underlying scan is still alive. */
export const SCAN_LOOP_INTERVAL_MS = 2_500;
/** Mark a device as "signal lost" after this long with no advertisement. */
export const SIGNAL_LOST_AFTER_MS = 30_000;

// --- Debug log helper -------------------------------------------------------
const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log("[BluetoothManager]", ...args);
};

// --- Detected device record -------------------------------------------------
export interface DetectedDevice {
  name: string;
  lastRssi: number;
  lastSeenAt: number;
  signalLost: boolean;
}

interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  /** Map of deviceName → detected device record. */
  detectedDevices: Record<string, DetectedDevice>;
  /** smoothed RSSI per device name (UI). */
  smoothedRssi: Record<string, number | null>;
  /** last peak event per device name. */
  lastPeak: Record<string, RssiPeakEvent | null>;
  /** RSSI tracker phase per device. */
  phase: Record<string, RssiPhase>;
  /** When the device entered "in" phase (null if "out"). */
  inRangeSince: Record<string, number | null>;
  /** Last time we received any advertisement for the device. */
  lastSeenAt: Record<string, number | null>;

  start: () => Promise<void>;
  stop: () => void;
  /** Inject an RSSI sample (real BLE bridge or test). */
  feedRssiSample: (deviceName: string, rssi: number, now?: number) => void;
}

// --- Module-level singletons (survive component unmounts / navigation) ------
const trackers = new Map<string, RssiTracker>();
let leScan: { stop: () => void; active?: boolean } | null = null;
let advListener: ((e: any) => void) | null = null;
let scanLoopId: ReturnType<typeof setInterval> | null = null;
/** Guards against concurrent start() calls creating duplicate scans. */
let starting = false;
/** Tracks which device names we've already logged "signal lost" for, so the
 *  log doesn't spam every loop tick. */
const signalLostLogged = new Set<string>();

const getMachineForDevice = (deviceName: string) => {
  const mapping = useDeviceMappingStore
    .getState()
    .mappings.find((m) => m.device_name === deviceName);
  if (!mapping) return null;
  return useAutoLapRegistry.getState().getMachine(mapping.athlete_id);
};

const getTracker = (deviceName: string): RssiTracker => {
  let t = trackers.get(deviceName);
  if (t) return t;
  t = createRssiTracker(deviceName, {
    onPhaseChange: (phase, smoothed) => {
      const now = Date.now();
      useAutoLapScanner.setState((s) => ({
        smoothedRssi: { ...s.smoothedRssi, [deviceName]: smoothed },
        phase: { ...s.phase, [deviceName]: phase },
        inRangeSince: {
          ...s.inRangeSince,
          [deviceName]: phase === "in" ? now : null,
        },
      }));
      const machine = getMachineForDevice(deviceName);
      if (machine) {
        if (phase === "in") machine.signalSeen(now);
        else machine.signalLost(now);
      }
    },
    onPeak: (event) => {
      log("peak", deviceName, "rssi=", event.peakRssi.toFixed(1), "at", event.peakAt);
      useAutoLapScanner.setState((s) => ({
        lastPeak: { ...s.lastPeak, [deviceName]: event },
      }));
      const machine = getMachineForDevice(deviceName);
      if (machine) {
        machine.lapTrigger(event.peakAt);
        machine.signalLost(event.exitedAt);
      }
    },
  });
  trackers.set(deviceName, t);
  return t;
};

const teardownLEScan = () => {
  try {
    leScan?.stop();
  } catch {
    /* ignore */
  }
  leScan = null;
  if (advListener && (navigator as any).bluetooth?.removeEventListener) {
    try {
      (navigator as any).bluetooth.removeEventListener(
        "advertisementreceived",
        advListener
      );
    } catch {
      /* ignore */
    }
  }
  advListener = null;
};

const stopScanLoop = () => {
  if (scanLoopId !== null) {
    clearInterval(scanLoopId);
    scanLoopId = null;
  }
};

/** The continuous loop body — runs every SCAN_LOOP_INTERVAL_MS. */
const scanLoopTick = () => {
  const now = Date.now();
  const state = useAutoLapScanner.getState();

  // 1. Prune / mark signal-lost for devices not seen in >30s.
  const next: Record<string, DetectedDevice> = {};
  let changed = false;
  for (const [name, dev] of Object.entries(state.detectedDevices)) {
    const age = now - dev.lastSeenAt;
    const lost = age > SIGNAL_LOST_AFTER_MS;
    if (lost && !dev.signalLost) {
      changed = true;
      if (!signalLostLogged.has(name)) {
        log("signal lost", name, "age=", age, "ms");
        signalLostLogged.add(name);
      }
      next[name] = { ...dev, signalLost: true };
    } else {
      if (!lost) signalLostLogged.delete(name);
      next[name] = dev;
    }
  }
  if (changed) {
    useAutoLapScanner.setState({ detectedDevices: next });
  }

  // 2. Auto-restart guard — if access still granted but scan died, restart.
  if (
    checkAutoLapAccess() &&
    state.status === "scanning" &&
    typeof navigator !== "undefined" &&
    (navigator as any).bluetooth?.requestLEScan &&
    leScan === null
  ) {
    log("scan dropped unexpectedly — auto-restarting");
    void useAutoLapScanner.getState().start();
  }
};

const startScanLoop = () => {
  if (scanLoopId !== null) return; // single loop guarantee
  log("scan loop start (interval", SCAN_LOOP_INTERVAL_MS, "ms)");
  scanLoopId = setInterval(scanLoopTick, SCAN_LOOP_INTERVAL_MS);
};

/** Record an advertisement (called from BLE listener or feedRssiSample). */
const recordAdvertisement = (name: string, rssi: number, now: number) => {
  signalLostLogged.delete(name);
  useAutoLapScanner.setState((s) => {
    const prev = s.detectedDevices[name];
    return {
      lastSeenAt: { ...s.lastSeenAt, [name]: now },
      detectedDevices: {
        ...s.detectedDevices,
        [name]: {
          name,
          lastRssi: rssi,
          lastSeenAt: now,
          signalLost: false,
        },
      },
    };
  });
  // Only feed mapped devices into the AutoLap pipeline.
  const known = useDeviceMappingStore
    .getState()
    .mappings.some((m) => m.device_name === name);
  if (known) getTracker(name).push(rssi, now);
};

export const useAutoLapScanner = create<ScannerState>((set, get) => ({
  status: "idle",
  error: null,
  detectedDevices: {},
  smoothedRssi: {},
  lastPeak: {},
  phase: {},
  inRangeSince: {},
  lastSeenAt: {},

  start: async () => {
    if (starting) return;
    if (get().status === "scanning" && leScan !== null) return;
    starting = true;
    try {
      const bt: any =
        typeof navigator !== "undefined" ? (navigator as any).bluetooth : null;

      // No Web Bluetooth → still start the loop so feedRssiSample() works.
      if (!bt || typeof bt.requestLEScan !== "function") {
        set({ status: "unsupported", error: null });
        startScanLoop();
        log("start: Web Bluetooth requestLEScan unavailable; loop only");
        return;
      }

      // Tear down any stale listener before re-attaching.
      teardownLEScan();

      advListener = (event: any) => {
        const name: string | undefined = event.device?.name;
        const rssi: number | undefined = event.rssi;
        if (!name || typeof rssi !== "number") return;
        recordAdvertisement(name, rssi, Date.now());
      };
      bt.addEventListener("advertisementreceived", advListener);
      leScan = await bt.requestLEScan({ acceptAllAdvertisements: true });
      log("start: requestLEScan active");
      set({ status: "scanning", error: null });
      startScanLoop();
    } catch (err: any) {
      teardownLEScan();
      log("start error:", err?.message || err);
      set({ status: "error", error: err?.message || String(err) });
      // Keep loop running — it will auto-retry on the next tick if access true.
      startScanLoop();
    } finally {
      starting = false;
    }
  },

  stop: () => {
    log("stop");
    teardownLEScan();
    stopScanLoop();
    trackers.forEach((t) => t.reset());
    signalLostLogged.clear();
    set({
      status: "idle",
      error: null,
      detectedDevices: {},
      smoothedRssi: {},
      lastPeak: {},
      phase: {},
      inRangeSince: {},
      lastSeenAt: {},
    });
  },

  feedRssiSample: (deviceName, rssi, now = Date.now()) => {
    log("rssi", deviceName, rssi);
    recordAdvertisement(deviceName, rssi, now);
  },
}));

// ---------------------------------------------------------------------------
// Lifecycle hook: tie the global manager to AutoLap access.
// Mounted once at the app root → persists across page navigation.
// ---------------------------------------------------------------------------
export const useAutoLapScannerLifecycle = () => {
  useEffect(() => {
    const sync = () => {
      const unlocked = checkAutoLapAccess();
      const status = useAutoLapScanner.getState().status;
      if (unlocked && status === "idle") {
        log("access granted → starting scanner");
        void useAutoLapScanner.getState().start();
      } else if (!unlocked && status !== "idle") {
        log("access revoked → stopping scanner");
        useAutoLapScanner.getState().stop();
      }
    };
    sync();
    const id = window.setInterval(sync, 1000);
    window.addEventListener("storage", sync);
    window.addEventListener("autolap-access-changed", sync);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", sync);
      window.removeEventListener("autolap-access-changed", sync);
    };
  }, []);
};
