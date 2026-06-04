export type DistanceUnit = "km" | "mi";

export type EventKind = "distance" | "time";

export interface RaceEvent {
  id: string;
  name: string;
  kind: EventKind;
  distanceKm?: number; // when kind === "distance"
  durationMinutes?: number; // when kind === "time"
  order: number;
  // Lap layout (only meaningful for kind === "distance"):
  //  - "fixed" (default): every checkpoint is the same distance (athlete.lapDistance).
  //  - "variable": each checkpoint has its own distance defined in lapDistancesKm.
  lapMode?: "fixed" | "variable";
  lapDistancesKm?: number[];
  // Km per lap for fixed-lap distance events; auto-applied to athletes assigned to this event.
  lapDistanceKm?: number;

export interface Athlete {
  id: string;
  name: string;
  lapDistance: number;
  unit: DistanceUnit;
  targetDistance: number;
  alertMinutes: number; // notify this many minutes before predicted ETA; 0 disables
  photoUrl?: string;
  createdAt: number;
  // Event + goal (additive, optional)
  eventId?: string;
  goalDistanceKm?: number; // when assigned event is "time"
  goalDurationMinutes?: number; // when assigned event is "distance"
  dashboardOrder?: number;
  // DNF (did not finish) — when true the athlete is treated as finished even
  // if they have not completed all laps / the event time has not elapsed.
  dnf?: boolean;
}

export interface Lap {
  id: string;
  athleteId: string;
  lapNumber: number;
  timestamp: number;
  lapTime: number; // seconds; 0 for first lap
  pace: number; // seconds per unit-distance
}

export interface NutritionPlanItem {
  id: string;
  label: string;
}

export interface NutritionPlan {
  athleteId: string;
  lapNumber: number;
  items: NutritionPlanItem[];
}

export interface NutritionLog {
  athleteId: string;
  lapNumber: number;
  // Items the athlete actually consumed. Kept for backward compatibility but
  // no longer the source of truth for the dashboard pills, which now default
  // to "received" and only track explicit skips via skippedItemIds.
  completedItemIds: string[];
  // Items the crew explicitly marked as NOT received.
  skippedItemIds?: string[];
}

export interface Settings {
  doubleTapThresholdMinutes: number;
}
