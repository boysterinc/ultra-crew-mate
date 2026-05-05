// src/lib/autoLapScanner.ts (ฉบับเพิ่มระบบ Wake Lock กันหลับ)
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
export const SCAN_LOOP_INTERVAL_MS = 2_500;
export const SIGNAL_LOST_AFTER_MS = 30_000;
export const WATCHDOG_TIMEOUT_MS = 45_000; 

const log = (...args: unknown[]) => {
  console.log("[BluetoothManager]", ...args);
};

// --- [เพิ่มใหม่] ตัวแปรคุมการกันหลับ ---
let wakeLock: any = null;

const requestWakeLock = async () => {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await (navigator as any).wakeLock.request("screen");
    log("🔓 Wake Lock active: Screen will stay ON.");
    wakeLock.addEventListener("release", () => {
      log("Wake Lock released.");
    });
  } catch (err: any) {
    log("Wake Lock failed:", err.message);
  }
};
// ------------------------------------

interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  currentTime: number;
  detectedDevices: Record<string, any>;
  // ... (ส่วนอื่นๆ ของ State เหมือนเดิม)
  start: () => Promise<void>;
  stop: () => void;
}

// ... (Logic การสร้าง Tracker และ Scanner เหมือนเดิมที่คุณมี)

export const useAutoLapScanner = create<ScannerState>((set, get) => ({
  // ... (Initial state เหมือนเดิม)
  start: async () => {
    // ... (Logic Start Bluetooth ของคุณ)
    await requestWakeLock(); // ขอ Wake Lock ทันทีที่เริ่มสแกน
  },
  stop: () => {
    // ... (Logic Stop Bluetooth ของคุณ)
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }
}));

export const useAutoLapScannerLifecycle = () => {
  useEffect(() => {
    // ดักจังหวะคนกลับมาที่หน้าจอ ให้ขอสิทธิ์ Wake Lock และ Resume Bluetooth ใหม่
    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        log("Screen visible: Re-requesting Wake Lock...");
        await requestWakeLock();
        const unlocked = checkAutoLapAccess();
        if (unlocked) void useAutoLapScanner.getState().start();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pointerdown", requestWakeLock); // ขอ Wake Lock ตอนแตะจอด้วย (User Gesture)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pointerdown", requestWakeLock);
    };
  }, []);
};
