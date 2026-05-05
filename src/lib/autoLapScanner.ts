// Global Bluetooth Manager for AutoLap (Full Version with Self-Healing)
// ---------------------------------------------------------------------------
import { create } from "zustand";
import { useEffect } from "react";
import { checkAutoLapAccess } from "@/lib/autoLapAccess";
import { useDeviceMappingStore } from "@/lib/deviceMapping";
import { useAutoLapRegistry } from "@/lib/autoLapMachine";
import { useRaceStore } from "@/lib/store";
import {
  createRssiTracker,
  RssiTracker,
  RssiPeakEvent,
  RssiPhase,
} from "@/lib/rssiTracker";

export type ScannerStatus = "idle" | "scanning" | "unsupported" | "error";

export const RSSI_STRONG_THRESHOLD = -80;
export const STAY_DURATION_MS = 5_000;
export const SIGNAL_FRESH_MS = 4_000;
export const SCAN_LOOP_INTERVAL_MS = 2_500;
export const SIGNAL_LOST_AFTER_MS = 30_000;
export const WATCHDOG_TIMEOUT_MS = 45_000; 
export const SELF_HEALING_THRESHOLD_MS = 10_000; // หากเวลาค้างเกิน 10 วิ ให้สะดุ้งตื่น

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log("[BluetoothManager]", ...args);
};

// --- [Screen Wake Lock] ระบบกันหน้าจอหลับ ---
let wakeLock: any = null;

const requestWakeLock = async () => {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    wakeLock = await (navigator as any).wakeLock.request("screen");
    log("🔓 Wake Lock active: Screen will stay ON.");
  } catch (err: any) {
    log("Wake Lock failed:", err.message);
  }
};

const releaseWakeLock = () => {
  if (wakeLock) {
    wakeLock.release().then(() => {
      wakeLock = null;
    });
  }
};

export interface DetectedDevice {
  name: string;
  lastRssi: number;
  lastSeenAt: number;
  signalLost: boolean;
}

interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  currentTime: number;
  detectedDevices: Record<string, DetectedDevice>;
  smoothedRssi: Record<string, number | null>;
  lastPeak: Record<string, RssiPeakEvent | null>;
  phase: Record<string, RssiPhase>;
  inRangeSince: Record<string, number | null>;
  lastSeenAt: Record<string, number | null>;

  start: () => Promise<void>;
  stop: () => void;
  feedRssiSample: (deviceName: string, rssi: number, now?: number) => void;
}

const trackers = new Map<string, RssiTracker>();
let leScan: { stop: () => void; active?: boolean } | null = null;
let advListener: ((e: any) => void) | null = null;
let scanLoopId: ReturnType<typeof setInterval> | null = null;
let starting = false;

let lastGlobalAdAt = Date.now(); 
let lastTickAt = Date.now(); // สำหรับตรวจจับอาการนาฬิกาตาย
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
        const isAccepted = machine.lapTrigger(event.peakAt);
        if (isAccepted) {
          const mapping = useDeviceMappingStore.getState().mappings.find((m) => m.device_name === deviceName);
          if (mapping) {
            useRaceStore.getState().addManualLap(mapping.athlete_id, event.peakAt);
            log("💾 AutoLap Saved for athlete:", mapping.athlete_id);
          }
        }
        machine.signalLost(event.exitedAt);
      }
    },
  });
  trackers.set(deviceName, t);
  return t;
};

const teardownLEScan = () => {
  try { leScan?.stop(); } catch { /* ignore */ }
  leScan = null;
  if (advListener && (navigator as any).bluetooth?.removeEventListener) {
    try {
      (navigator as any).bluetooth.removeEventListener("advertisementreceived", advListener);
    } catch { /* ignore */ }
  }
  advListener = null;
};

const scanLoopTick = () => {
  const now = Date.now();
  const state = useAutoLapScanner.getState();

  // --- [Self-Healing] ตรวจจับ JavaScript โดนแช่แข็ง ---
  if (now - lastTickAt > SELF_HEALING_THRESHOLD_MS) {
    log("⚠️ System Freeze detected! Reviving Bluetooth...");
    lastGlobalAdAt = now; 
    teardownLEScan();
    setTimeout(() => {
      void useAutoLapScanner.getState().start();
    }, 500);
  }
  lastTickAt = now;

  // Watchdog เช็คบลูทูธตายเงียบ
  if (state.status === "scanning" && leScan !== null) {
    if (now - lastGlobalAdAt > WATCHDOG_TIMEOUT_MS) {
      log("watchdog: scan silently died, forcing restart...");
      lastGlobalAdAt = now; 
      teardownLEScan(); 
      setTimeout(() => {
        void useAutoLapScanner.getState().start();
      }, 1000);
    }
  }

  trackers.forEach((t) => t.tick(now));

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
    useAutoLapScanner.setState({ detectedDevices: next, currentTime: now });
  } else {
    useAutoLapScanner.setState({ currentTime: now });
  }

  if (
    checkAutoLapAccess() &&
    state.status === "scanning" &&
    typeof navigator !== "undefined" &&
    (navigator as any).bluetooth?.requestLEScan &&
    leScan === null &&
    !starting
  ) {
    void useAutoLapScanner.getState().start();
  }
};

export const useAutoLapScanner = create<ScannerState>((set, get) => ({
  status: "idle",
  error: null,
  currentTime: Date.now(),
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
      const bt: any = typeof navigator !== "undefined" ? (navigator as any).bluetooth : null;
      if (!bt || typeof bt.requestLEScan !== "function") {
        set({ status: "unsupported" });
        return;
      }

      teardownLEScan();
      await requestWakeLock();
      lastGlobalAdAt = Date.now(); 

      advListener = (event: any) => {
        lastGlobalAdAt = Date.now(); 
        const name: string | undefined = event.device?.name;
        const rssi: number | undefined = event.rssi;
        if (!name || typeof rssi !== "number") return;
        recordAdvertisement(name, rssi, Date.now());
      };
      
      bt.addEventListener("advertisementreceived", advListener);
      leScan = await bt.requestLEScan({ acceptAllAdvertisements: true });
      
      set({ status: "scanning", error: null });
      if (!scanLoopId) {
        scanLoopId = setInterval(scanLoopTick, SCAN_LOOP_INTERVAL_MS);
      }
    } catch (err: any) {
      teardownLEScan();
      set({ status: "error", error: err?.message || String(err) });
    } finally {
      starting = false;
    }
  },

  stop: () => {
    teardownLEScan();
    if (scanLoopId) {
      clearInterval(scanLoopId);
      scanLoopId = null;
    }
    releaseWakeLock();
    trackers.forEach((t) => t.reset());
    set({
      status: "idle",
      detectedDevices: {},
      smoothedRssi: {},
      lastPeak: {},
      phase: {},
      inRangeSince: {},
      lastSeenAt: {},
    });
  },

  feedRssiSample: (deviceName, rssi, now = Date.now()) => {
    lastGlobalAdAt = now;
    recordAdvertisement(deviceName, rssi, now);
  },
}));

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
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        const unlocked = checkAutoLapAccess();
        if (unlocked) void useAutoLapScanner.getState().start();
      }
    };

    const wakeUpOnTouch = () => {
      const unlocked = checkAutoLapAccess();
      if (unlocked && useAutoLapScanner.getState().status !== "scanning") {
        void requestWakeLock();
        void useAutoLapScanner.getState().start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pointerdown", wakeUpOnTouch);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pointerdown", wakeUpOnTouch);
    };
  }, []);
};
