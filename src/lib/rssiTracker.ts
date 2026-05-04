// Step 5+6: RSSI tracker per device.
// - Continuously ingests RSSI samples (dBm, negative numbers; closer = higher).
// - Detects Entry → Peak → Exit transitions vs. a configurable threshold.
// - Records Peak RSSI and the timestamp at peak (used as the lap time).
// - Smooths samples with a 5-second moving average to reject signal-drop noise.
//
// This file does NOT touch the AutoLap state machine. Consumers wire the
// "peak detected" callback to machine.lapTrigger() / signalSeen / signalLost.

export const RSSI_WINDOW_MS = 5_000;        // moving-average window
export const RSSI_ENTRY_THRESHOLD = -75;    // dBm: smoothed >= this = "in range"
export const RSSI_EXIT_THRESHOLD = -85;     // dBm: smoothed <  this = "out of range" (hysteresis)

export type RssiPhase = "out" | "in";

export interface RssiSample {
  t: number;     // timestamp ms
  rssi: number;  // dBm
}

export interface RssiPeakEvent {
  deviceName: string;
  peakRssi: number;
  peakAt: number;       // ms timestamp of the peak — used as lap time
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
  getSmoothed: () => number | null;
  getPhase: () => RssiPhase;
  reset: () => void;
}

/**
 * Create an RSSI tracker for a single device name.
 * Smooths via simple moving average over the last `windowMs` samples.
 */
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

  return {
    push: (rssi, now = Date.now()) => {
      samples.push({ t: now, rssi });
      trim(now);
      const avg = smoothed();
      if (avg === null) return;

      // Entry: smoothed crosses above entry threshold.
      if (phase === "out" && avg >= entryTh) {
        phase = "in";
        enteredAt = now;
        peakRssi = avg;
        peakAt = now;
        opts.onPhaseChange?.(phase, avg);
        return;
      }

      // While "in": track peak (highest = closest, dBm closer to 0).
      if (phase === "in") {
        if (peakRssi === null || avg > peakRssi) {
          peakRssi = avg;
          peakAt = now;
        }
        // Exit: smoothed falls below exit threshold (hysteresis).
        if (avg < exitTh) {
          if (
            enteredAt !== null &&
            peakRssi !== null &&
            peakAt !== null
          ) {
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
          opts.onPhaseChange?.(phase, avg);
        }
      }
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
