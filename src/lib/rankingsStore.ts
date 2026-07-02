import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { AthleteRanking } from "./types";

interface RankingsState {
  // eventId -> bib -> ranking
  byEvent: Record<string, Record<string, AthleteRanking>>;
  loadingEvent: Record<string, boolean>;
  lastFetchedAt: Record<string, number>;
  lastError: Record<string, string | undefined>;
  fetchForEvent: (eventId: string, url: string, bibs: string[]) => Promise<void>;
  getRanking: (eventId: string | undefined, bib: string | undefined) => AthleteRanking | undefined;
}

export const useRankingsStore = create<RankingsState>((set, get) => ({
  byEvent: {},
  loadingEvent: {},
  lastFetchedAt: {},
  lastError: {},

  fetchForEvent: async (eventId, url, bibs) => {
    if (!url || bibs.length === 0) return;
    if (get().loadingEvent[eventId]) return;
    set((s) => ({ loadingEvent: { ...s.loadingEvent, [eventId]: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("fetch-ranking", {
        body: { url, bibs },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const rankings: Array<{ bib: string; rank: number | null; time?: string | null; status?: string | null; lastCheckpoint?: string | null }> =
        data?.rankings ?? [];
      const now = Date.now();
      const map: Record<string, AthleteRanking> = { ...(get().byEvent[eventId] ?? {}) };
      rankings.forEach((r) => {
        if (!r?.bib) return;
        map[String(r.bib)] = {
          rank: r.rank ?? null,
          time: r.time ?? null,
          status: r.status ?? null,
          lastCheckpoint: r.lastCheckpoint ?? null,
          updatedAt: now,
        };
      });

      set((s) => ({
        byEvent: { ...s.byEvent, [eventId]: map },
        lastFetchedAt: { ...s.lastFetchedAt, [eventId]: now },
        lastError: { ...s.lastError, [eventId]: undefined },
      }));
    } catch (err) {
      console.error("[rankings] fetch failed", err);
      set((s) => ({
        lastError: { ...s.lastError, [eventId]: (err as Error).message },
      }));
    } finally {
      set((s) => ({ loadingEvent: { ...s.loadingEvent, [eventId]: false } }));
    }
  },

  getRanking: (eventId, bib) => {
    if (!eventId || !bib) return undefined;
    return get().byEvent[eventId]?.[String(bib)];
  },
}));
