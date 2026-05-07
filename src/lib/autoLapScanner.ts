// Global Bluetooth Manager for AutoLap (Ultra-Running Support)
// Updated: Hybrid Scanning (watchAdvertisements + requestLEScan)
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

const log = (...args: unknown[]) => {
  console.log("[BluetoothManager]", ...args);
};

// --- SILENT HEARTBEAT UTILITY ---
let silentAudioElement: HTMLAudioElement | null = null;
const startSilentHeartbeat = () => {
  if (typeof window === "undefined") return;
  if (!silentAudioElement) {
    const silentSrc = "data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    silentAudioElement = new Audio(silentSrc);
    silentAudioElement.loop = true;
    silentAudioElement.volume = 0.01;
  }
  silentAudioElement.play().catch((err) => log("Audio Heartbeat failed:", err));
};
const stopSilentHeartbeat = () => {
  if (silentAudioElement) {
    silentAudioElement.pause();
    silentAudioElement = null;
  }
};

// --- SCANNER STATE & LOGIC ---
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
let globalAdvListener: ((e: any) => void) | null = null;
let authorizedWatchers = new Map<string, () => void>(); // cleanup functions for each device
let scanLoopId: ReturnType<typeof setInterval> | null = null;
let starting = false;

let lastGlobalAdAt = Date.now(); 
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
        inRangeSince: { ...s.inRangeSince, [deviceName]: phase === "in" ? now : null },
      }));
      const machine = getMachineForDevice(deviceName);
      if (machine) {
        if (phase === "in") machine.signalSeen(now);
        else machine.signalLost(now);
      }
    },
    onPeak: (event) => {
      log("peak", deviceName, "rssi=", event.peakRssi.toFixed(1));
      useAutoLapScanner.setState((s) => ({ lastPeak: { ...s.lastPeak, [deviceName]: event } }));
      const machine = getMachineForDevice(deviceName);
      if (machine) {
        const isAccepted = machine.lapTrigger(event.peakAt);
        if (isAccepted) {
          const mapping = useDeviceMappingStore.getState().mappings.find((m) => m.device_name === deviceName);
          if (mapping) {
            useRaceStore.getState().addManualLap(mapping.athlete_id, event.peakAt);
            log("💾 AutoLap Saved:", mapping.athlete_id);
          }
        }
        machine.signalLost(event.exitedAt);
      }
    },
  });
  trackers.set(deviceName, t);
  return t;
};

const handleAdvertisement = (name: string, rssi: number) => {
  lastGlobalAdAt = Date.now();
  const now = Date.now();
  signalLostLogged.delete(name);
  
  useAutoLapScanner.setState((s) => ({
    lastSeenAt: { ...s.lastSeenAt, [name]: now },
    detectedDevices: {
      ...s.detectedDevices,
      [name]: { name, lastRssi: rssi, lastSeenAt: now, signalLost: false },
    },
  }));

  const known = useDeviceMappingStore.getState().mappings.some((m) => m.device_name === name);
  if (known) getTracker(name).push(rssi, now);
};

const teardownAllScans = () => {
  // Stop Global Scan
  try { leScan?.stop(); } catch { }
  leScan = null;
  if (globalAdvListener && (navigator as any).bluetooth?.removeEventListener) {
    try { (navigator as any).bluetooth.removeEventListener("advertisementreceived", globalAdvListener); } catch { }
  }
  globalAdvListener = null;

  // Stop Authorized Watchers
  authorizedWatchers.forEach((cleanup) => cleanup());
  authorizedWatchers.clear();
};

