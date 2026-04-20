import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Athlete, Lap, NutritionLog, NutritionPlan, Settings } from "./types";

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

interface RaceState {
  athletes: Athlete[];
  laps: Lap[];
  plans: NutritionPlan[];
  logs: NutritionLog[];
  settings: Settings;
  selectedAthleteId: string | null;
  nutritionItems: string[]; // global shared catalog used by all athletes

  // athletes
  addAthlete: (a: Omit<Athlete, "id" | "createdAt">) => string;
  updateAthlete: (id: string, patch: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  selectAthlete: (id: string | null) => void;

  // laps
  recordLap: (athleteId: string) => Lap | null;
  deleteLap: (lapId: string) => void;
  lapsFor: (athleteId: string) => Lap[];

  // nutrition
  setPlan: (athleteId: string, lapNumber: number, items: NutritionPlan["items"]) => void;
  duplicatePlanToRange: (athleteId: string, fromLap: number, toStart: number, toEnd: number) => void;
  toggleLogItem: (athleteId: string, lapNumber: number, itemId: string) => void;
  planFor: (athleteId: string, lapNumber: number) => NutritionPlan | undefined;
  logFor: (athleteId: string, lapNumber: number) => NutritionLog | undefined;

  // shared nutrition catalog
  addNutritionItem: (label: string) => void;
  removeNutritionItem: (label: string) => void;

  // settings
  setDoubleTapMinutes: (m: number) => void;
}

export const useRaceStore = create<RaceState>()(
  persist(
    (set, get) => ({
      athletes: [],
      laps: [],
      plans: [],
      logs: [],
      settings: { doubleTapThresholdMinutes: 3 },
      selectedAthleteId: null,
      nutritionItems: ["Gel", "Water", "Electrolytes", "Banana", "Bar", "Salt cap", "Coke"],

      addNutritionItem: (label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        set((s) =>
          s.nutritionItems.includes(trimmed)
            ? s
            : { nutritionItems: [...s.nutritionItems, trimmed] }
        );
      },
      removeNutritionItem: (label) =>
        set((s) => ({
          nutritionItems: s.nutritionItems.filter((x) => x !== label),
          plans: s.plans.map((p) => ({
            ...p,
            items: p.items.filter((it) => it.label !== label),
          })),
        })),

      addAthlete: (a) => {
        const athlete: Athlete = { ...a, id: uid(), createdAt: Date.now() };
        set((s) => ({
          athletes: [...s.athletes, athlete],
          selectedAthleteId: s.selectedAthleteId ?? athlete.id,
        }));
        return athlete.id;
      },
      updateAthlete: (id, patch) =>
        set((s) => ({ athletes: s.athletes.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      deleteAthlete: (id) =>
        set((s) => ({
          athletes: s.athletes.filter((a) => a.id !== id),
          laps: s.laps.filter((l) => l.athleteId !== id),
          plans: s.plans.filter((p) => p.athleteId !== id),
          logs: s.logs.filter((l) => l.athleteId !== id),
          selectedAthleteId: s.selectedAthleteId === id ? null : s.selectedAthleteId,
        })),
      selectAthlete: (id) => set({ selectedAthleteId: id }),

      recordLap: (athleteId) => {
        const state = get();
        const athlete = state.athletes.find((a) => a.id === athleteId);
        if (!athlete) return null;
        const prior = state.laps.filter((l) => l.athleteId === athleteId).sort((a, b) => a.lapNumber - b.lapNumber);
        const now = Date.now();
        const last = prior[prior.length - 1];
        const lapTime = last ? (now - last.timestamp) / 1000 : 0;
        const pace = lapTime > 0 && athlete.lapDistance > 0 ? lapTime / athlete.lapDistance : 0;
        const lap: Lap = {
          id: uid(),
          athleteId,
          lapNumber: prior.length + 1,
          timestamp: now,
          lapTime,
          pace,
        };
        set((s) => ({ laps: [...s.laps, lap] }));
        return lap;
      },
      deleteLap: (lapId) =>
        set((s) => {
          const target = s.laps.find((l) => l.id === lapId);
          if (!target) return s;
          // Remove and renumber subsequent laps for that athlete
          const remaining = s.laps
            .filter((l) => l.id !== lapId)
            .sort((a, b) => a.timestamp - b.timestamp);
          const byAthlete: Record<string, Lap[]> = {};
          remaining.forEach((l) => {
            (byAthlete[l.athleteId] ||= []).push(l);
          });
          const recomputed: Lap[] = [];
          Object.values(byAthlete).forEach((arr) => {
            arr.sort((a, b) => a.timestamp - b.timestamp);
            arr.forEach((l, i) => {
              const prev = arr[i - 1];
              const lapTime = prev ? (l.timestamp - prev.timestamp) / 1000 : 0;
              const athlete = s.athletes.find((a) => a.id === l.athleteId);
              const pace = lapTime > 0 && athlete && athlete.lapDistance > 0 ? lapTime / athlete.lapDistance : 0;
              recomputed.push({ ...l, lapNumber: i + 1, lapTime, pace });
            });
          });
          return { laps: recomputed };
        }),
      lapsFor: (athleteId) =>
        get()
          .laps.filter((l) => l.athleteId === athleteId)
          .sort((a, b) => a.lapNumber - b.lapNumber),

      setPlan: (athleteId, lapNumber, items) =>
        set((s) => {
          const others = s.plans.filter((p) => !(p.athleteId === athleteId && p.lapNumber === lapNumber));
          return { plans: [...others, { athleteId, lapNumber, items }] };
        }),
      duplicatePlanToRange: (athleteId, fromLap, toStart, toEnd) => {
        const src = get().plans.find((p) => p.athleteId === athleteId && p.lapNumber === fromLap);
        if (!src) return;
        for (let n = toStart; n <= toEnd; n++) {
          if (n === fromLap) continue;
          get().setPlan(
            athleteId,
            n,
            src.items.map((i) => ({ ...i, id: uid() }))
          );
        }
      },
      toggleLogItem: (athleteId, lapNumber, itemId) =>
        set((s) => {
          const existing = s.logs.find((l) => l.athleteId === athleteId && l.lapNumber === lapNumber);
          if (!existing) {
            return {
              logs: [...s.logs, { athleteId, lapNumber, completedItemIds: [itemId] }],
            };
          }
          const has = existing.completedItemIds.includes(itemId);
          const updated: NutritionLog = {
            ...existing,
            completedItemIds: has
              ? existing.completedItemIds.filter((i) => i !== itemId)
              : [...existing.completedItemIds, itemId],
          };
          return {
            logs: s.logs.map((l) =>
              l.athleteId === athleteId && l.lapNumber === lapNumber ? updated : l
            ),
          };
        }),
      planFor: (athleteId, lapNumber) =>
        get().plans.find((p) => p.athleteId === athleteId && p.lapNumber === lapNumber),
      logFor: (athleteId, lapNumber) =>
        get().logs.find((l) => l.athleteId === athleteId && l.lapNumber === lapNumber),

      setDoubleTapMinutes: (m) => set((s) => ({ settings: { ...s.settings, doubleTapThresholdMinutes: m } })),
    }),
    {
      name: "ultracrew-store-v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export const newId = uid;
