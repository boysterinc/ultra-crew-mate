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

export function nextEta(laps: Lap[]): number {
  if (laps.length === 0) return 0;
  const last = laps[laps.length - 1];
  const avg = avgRecentLapTime(laps);
  if (avg <= 0) return 0;
  return last.timestamp + avg * 1000;
}

export function distanceCovered(a: Athlete, lapsCount: number): number {
  return Math.min(a.targetDistance, lapsCount * a.lapDistance);
}
