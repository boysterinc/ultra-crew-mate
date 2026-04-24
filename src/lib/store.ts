import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { Athlete, Lap, NutritionLog, NutritionPlan, RaceEvent, Settings } from "./types";

const STORAGE_KEY = "ultraCrewData";

// Debounced localStorage writer — coalesces rapid state changes into a single write.
const createDebouncedStorage = (delay = 150): StateStorage => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pending = new Map<string, string>();

  const flush = (key: string) => {
    const value = pending.get(key);
    if (value === undefined) return;
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.error("[ultraCrewData] failed to persist", err);
    }
    pending.delete(key);
    timers.delete(key);
  };

  if (typeof window !== "undefined") {
    // Make sure pending writes are flushed before the tab is closed/hidden.
    const flushAll = () => {
      timers.forEach((t) => clearTimeout(t));
      Array.from(pending.keys()).forEach(flush);
    };
    window.addEventListener("beforeunload", flushAll);
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAll();
    });
  }

  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name);
        if (!raw) return null;
        // Validate it's parseable JSON; otherwise treat as corrupted and discard.
        JSON.parse(raw);
        return raw;
      } catch (err) {
        console.warn("[ultraCrewData] corrupted data, resetting", err);
        try {
          localStorage.removeItem(name);
        } catch {
          /* ignore */
        }
        return null;
      }
    },
    setItem: (name, value) => {
      pending.set(name, value);
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => flush(name), delay)
      );
    },
    removeItem: (name) => {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      pending.delete(name);
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Distance (in athlete unit) of lap N (1-based), honoring variable-distance events.
const lapUnitDistance = (athlete: Athlete | undefined, lapNumber: number, events: RaceEvent[]): number => {
  if (!athlete) return 0;
  if (athlete.eventId) {
    const ev = events.find((e) => e.id === athlete.eventId);
    if (ev?.kind === "distance" && ev.lapMode === "variable" && ev.lapDistancesKm?.length) {
      const arr = ev.lapDistancesKm.filter((d) => d > 0);
      const km = arr[Math.min(Math.max(0, lapNumber - 1), arr.length - 1)] ?? 0;
      return athlete.unit === "mi" ? km / 1.609344 : km;
    }
  }
  return athlete.lapDistance;
};

interface RaceState {
  athletes: Athlete[];
  laps: Lap[];
  plans: NutritionPlan[];
  logs: NutritionLog[];
  events: RaceEvent[];
  settings: Settings;
  selectedAthleteId: string | null;
  nutritionItems: string[]; // global shared catalog used by all athletes

  // athletes
  addAthlete: (a: Omit<Athlete, "id" | "createdAt">) => string;
  updateAthlete: (id: string, patch: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  selectAthlete: (id: string | null) => void;

  // laps (declared in laps section below too)
  addManualLap: (athleteId: string, timestamp: number) => Lap | null;
  updateLapTimestamp: (lapId: string, timestamp: number) => void;

  // events
  addEvent: (e: Omit<RaceEvent, "id" | "order">) => string;
  updateEvent: (id: string, patch: Partial<RaceEvent>) => void;
  deleteEvent: (id: string) => void;
  reorderEvents: (orderedIds: string[]) => void;
  reorderAthletesInEvent: (eventId: string | null, orderedIds: string[]) => void;

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
  renameNutritionItem: (oldLabel: string, newLabel: string) => void;
  reorderNutritionItems: (orderedLabels: string[]) => void;

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
      events: [],
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
      renameNutritionItem: (oldLabel, newLabel) => {
        const trimmed = newLabel.trim();
        if (!trimmed || oldLabel === trimmed) return;
        set((s) => {
          if (!s.nutritionItems.includes(oldLabel)) return s;
          if (s.nutritionItems.includes(trimmed)) return s; // collision
          return {
            nutritionItems: s.nutritionItems.map((x) => (x === oldLabel ? trimmed : x)),
            plans: s.plans.map((p) => ({
              ...p,
              items: p.items.map((it) => (it.label === oldLabel ? { ...it, label: trimmed } : it)),
            })),
          };
        });
      },
      reorderNutritionItems: (orderedLabels) =>
        set((s) => {
          const known = orderedLabels.filter((l) => s.nutritionItems.includes(l));
          const rest = s.nutritionItems.filter((l) => !known.includes(l));
          return { nutritionItems: [...known, ...rest] };
        }),

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

      addEvent: (e) => {
        const id = uid();
        set((s) => {
          const order = s.events.length > 0 ? Math.max(...s.events.map((x) => x.order)) + 1 : 0;
          const ev: RaceEvent = { ...e, id, order };
          return { events: [...s.events, ev] };
        });
        return id;
      },
      updateEvent: (id, patch) =>
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteEvent: (id) =>
        set((s) => ({
          events: s.events.filter((e) => e.id !== id),
          athletes: s.athletes.map((a) =>
            a.eventId === id ? { ...a, eventId: undefined, goalDistanceKm: undefined, goalDurationMinutes: undefined } : a
          ),
        })),
      reorderEvents: (orderedIds) =>
        set((s) => ({
          events: s.events.map((e) => {
            const idx = orderedIds.indexOf(e.id);
            return idx >= 0 ? { ...e, order: idx } : e;
          }),
        })),
      reorderAthletesInEvent: (eventId, orderedIds) =>
        set((s) => ({
          athletes: s.athletes.map((a) => {
            const sameGroup = (a.eventId ?? null) === (eventId ?? null);
            if (!sameGroup) return a;
            const idx = orderedIds.indexOf(a.id);
            return idx >= 0 ? { ...a, dashboardOrder: idx } : a;
          }),
        })),

      addManualLap: (athleteId, timestamp) => {
        const state = get();
        const athlete = state.athletes.find((a) => a.id === athleteId);
        if (!athlete) return null;
        const ts = Math.min(Date.now(), Math.max(0, timestamp));
        const newLap: Lap = {
          id: uid(),
          athleteId,
          lapNumber: 0, // recomputed below
          timestamp: ts,
          lapTime: 0,
          pace: 0,
        };
        let inserted: Lap | null = null;
        set((s) => {
          const all = [...s.laps, newLap].sort((a, b) => a.timestamp - b.timestamp);
          const byAthlete: Record<string, Lap[]> = {};
          all.forEach((l) => {
            (byAthlete[l.athleteId] ||= []).push(l);
          });
          const recomputed: Lap[] = [];
          Object.values(byAthlete).forEach((arr) => {
            arr.sort((a, b) => a.timestamp - b.timestamp);
            arr.forEach((l, i) => {
              const prev = arr[i - 1];
              const lapTime = prev ? (l.timestamp - prev.timestamp) / 1000 : 0;
              const ath = s.athletes.find((a) => a.id === l.athleteId);
              const lapKm = lapUnitDistance(ath, i + 1, s.events);
              const pace = lapTime > 0 && lapKm > 0 ? lapTime / lapKm : 0;
              const updated = { ...l, lapNumber: i + 1, lapTime, pace };
              if (l.id === newLap.id) inserted = updated;
              recomputed.push(updated);
            });
          });
          return { laps: recomputed };
        });
        return inserted;
      },

      updateLapTimestamp: (lapId, timestamp) => {
        const ts = Math.min(Date.now(), Math.max(0, timestamp));
        set((s) => {
          if (!s.laps.some((l) => l.id === lapId)) return s;
          const all = s.laps.map((l) => (l.id === lapId ? { ...l, timestamp: ts } : l));
          const byAthlete: Record<string, Lap[]> = {};
          all.forEach((l) => {
            (byAthlete[l.athleteId] ||= []).push(l);
          });
          const recomputed: Lap[] = [];
          Object.values(byAthlete).forEach((arr) => {
            arr.sort((a, b) => a.timestamp - b.timestamp);
            arr.forEach((l, i) => {
              const prev = arr[i - 1];
              const lapTime = prev ? (l.timestamp - prev.timestamp) / 1000 : 0;
              const ath = s.athletes.find((a) => a.id === l.athleteId);
              const lapKm = lapUnitDistance(ath, i + 1, s.events);
              const pace = lapTime > 0 && lapKm > 0 ? lapTime / lapKm : 0;
              recomputed.push({ ...l, lapNumber: i + 1, lapTime, pace });
            });
          });
          return { laps: recomputed };
        });
      },

      recordLap: (athleteId) => {
        const state = get();
        const athlete = state.athletes.find((a) => a.id === athleteId);
        if (!athlete) return null;
        const prior = state.laps.filter((l) => l.athleteId === athleteId).sort((a, b) => a.lapNumber - b.lapNumber);
        const now = Date.now();
        const last = prior[prior.length - 1];
        const lapTime = last ? (now - last.timestamp) / 1000 : 0;
        const lapNumber = prior.length + 1;
        const lapKm = lapUnitDistance(athlete, lapNumber, state.events);
        const pace = lapTime > 0 && lapKm > 0 ? lapTime / lapKm : 0;
        const lap: Lap = {
          id: uid(),
          athleteId,
          lapNumber,
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
              const lapKm = lapUnitDistance(athlete, i + 1, s.events);
              const pace = lapTime > 0 && lapKm > 0 ? lapTime / lapKm : 0;
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
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => createDebouncedStorage(150)),
      partialize: (state) => ({
        athletes: state.athletes,
        laps: state.laps,
        plans: state.plans,
        logs: state.logs,
        events: state.events,
        settings: state.settings,
        selectedAthleteId: state.selectedAthleteId,
        nutritionItems: state.nutritionItems,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("[ultraCrewData] rehydrate failed, using defaults", error);
        }
      },
    }
  )
);

export const newId = uid;
