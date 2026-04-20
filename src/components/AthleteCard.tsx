import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Athlete } from "@/lib/types";
import { useRaceStore } from "@/lib/store";
import { totalLapsFor, distanceCovered, avgRecentLapTime, nextEta } from "@/lib/race";
import { formatDuration, formatPace, formatShortClock, formatDistance } from "@/lib/format";
import CheckpointButton from "./CheckpointButton";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Trash2, Pencil, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AthleteCardProps {
  athlete: Athlete;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}

const AthleteCard = ({ athlete, onEdit, onDelete, compact = false }: AthleteCardProps) => {
  const allLaps = useRaceStore((s) => s.laps);
  const laps = useMemo(
    () => allLaps.filter((l) => l.athleteId === athlete.id).sort((a, b) => a.lapNumber - b.lapNumber),
    [allLaps, athlete.id]
  );
  const planFor = useRaceStore((s) => s.planFor);
  const logFor = useRaceStore((s) => s.logFor);
  const toggleLogItem = useRaceStore((s) => s.toggleLogItem);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const navigate = useNavigate();

  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const totalLaps = totalLapsFor(athlete);
  const lapsDone = laps.length;
  const finished = lapsDone >= totalLaps;
  const last = laps[laps.length - 1];
  const avg = avgRecentLapTime(laps);
  const eta = nextEta(laps);
  const distance = distanceCovered(athlete, lapsDone);
  const progressPct = Math.min(100, (distance / athlete.targetDistance) * 100);

  const msToEta = eta ? eta - Date.now() : 0;
  const alertMs = (athlete.alertMinutes ?? 0) * 60_000;
  const alertActive = !!eta && !finished && alertMs > 0 && msToEta <= alertMs && msToEta > -120_000;
  const isUrgent = alertActive || (!!eta && !finished && msToEta < 60_000 && msToEta > -120_000);
  const isOverdue = !!eta && !finished && msToEta < -10_000;

  // Fire a one-time alert per upcoming lap when crossing the threshold
  const alertedLapRef = useRef<number | null>(null);
  useEffect(() => {
    if (!alertActive) return;
    if (alertedLapRef.current === lapsDone) return;
    alertedLapRef.current = lapsDone;
    toast.warning(`${athlete.name} arriving in ~${Math.max(0, Math.round(msToEta / 60000))} min`, {
      description: `Lap ${lapsDone + 1} of ${totalLaps}`,
    });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [alertActive, lapsDone, athlete.name, msToEta, totalLaps]);

  const nextLapNumber = lapsDone + 1;
  const nextPlan = planFor(athlete.id, nextLapNumber);

  const goDetail = () => {
    selectAthlete(athlete.id);
    navigate("/athlete");
  };

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border gradient-card shadow-card transition-all",
        isUrgent && "border-warning/60 shadow-urgent",
        isOverdue && "border-destructive/70"
      )}
    >
      {isUrgent && <div className="absolute inset-x-0 top-0 h-1 gradient-urgent animate-pulse-urgent" />}

      <header className="flex items-start justify-between gap-2 px-5 pt-4">
        <button onClick={goDetail} className="flex-1 text-left">
          <h2 className="text-lg font-bold leading-tight">{athlete.name}</h2>
          <p className="text-xs text-muted-foreground tabular flex items-center gap-2 flex-wrap">
            <span>
              Lap <span className="text-foreground font-semibold">{lapsDone}</span> / {totalLaps}
            </span>
            {athlete.alertMinutes > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
                <Bell className="h-3 w-3" /> {athlete.alertMinutes}m
              </span>
            )}
            {finished && <span className="ml-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success">Finished</span>}
          </p>
        </button>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="px-5 pt-3">
        <Progress value={progressPct} className="h-1.5" />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular">
          <span>{formatDistance(distance, athlete.unit)}</span>
          <span>{formatDistance(athlete.targetDistance, athlete.unit)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 px-5 pt-4 text-center">
        <Stat label="Last lap" value={last && last.lapTime > 0 ? formatDuration(last.lapTime) : "—"} />
        <Stat label="Avg pace" value={avg > 0 ? formatPace(avg / athlete.lapDistance, athlete.unit) : "—"} />
        <Stat
          label={isOverdue ? "ETA (late)" : "Next ETA"}
          value={eta && !finished ? formatShortClock(eta) : "—"}
          tone={isOverdue ? "destructive" : isUrgent ? "warning" : "default"}
        />
      </dl>

      {nextPlan && nextPlan.items.length > 0 && !finished && (
        <div className="mx-5 mt-4 rounded-xl bg-secondary/80 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lap {nextLapNumber} nutrition
            </p>
            <button onClick={goDetail} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nextPlan.items.map((it) => {
              const log = logFor(athlete.id, nextLapNumber);
              const done = !!log?.completedItemIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLogItem(athlete.id, nextLapNumber, it.id);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    done
                      ? "border-primary bg-primary text-primary-foreground line-through opacity-70"
                      : "border-border bg-card text-foreground hover:border-primary/60"
                  )}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-5 pt-4">
        {finished ? (
          <div className="flex h-20 items-center justify-center rounded-2xl border border-success/40 bg-success/10 text-success font-bold uppercase tracking-wider">
            Race complete
          </div>
        ) : (
          <CheckpointButton athlete={athlete} lastTimestamp={last?.timestamp} />
        )}
      </div>
    </article>
  );
};

const Stat = ({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "destructive" }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p
      className={cn(
        "tabular text-base font-bold leading-tight",
        tone === "warning" && "text-warning",
        tone === "destructive" && "text-destructive"
      )}
    >
      {value}
    </p>
  </div>
);

export default AthleteCard;
