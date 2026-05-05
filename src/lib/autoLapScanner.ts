// Global Bluetooth Manager for AutoLap (Vercel Build-Safe Version)
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

export type ScannerStatus = "idle" | "scanning" | "unsupported" | "error" | "waiting-gesture";

export const SCAN_LOOP_INTERVAL_MS = 2500;
export const WATCHDOG_TIMEOUT_MS = 45000; 
export const SIGNAL_LOST_AFTER_MS = 30000;

const log = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.log("[BluetoothManager]", ...args);
};

// --- Screen Wake Lock Management ---
let wakeLock: any = null;
const requestWakeLock = async () => {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    if (!wakeLock) {
      wakeLock = await (navigator as any).wakeLock.request("screen");
      log("🔓 Wake Lock active.");
    }
  } catch (err) {
    log("Wake Lock failed:", err);
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
let leScan: { stop: () => void } | null = null;
let advListener: ((e: any) => void) | null = null;
let scanLoopId: ReturnType<typeof setInterval> | null = null;
let starting = false;
let lastGlobalAdAt = Date.now();

const getTracker = (deviceName: string): RssiTracker => {
  let t = trackers.get(deviceName);
  if (t) return t;
  t = createRssiTracker(deviceName, {
    onPhaseChange: (phase, smoothed) => {
      const now = Date.now();
      useAutoLapScanner.setState((s) => ({
        smoothedRssi: { ...s.smoothedRssi, [deviceName]: smoothed },
        phase: { ...s.phase, [deviceName]: phase },
        inRangeSince: { ...s.inRangeSince, [deviceName]: phase === "in" ? now : null },
      }));
      const mapping = useDeviceMappingStore.getState().mappings.find((m) => m.device_name === deviceName);
      const machine = mapping ? useAutoLapRegistry.getState().getMachine(mapping.athlete_id) : null;
      if (machine) {
        if (phase === "in") machine.signalSeen(now);
        else machine.signalLost(now);
      }
    },
    onPeak: (event) => {
      const mapping = useDeviceMappingStore.getState().mappings.find((m) => m.device_name === deviceName);
      if (mapping) {
        const machine = useAutoLapRegistry.getState().getMachine(mapping.athlete_id);
        if (machine && machine.lapTrigger(event.peakAt)) {
          useRaceStore.getState().addManualLap(mapping.athlete_id, event.peakAt);
          log("💾 Lap Recorded:", mapping.athlete_id);
        }
      }
    },
  });
  trackers.set(deviceName, t);
  return t;
};

const stopEverything = () => {
  if (leScan) try { leScan.stop(); } catch (e) {}
  leScan = null;
  if (advListener && typeof navigator !== "undefined" && (navigator as any).bluetooth) {
    (navigator as any).bluetooth.removeEventListener("advertisementreceived", advListener);
  }
  advListener = null;
  starting = false;
};

const scanLoopTick = () => {
  const now = Date.now();
  const state = useAutoLapScanner.getState();

  if (state.status === "scanning" && now - lastGlobalAdAt > WATCHDOG_TIMEOUT_MS) {
    log("⚠️ Watchdog trigger: Restarting Scan...");
    void state.start();
    return;
  }

  trackers.forEach((t) => t.tick(now));
  
  const nextDevices: Record<string, DetectedDevice> = {};
  let changed = false;
  for (const [name, dev] of Object.entries(state.detectedDevices)) {
    const isLost = now - dev.lastSeenAt > SIGNAL_LOST_AFTER_MS;
    if (isLost !== dev.signalLost) {
      changed = true;
      nextDevices[name] = { ...dev, signalLost: isLost };
    } else {
      nextDevices[name] = dev;
    }
  }

  useAutoLapScanner.setState({ 
    currentTime: now, 
    ...(changed ? { detectedDevices: nextDevices } : {}) 
  });
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
    starting = true;
    
    try {
      if (typeof window === "undefined" || typeof navigator === "undefined") return;
      
      const bt = (navigator as any).bluetooth;
      if (!bt?.requestLEScan) {
        set({ status: "unsupported" });
        return;
      }

      stopEverything();
      lastGlobalAdAt = Date.now();

      advListener = (event: any) => {
        lastGlobalAdAt = Date.now();
        const name = event.device?.name;
        const rssi = event.rssi;
        if (!name || rssi === undefined) return;
        
        const now = Date.now();
        set((s) => ({
          lastSeenAt: { ...s.lastSeenAt, [name]: now },
          detectedDevices: {
            ...s.detectedDevices,
            [name]: { name, lastRssi: rssi, lastSeenAt: now, signalLost: false }
          }
        }));
        
        const isKnown = useDeviceMappingStore.getState().mappings.some(m => m.device_name === name);
        if (isKnown) getTracker(name).push(rssi, now);
      };

      bt.addEventListener("advertisementreceived", advListener);
      leScan = await bt.requestLEScan({ acceptAllAdvertisements: true });
      
      log("✅ Scanning Active");
      set({ status: "scanning", error: null });
      if (!scanLoopId) scanLoopId = setInterval(scanLoopTick, SCAN_LOOP_INTERVAL_MS);
      void requestWakeLock();

    } catch (err: any) {
      stopEverything();
      if (err.name === "NotAllowedError" || err.name === "SecurityError") {
        set({ status: "waiting-gesture", error: "Please tap the screen to enable Bluetooth" });
      } else {
        set({ status: "error", error: err.message });
      }
    } finally {
      starting = false;
    }
  },

  stop: () => {
    stopEverything();
    if (scanLoopId) clearInterval(scanLoopId);
    scanLoopId = null;
    set({ status: "idle", detectedDevices: {}, smoothedRssi: {}, lastPeak: {}, phase: {} });
  },

  feedRssiSample: (deviceName: string, rssi: number, now = Date.now()) => {
    lastGlobalAdAt = now;
    getTracker(deviceName).push(rssi, now);
  }
}));

export const useAutoLapScannerLifecycle = () => {
  useEffect(() => {
    const sync = () => {
      const unlocked = checkAutoLapAccess();
      const status = useAutoLapScanner.getState().status;
      if (unlocked && (status === "idle" || status === "error" || status === "waiting-gesture")) {
        void useAutoLapScanner.getState().start();
      } else if (!unlocked && status !== "idle") {
        useAutoLapScanner.getState().stop();
      }
    };

    const handleInteraction = () => {
      const state = useAutoLapScanner.getState();
      if (checkAutoLapAccess() && state.status !== "scanning") {
        void state.start();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pointerdown", handleInteraction);
      const interval = setInterval(sync, 2000);
      return () => {
        clearInterval(interval);
        window.removeEventListener("pointerdown", handleInteraction);
      };
    }
  }, []);
};
