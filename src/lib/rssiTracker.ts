// Step 5+6: RSSI tracker per device.
export const RSSI_WINDOW_MS = 5_000;
export const RSSI_ENTRY_THRESHOLD = -75;
export const RSSI_EXIT_THRESHOLD = -85;

export type RssiPhase = "out" | "in";

export interface RssiSample {
  t: number;
  rssi: number;
}

export interface RssiPeakEvent {
  deviceName: string;
  peakRssi: number;
  peakAt: number;
  enteredAt: number;
  exitedAt: number;
}

export interface RssiTrackerOptions {
  windowMs?: number;
  entryThreshold?: number;
  exitThreshold?: number;
  onPeak?: (event: RssiPeakEvent) => void;
  onPhaseChange?: (phase: RssiPhase, smoothedRssi: number) => void;
}

export interface RssiTracker {
  push: (rssi: number, now?: number) => void;
  tick: (now?: number) => void; // เพิ่มฟังก์ชัน tick
  getSmoothed: () => number | null;
  getPhase: () => RssiPhase;
  reset: () => void;
}

export function createRssiTracker(
  deviceName: string,
  opts: RssiTrackerOptions = {}
): RssiTracker {
  const windowMs = opts.windowMs ?? RSSI_WINDOW_MS;
  const entryTh = opts.entryThreshold ?? RSSI_ENTRY_THRESHOLD;
  const exitTh = opts.exitThreshold ?? RSSI_EXIT_THRESHOLD;

  const samples: RssiSample[] = [];
  let phase: RssiPhase = "out";
  let enteredAt: number | null = null;
  let peakRssi: number | null = null;
  let peakAt: number | null = null;

  const trim = (now: number) => {
    const cutoff = now - windowMs;
    while (samples.length && samples[0].t < cutoff) samples.shift();
  };

  const smoothed = (): number | null => {
    if (samples.length === 0) return null;
    let sum = 0;
    for (const s of samples) sum += s.rssi;
    return sum / samples.length;
  };

  // แยกฟังก์ชันเช็กขาออก เพื่อให้ tick เอาไปใช้ได้ด้วย
  const checkExit = (now: number, avg: number | null) => {
    if (phase === "in") {
      if (avg === null || avg < exitTh) {
        if (enteredAt !== null && peakRssi !== null && peakAt !== null) {
          opts.onPeak?.({
            deviceName,
            peakRssi,
            peakAt,
            enteredAt,
            exitedAt: now,
          });
        }
        phase = "out";
        enteredAt = null;
        peakRssi = null;
        peakAt = null;
        opts.onPhaseChange?.(phase, avg !== null ? avg : -100);
      }
    }
  };

  return {
    push: (rssi, now = Date.now()) => {
      samples.push({ t: now, rssi });
      trim(now);
      const avg = smoothed();
      if (avg === null) return;

      if (phase === "out" && avg >= entryTh) {
        phase = "in";
        enteredAt = now;
        peakRssi = avg;
        peakAt = now;
        opts.onPhaseChange?.(phase, avg);
        return;
      }

      if (phase === "in") {
        if (peakRssi === null || avg > peakRssi) {
          peakRssi = avg;
          peakAt = now;
        }
        checkExit(now, avg);
      }
    },
    tick: (now = Date.now()) => {
      trim(now);
      const avg = smoothed();
      checkExit(now, avg);
    },
    getSmoothed: smoothed,
    getPhase: () => phase,
    reset: () => {
      samples.length = 0;
      phase = "out";
      enteredAt = null;
      peakRssi = null;
      peakAt = null;
    },
  };
}
