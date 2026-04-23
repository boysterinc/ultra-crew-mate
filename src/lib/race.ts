import { Athlete, Lap, RaceEvent } from "./types";

const KM_PER_MI = 1.609344;
const toUnit = (km: number, unit: "km" | "mi") => (unit === "mi" ? km / KM_PER_MI : km);
const toKm = (val: number, unit: "km" | "mi") => (unit === "mi" ? val * KM_PER_MI : val);

/**
 * Per-lap distances in the athlete's display unit.
 *  - Variable event: derives from event.lapDistancesKm (converted into athlete unit).
 *  - Otherwise: repeats athlete.lapDistance up to totalLapsFor(athlete).
 */
export function lapDistancesFor(a: Athlete, event?: RaceEvent | null): number[] {
  if (event && event.kind === "distance" && event.lapMode === "variable" && event.lapDistancesKm?.length) {
    return event.lapDistancesKm
      .filter((d) => d > 0)
      .map((km) => toUnit(km, a.unit));
  }
  if (a.lapDistance <= 0 || a.targetDistance <= 0) return [];
  const n = Math.max(1, Math.ceil(a.targetDistance / a.lapDistance));
  return Array.from({ length: n }, () => a.lapDistance);
}

export function totalLapsFor(a: Athlete, event?: RaceEvent | null): number {
  if (event && event.kind === "distance" && event.lapMode === "variable" && event.lapDistancesKm?.length) {
    return event.lapDistancesKm.filter((d) => d > 0).length;
  }
  if (a.lapDistance <= 0) return 0;
  return Math.max(1, Math.ceil(a.targetDistance / a.lapDistance));
}

export function distanceCovered(a: Athlete, lapsCount: number, event?: RaceEvent | null): number {
  const dists = lapDistancesFor(a, event);
  if (dists.length === 0) return Math.min(a.targetDistance, lapsCount * a.lapDistance);
  const sum = dists.slice(0, Math.max(0, Math.min(lapsCount, dists.length))).reduce((s, d) => s + d, 0);
  // For variable events, "target" is the sum of all lap distances.
  const target = event && event.kind === "distance" && event.lapMode === "variable"
    ? dists.reduce((s, d) => s + d, 0)
    : a.targetDistance;
  return Math.min(target, sum);
}

/**
 * Distance (in athlete unit) of the next upcoming lap.
 * Falls back to athlete.lapDistance when no per-lap data is available.
 */
export function nextLapDistance(a: Athlete, lapsDone: number, event?: RaceEvent | null): number {
  const dists = lapDistancesFor(a, event);
  if (dists.length === 0) return a.lapDistance;
  if (lapsDone >= dists.length) return dists[dists.length - 1] ?? a.lapDistance;
  return dists[lapsDone];
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
 * Recent average pace (sec/km) from measured laps. We use lap.pace (sec/unit)
 * because it was computed against the actual distance of that lap, even when
 * the athlete is on a variable-distance event.
 */
export function avgRecentPaceSecPerKm(laps: Lap[], unit: "km" | "mi", window = 3): number {
  const measured = laps.filter((l) => l.lapTime > 0 && l.pace > 0);
  if (measured.length === 0) return 0;
  const slice = measured.slice(-window);
  const avgSecPerUnit = slice.reduce((acc, l) => acc + l.pace, 0) / slice.length;
  // pace stored is sec/unit (athlete unit). Convert to sec/km.
  return unit === "mi" ? avgSecPerUnit / KM_PER_MI : avgSecPerUnit;
}

/**
 * Goal-derived pace (seconds per km) for an athlete, using their assigned event/goal.
 *  - distance event with goal duration: pace = goalDuration / totalDistance
 *  - time event with goal distance: pace = eventDuration / goalDistance
 */
export function goalPaceSecPerKm(a: Athlete, event?: RaceEvent | null): number {
  if (a.goalDurationMinutes && a.goalDurationMinutes > 0) {
    // Distance event: total km is event.distanceKm OR sum of variable lap distances OR athlete target
    let totalKm = 0;
    if (event?.kind === "distance") {
      if (event.lapMode === "variable" && event.lapDistancesKm?.length) {
        totalKm = event.lapDistancesKm.reduce((s, d) => s + d, 0);
      } else if (event.distanceKm) {
        totalKm = event.distanceKm;
      }
    }
    if (totalKm <= 0) totalKm = toKm(a.targetDistance, a.unit);
    if (totalKm > 0) return (a.goalDurationMinutes * 60) / totalKm;
  }
  if (a.goalDistanceKm && a.goalDistanceKm > 0 && event?.kind === "time" && event.durationMinutes) {
    return (event.durationMinutes * 60) / a.goalDistanceKm;
  }
  return 0;
}

/**
 * Predicted lap time (seconds) for the *next* lap, derived from athlete's goal.
 * Uses next-lap distance so variable events are handled naturally.
 */
export function goalLapTime(a: Athlete, event?: RaceEvent | null, lapsDone = 0): number {
  const paceSecPerKm = goalPaceSecPerKm(a, event);
  if (paceSecPerKm <= 0) return 0;
  const nextKm = toKm(nextLapDistance(a, lapsDone, event), a.unit);
  return paceSecPerKm * nextKm;
}

/**
 * ETA timestamp for the *next* checkpoint.
 *  - if measured pace exists → use latest pace × next lap distance
 *  - else if a goal-derived pace exists → use that × next lap distance
 *  - else 0
 */
export function nextEta(laps: Lap[], a: Athlete, event?: RaceEvent | null): number {
  if (laps.length === 0) return 0;
  const last = laps[laps.length - 1];
  const lapsDone = laps.length;
  const nextKm = toKm(nextLapDistance(a, lapsDone, event), a.unit);

  const measuredPaceSecPerKm = avgRecentPaceSecPerKm(laps, a.unit);
  if (measuredPaceSecPerKm > 0 && nextKm > 0) {
    return last.timestamp + measuredPaceSecPerKm * nextKm * 1000;
  }
  const goalPaceSec = goalPaceSecPerKm(a, event);
  if (goalPaceSec > 0 && nextKm > 0) {
    return last.timestamp + goalPaceSec * nextKm * 1000;
  }
  // Fallback to legacy avg lap time
  const avg = avgRecentLapTime(laps);
  if (avg > 0) return last.timestamp + avg * 1000;
  return 0;
}
