export type DistanceUnit = "km" | "mi";

export interface Athlete {
  id: string;
  name: string;
  lapDistance: number;
  unit: DistanceUnit;
  targetDistance: number;
  alertMinutes: number; // notify this many minutes before predicted ETA; 0 disables
  photoUrl?: string;
  createdAt: number;
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
  lapNumber: number; // 1-based, plan applies to this upcoming lap
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
