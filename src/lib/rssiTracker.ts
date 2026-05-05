// Step 5+6: RSSI tracker per device.
// ระบบกรองสัญญาณและหาจุด Peak (แม่นยำสูงและกัน Noise)
// ---------------------------------------------------------------------------

export const RSSI_WINDOW_MS = 5_000;        // ช่วงเวลาถัวเฉลี่ย (5 วินาที) ยิ่งเยอะยิ่งกัน Noise ได้ดีแต่จะนับรอบช้าลง
export const RSSI_ENTRY_THRESHOLD = -85;    // เกณฑ์สัญญาณขาเข้า
export const RSSI_EXIT_THRESHOLD = -95;     // เกณฑ์สัญญาณขาออก
export const PEAK_DROP_THRESHOLD = 4;       // สัญญาณ "เฉลี่ย" ต้องดรอปลงจากจุดสูงสุดกี่ dBm ถึงจะเริ่มนับรอบ

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
  tick: (now?: number) => void;
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
  let hasTriggeredPeak = false;

  const trim = (now: number) => {
    const cutoff = now - windowMs;
    while (samples.length && samples[0].t < cutoff) samples.shift();
  };

  const smoothed = (): number | null => {
    if (samples.length === 0) return null;
    let sum = 0;
    for (const s of samples) sum += s.rssi;
    return sum / samples.length; // การหาค่าเฉลี่ยเพื่อกัน Noise
  };

  const triggerPeakEvent = (now: number) => {
    if (hasTriggeredPeak) return;
    if (enteredAt !== null && peakRssi !== null && peakAt !== null) {
      opts.onPeak?.({
        deviceName,
        peakRssi,
        peakAt, // ใช้เวลา ณ จุดที่แรงที่สุดจริงๆ (แม้จะสั่งนับช้าลงเล็กน้อยแต่เวลาในระบบจะแม่นเป๊ะ)
        enteredAt,
        exitedAt: now,
      });
      hasTriggeredPeak = true;
    }
  };

  return {
    push: (rssi, now = Date.now()) => {
      samples.push({ t: now, rssi });
      trim(now);
      const avg = smoothed(); // ใช้ค่าที่ผ่านการถัวเฉลี่ยแล้วเท่านั้นในการตัดสินใจ
      if (avg === null) return;

      if (phase === "out" && avg >= entryTh) {
        phase = "in";
        enteredAt = now;
        peakRssi = avg;
        peakAt = now;
        hasTriggeredPeak = false;
        opts.onPhaseChange?.(phase, avg);
        return;
      }

      if (phase === "in") {
        // อัปเดตจุดที่ใกล้ที่สุดจากค่าเฉลี่ย
        if (peakRssi === null || avg > peakRssi) {
          peakRssi = avg;
          peakAt = now;
        }

        // เช็กจังหวะวิ่งผ่าน: ค่าเฉลี่ยต้องตกลงมาจากจุดสูงสุดเกิน 4dBm
        if (!hasTriggeredPeak && peakRssi !== null && avg < peakRssi - PEAK_DROP_THRESHOLD) {
          triggerPeakEvent(now);
        }

        if (avg < exitTh) {
          if (!hasTriggeredPeak) triggerPeakEvent(now);
          phase = "out";
          enteredAt = null;
          peakRssi = null;
          peakAt = null;
          opts.onPhaseChange?.(phase, avg);
        }
      }
    },
    tick: (now = Date.now()) => {
      trim(now);
      const avg = smoothed();
      if (phase === "in" && (avg === null || avg < exitTh)) {
        if (!hasTriggeredPeak) triggerPeakEvent(now);
        phase = "out";
        enteredAt = null;
        peakRssi = null;
        peakAt = null;
        opts.onPhaseChange?.(phase, avg || -100);
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
      hasTriggeredPeak = false;
    },
  };
}
