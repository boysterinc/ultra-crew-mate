import { useEffect } from "react";
import { useRaceStore } from "@/lib/store";
import { useRankingsStore } from "@/lib/rankingsStore";

const REFRESH_MS = 5 * 60_000; // 5 minutes

/**
 * Poll every configured race event's public results URL and refresh
 * per-BIB rank data. Fires initial fetch on mount, then every 5min.
 */
export function useRankingsPoller() {
  const events = useRaceStore((s) => s.events);
  const athletes = useRaceStore((s) => s.athletes);
  const fetchForEvent = useRankingsStore((s) => s.fetchForEvent);

  useEffect(() => {
    const tick = () => {
      events.forEach((ev) => {
        if (!ev.resultsUrl) return;
        const bibs = athletes
          .filter((a) => a.eventId === ev.id && a.bib && a.bib.trim())
          .map((a) => a.bib!.trim());
        if (bibs.length === 0) return;
        fetchForEvent(ev.id, ev.resultsUrl, bibs);
      });
    };
    tick();
    const t = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [events, athletes, fetchForEvent]);
}
