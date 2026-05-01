import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRaceStore } from "@/lib/store";
import { isAthleteFinished, nextEta } from "@/lib/race";
import { cn } from "@/lib/utils";

const initial = (name: string) => (name.trim()[0] || "?").toUpperCase();

const UpcomingArrivals = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const allLaps = useRaceStore((s) => s.laps);
  const events = useRaceStore((s) => s.events);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const navigate = useNavigate();

  // tick every second so countdowns refresh
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return athletes
      .map((a) => {
        const laps = allLaps
          .filter((l) => l.athleteId === a.id)
          .sort((x, y) => x.lapNumber - y.lapNumber);
        const event = a.eventId ? events.find((e) => e.id === a.eventId) : undefined;
        const finished = isAthleteFinished(a, laps, event);
        const eta = nextEta(laps, a, event);
        if (!eta || finished) return null;
        const msLeft = eta - now;
        // include slightly overdue (negative) but drop very stale
        if (msLeft < -120_000) return null;
        return { athlete: a, msLeft };
      })
      .filter((x): x is { athlete: typeof athletes[number]; msLeft: number } => !!x)
      .sort((a, b) => a.msLeft - b.msLeft);
  }, [athletes, allLaps, events]);

  if (upcoming.length === 0) return null;

  const open = (id: string) => {
    selectAthlete(id);
    navigate("/athlete");
  };

  return (
    <section className="mb-3">
      <h2 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Upcoming arrivals
      </h2>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
        {upcoming.map(({ athlete, msLeft }) => {
          const minutes = Math.max(0, Math.ceil(msLeft / 60_000));
          const overdue = msLeft < -10_000;
          const urgent = !overdue && msLeft < 60_000;
          const soon = !overdue && !urgent && msLeft < 5 * 60_000;
          return (
            <button
              key={athlete.id}
              onClick={() => open(athlete.id)}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-2xl border bg-card p-2 text-center transition-colors",
                overdue
                  ? "border-destructive/70"
                  : urgent
                  ? "border-warning/60"
                  : "border-border hover:border-primary/60"
              )}
            >
              <div className="relative">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl">
                  {athlete.photoUrl && (
                    <AvatarImage src={athlete.photoUrl} alt={athlete.name} className="object-cover" />
                  )}
                  <AvatarFallback className="rounded-2xl text-lg font-bold">
                    {initial(athlete.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular leading-none shadow-sm",
                    overdue
                      ? "bg-destructive text-destructive-foreground"
                      : urgent
                      ? "bg-warning text-warning-foreground"
                      : soon
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  )}
                >
                  {overdue ? "!" : `${minutes}m`}
                </span>
              </div>
              <span className="w-full truncate text-xs font-semibold sm:text-sm">
                {athlete.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default UpcomingArrivals;