const scanLoopTick = () => {
  const now = Date.now();
  const state = useAutoLapScanner.getState();

  // Watchdog
  if (state.status === "scanning") {
    if (now - lastGlobalAdAt > WATCHDOG_TIMEOUT_MS) {
      log("watchdog: system silent, restarting...");
      lastGlobalAdAt = now;
      void useAutoLapScanner.getState().start();
    }
  }

  trackers.forEach((t) => t.tick(now));
  
  // Signal Lost Logic
  const next: Record<string, DetectedDevice> = {};
  let changed = false;
  for (const [name, dev] of Object.entries(state.detectedDevices)) {
    const age = now - dev.lastSeenAt;
    const lost = age > SIGNAL_LOST_AFTER_MS;
    if (lost && !dev.signalLost) {
      changed = true;
      next[name] = { ...dev, signalLost: true };
    } else {
      next[name] = dev;
    }
  }
  if (changed) useAutoLapScanner.setState({ detectedDevices: next, currentTime: now });
  else useAutoLapScanner.setState({ currentTime: now });
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
    startSilentHeartbeat();

    try {
      const bt = (navigator as any).bluetooth;
      if (!bt) {
        set({ status: "unsupported" });
        return;
      }

      teardownAllScans();
      lastGlobalAdAt = Date.now();

      // 1. SETUP AUTHORIZED WATCHERS (For Linked Watches)
      const athletes = useRaceStore.getState().athletes;
      const linkedAthletes = athletes.filter(a => a.bluetoothDeviceId);
      
      if (linkedAthletes.length > 0 && bt.getDevices) {
        const authorizedDevices: any[] = await bt.getDevices();
        
        for (const athlete of linkedAthletes) {
          const device = authorizedDevices.find(d => d.id === athlete.bluetoothDeviceId);
          if (device) {
            log(`Starting Authorized Watcher for: ${athlete.name}`);
            const listener = (event: any) => {
              const name = event.device.name || athlete.name; // Fallback to athlete name if device name hidden
              handleAdvertisement(name, event.rssi);
            };
            
            device.addEventListener("advertisementreceived", listener);
            await device.watchAdvertisements();
            
            authorizedWatchers.set(athlete.id, () => {
              device.removeEventListener("advertisementreceived", listener);
            });
          }
        }
      }

      // 2. SETUP PASSIVE SCAN (Fallback)
      if (bt.requestLEScan) {
        globalAdvListener = (event: any) => {
          if (event.device?.name) {
            handleAdvertisement(event.device.name, event.rssi);
          }
        };
        bt.addEventListener("advertisementreceived", globalAdvListener);
        leScan = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true });
        log("Global Passive Scan active");
      }

      set({ status: "scanning", error: null });
      if (!scanLoopId) scanLoopId = setInterval(scanLoopTick, SCAN_LOOP_INTERVAL_MS);

    } catch (err: any) {
      log("Start Error:", err);
      set({ status: "error", error: String(err) });
    } finally {
      starting = false;
    }
  },

  stop: () => {
    teardownAllScans();
    if (scanLoopId) { clearInterval(scanLoopId); scanLoopId = null; }
    stopSilentHeartbeat();
    trackers.forEach((t) => t.reset());
    set({ status: "idle", detectedDevices: {}, smoothedRssi: {}, lastPeak: {}, phase: {} });
  },

  feedRssiSample: (deviceName, rssi, now = Date.now()) => handleAdvertisement(deviceName, rssi),
}));

export const useAutoLapScannerLifecycle = () => {
  useEffect(() => {
    const sync = () => {
      const unlocked = checkAutoLapAccess();
      const status = useAutoLapScanner.getState().status;
      if (unlocked && status === "idle") void useAutoLapScanner.getState().start();
      else if (!unlocked && status !== "idle") useAutoLapScanner.getState().stop();
    };
    sync();
    const id = setInterval(sync, 2000);
    window.addEventListener("autolap-access-changed", sync);

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && checkAutoLapAccess()) {
        void useAutoLapScanner.getState().start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pointerdown", () => {
      if (checkAutoLapAccess()) startSilentHeartbeat();
    });

    return () => {
      clearInterval(id);
      window.removeEventListener("autolap-access-changed", sync);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);
};
