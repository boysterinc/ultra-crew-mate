// Per-athlete signal status helpers, derived from the global scanner store
// and the athlete↔device mapping. UI-only — no state machine writes here.

import { useEffect, useState } from "react";
import { useDeviceMappingStore } from "@/lib/deviceMapping";
import {
  useAutoLapScanner,
  RSSI_STRONG_THRESHOLD,
  STAY_DURATION_MS,
  SIGNAL_FRESH_MS,
} from "@/lib/autoLapScanner";

export type AthleteSignalStatus = "none" | "in-range" | "stay";

export interface AthleteSignal {
  status: AthleteSignalStatus;
  /** True if we have a recent advertisement for the device. */
  present: boolean;
  smoothedRssi: number | null;
  inRangeSince: number | null;
  lastSeenAt: number | null;
}

export const useAthleteSignal = (athleteId: string): AthleteSignal => {
  const mapping = useDeviceMappingStore((s) =>
    s.mappings.find((m) => m.athlete_id === athleteId)
  );
  const deviceName = mapping?.device_name ?? null;

  const smoothedRssi = useAutoLapScanner((s) =>
    deviceName ? s.smoothedRssi[deviceName] ?? null : null
  );
  const phase = useAutoLapScanner((s) =>
    deviceName ? s.phase[deviceName] ?? "out" : "out"
  );
  const inRangeSince = useAutoLapScanner((s) =>
    deviceName ? s.inRangeSince[deviceName] ?? null : null
  );
  const lastSeenAt = useAutoLapScanner((s) =>
    deviceName ? s.lastSeenAt[deviceName] ?? null : null
  );

  // ✅ FIX: ทำให้เวลา reactive
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
    }, 1000); // ปรับเป็น 500 ได้ถ้าอยากลื่นขึ้น

    return () => clearInterval(t);
  }, []);

  const present =
    !!deviceName && lastSeenAt !== null && now - lastSeenAt < SIGNAL_FRESH_MS;

  let status: AthleteSignalStatus = "none";
  if (present && phase === "in") {
    const heldLongEnough =
      inRangeSince !== null && now - inRangeSince >= STAY_DURATION_MS;
    const strong =
      smoothedRssi !== null && smoothedRssi >= RSSI_STRONG_THRESHOLD;
    status = heldLongEnough && strong ? "stay" : "in-range";
  }

  return { status, present, smoothedRssi, inRangeSince, lastSeenAt };
};
