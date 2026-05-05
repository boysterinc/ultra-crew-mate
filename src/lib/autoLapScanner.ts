import { create } from "zustand";

type Phase = "in" | "out";

interface AutoLapState {
  smoothedRssi: Record<string, number | null>;
  phase: Record<string, Phase>;
  inRangeSince: Record<string, number | null>;
  lastSeenAt: Record<string, number | null>;

  feedRssiSample: (deviceName: string, rssi: number) => void;
  resetDevice: (deviceName: string) => void;
}

export const RSSI_STRONG_THRESHOLD = -70;
export const STAY_DURATION_MS = 5000;
export const SIGNAL_FRESH_MS = 10000;
const SIGNAL_LOST_TIMEOUT = 30000; // 🔥 สำคัญ

export const useAutoLapScanner = create<AutoLapState>((set, get) => ({
  smoothedRssi: {},
  phase: {},
  inRangeSince: {},
  lastSeenAt: {},

  feedRssiSample: (deviceName, rssi) => {
    const now = Date.now();

    set((state) => {
      const prev = state.smoothedRssi[deviceName];

      // ✅ smoothing
      const smoothed =
        prev === null || prev === undefined
          ? rssi
          : prev * 0.7 + rssi * 0.3;

      const nextPhase = smoothed >= RSSI_STRONG_THRESHOLD ? "in" : "out";

      return {
        smoothedRssi: {
          ...state.smoothedRssi,
          [deviceName]: smoothed,
        },
        phase: {
          ...state.phase,
          [deviceName]: nextPhase,
        },
        inRangeSince: {
          ...state.inRangeSince,
          [deviceName]:
            nextPhase === "in"
              ? state.inRangeSince[deviceName] ?? now
              : null,
        },
        lastSeenAt: {
          ...state.lastSeenAt,
          [deviceName]: now, // 🔥 สำคัญมาก (fix reconnect)
        },
      };
    });
  },

  resetDevice: (deviceName) => {
    set((state) => ({
      smoothedRssi: { ...state.smoothedRssi, [deviceName]: null },
      phase: { ...state.phase, [deviceName]: "out" },
      inRangeSince: { ...state.inRangeSince, [deviceName]: null },
      lastSeenAt: { ...state.lastSeenAt, [deviceName]: null },
    }));
  },
}));

// ===============================
// 🔥 GLOBAL CLEANUP LOOP (สำคัญสุด)
// ===============================
setInterval(() => {
  const state = useAutoLapScanner.getState();
  const now = Date.now();

  Object.keys(state.lastSeenAt).forEach((device) => {
    const last = state.lastSeenAt[device];

    if (!last) return;

    // ❌ ถ้าหายเกิน 30 วิ → reset state
    if (now - last > SIGNAL_LOST_TIMEOUT) {
      console.log("[AutoLap] signal lost → reset:", device);

      state.resetDevice(device);
    }
  });
}, 5000);
