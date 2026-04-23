import { Athlete, Lap } from "./types";

export function totalLapsFor(a: Athlete): number {
  if (a.lapDistance <= 0) return 0;
  return Math.max(1, Math.ceil(a.targetDistance / a.lapDistance));
}

export function avgRecentLapTime(laps: Lap[], window = 3): number {
  // Use only laps with measured lapTime (skip first lap with 0)
  const measured = laps.filter((l) => l.lapTime > 0);
  if (measured.length === 0) return 0;
  const slice = measured.slice(-window);
  const sum = slice.reduce((acc, l) => acc + l.lapTime, 0);
  return sum / slice.length;
}

/**
 * Predicted lap time (seconds) derived from the athlete's finishing-time goal.
 * Used as a fallback before any real lap data exists.
 *  - distance event with goal duration: (goalMinutes*60) / totalLaps
 *  - time event with goal distance: (eventMinutes*60) / projectedTotalLaps
 *    where projectedTotalLaps ≈ goalDistanceKm / lapKm
 *  - otherwise: targetDistance/totalLaps using a reasonable fallback (none)
 */
export function goalLapTime(a: Athlete, eventDurationMinutes?: number, eventDistanceKm?: number): number {
  const totalLaps = totalLapsFor(a);
  if (totalLaps <= 0 || a.lapDistance <= 0) return 0;

  // Distance-based event with a finishing-time goal
  if (a.goalDurationMinutes && a.goalDurationMinutes > 0) {
    return (a.goalDurationMinutes * 60) / totalLaps;
  }

  // Time-based event with a distance goal: pace = duration / distance, lapTime = pace * lapKm
  if (a.goalDistanceKm && a.goalDistanceKm > 0 && eventDurationMinutes && eventDurationMinutes > 0) {
    const lapKm = a.unit === "mi" ? a.lapDistance * 1.609344 : a.lapDistance;
    const paceSecPerKm = (eventDurationMinutes * 60) / a.goalDistanceKm;
    return paceSecPerKm * lapKm;
  }

  return 0;
}

/**
 * ETA for the next lap timestamp.
 *  - if recent measured laps exist → average of recent lap times from last lap timestamp
 *  - else if a start lap exists and goalLapTimeSec > 0 → start + goalLapTimeSec
 *  - else 0
 */
export function nextEta(laps: Lap[], goalLapTimeSec = 0): number {
  if (laps.length === 0) return 0;
  const last = laps[laps.length - 1];
  const avg = avgRecentLapTime(laps);
  if (avg > 0) return last.timestamp + avg * 1000;
  if (goalLapTimeSec > 0) return last.timestamp + goalLapTimeSec * 1000;
  return 0;
}

export function distanceCovered(a: Athlete, lapsCount: number): number {
  return Math.min(a.targetDistance, lapsCount * a.lapDistance);
}
