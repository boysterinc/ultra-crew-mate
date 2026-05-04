// Step 7: Global scanning state for AutoLap.
// - Lives outside React tree → survives page navigation.
// - Auto-starts when AutoLap is unlocked, auto-stops when access is revoked.
// - Owns one RSSI tracker per known device name and forwards peak events
//   to the per-athlete AutoLap state machine.
//
// Note on Web Bluetooth: continuous RSSI scanning uses the experimental
// `navigator.bluetooth.requestLEScan` API. When unavailable we still keep the
// scanner "running" in state — feedRssiSample() can be called from any source
// (mock, future native bridge, etc.) and the pipeline still works.
import { create } from "zustand";
import { checkAutoLapAccess } from "@/lib/autoLapAccess";
import { useDeviceMappingStore } from "@/lib/deviceMapping";
import { useAutoLapRegistry } from "@/lib/autoLapMachine";
import {
  createRssiTracker,
  RssiTracker,
  RssiPeakEvent,
  RssiPhase,
} from "@/lib/rssiTracker";

export type ScannerStatus = "idle" | "scanning" | "unsupported" | "error";

/** dBm threshold above which we consider the signal "strong". */
export const RSSI_STRONG_THRESHOLD = -65;
/** Continuous in-range duration that flips status to "Stay". */
export const STAY_DURATION_MS = 5_000;
/** Sample considered fresh / signal present within this window. */
export const SIGNAL_FRESH_MS = 4_000;

interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  /** smoothed RSSI per device name, for UI. */
  smoothedRssi: Record<string, number | null>;
  /** last peak event per device name. */
  lastPeak: Record<string, RssiPeakEvent | null>;
  /** current phase per device name. */
  phase: Record<string, RssiPhase>;
  /** ms timestamp the device entered "in" phase (null if "out"). */
  inRangeSince: Record<string, number | null>;
  /** ms timestamp of the last received sample for the device. */
  lastSeenAt: Record<string, number | null>;
  start: () => Promise<void>;
  stop: () => void;
  /** Inject an RSSI sample (real BLE bridge or test). */
  feedRssiSample: (deviceName: string, rssi: number, now?: number) => void;
}

// --- Module-level singletons (survive component unmounts / navigation) ---
const trackers = new Map<string, RssiTracker>();
let leScan: { stop: () => void } | null = null;
let advListener: ((e: any) => void) | null = null;

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
      // Keep state machine aligned with signal presence.
      const machine = getMachineForDevice(deviceName);
      if (machine) {
        if (phase === "in") machine.signalSeen(now);
        else machine.signalLost(now);
      }
    },
    onPeak: (event) => {
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

export const useAutoLapScanner = create<ScannerState>((set, get) => ({
  status: "idle",
  error: null,
  smoothedRssi: {},
  lastPeak: {},
  phase: {},
  inRangeSince: {},
  lastSeenAt: {},

  start: async () => {
    if (get().status === "scanning") return;
    const bt: any =
      typeof navigator !== "undefined" ? (navigator as any).bluetooth : null;

    // No Web Bluetooth at all → still mark "scanning" so injected samples flow,
    // but surface as unsupported in UI.
    if (!bt || typeof bt.requestLEScan !== "function") {
      set({ status: "unsupported", error: null });
      return;
    }

    try {
      advListener = (event: any) => {
        const name: string | undefined = event.device?.name;
        const rssi: number | undefined = event.rssi;
        if (!name || typeof rssi !== "number") return;
        // Only track devices that are mapped to athletes.
        const known = useDeviceMappingStore
          .getState()
          .mappings.some((m) => m.device_name === name);
        if (!known) return;
        getTracker(name).push(rssi);
      };
      bt.addEventListener("advertisementreceived", advListener);
      leScan = await bt.requestLEScan({ acceptAllAdvertisements: true });
      set({ status: "scanning", error: null });
    } catch (err: any) {
      teardownLEScan();
      set({ status: "error", error: err?.message || String(err) });
    }
  },

  stop: () => {
    teardownLEScan();
    trackers.forEach((t) => t.reset());
    set({ status: "idle", error: null, smoothedRssi: {}, lastPeak: {} });
  },

  feedRssiSample: (deviceName, rssi, now) => {
    getTracker(deviceName).push(rssi, now);
  },
}));

// ---------------------------------------------------------------------------
// Auto start/stop hook: tie scanner lifecycle to AutoLap access.
// Mounted once at the app root so it persists across page navigation.
// ---------------------------------------------------------------------------
import { useEffect } from "react";

export const useAutoLapScannerLifecycle = () => {
  useEffect(() => {
    const sync = () => {
      const unlocked = checkAutoLapAccess();
      const status = useAutoLapScanner.getState().status;
      if (unlocked && status === "idle") {
        void useAutoLapScanner.getState().start();
      } else if (!unlocked && status !== "idle") {
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
