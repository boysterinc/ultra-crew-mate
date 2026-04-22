export type DistanceUnit = "km" | "mi";

export type EventKind = "distance" | "time";

export interface RaceEvent {
  id: string;
  name: string;
  kind: EventKind;
  distanceKm?: number; // when kind === "distance"
  durationMinutes?: number; // when kind === "time"
  order: number;
}

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
  completedItemIds: string[];
}

export interface Settings {
  doubleTapThresholdMinutes: number;
}
