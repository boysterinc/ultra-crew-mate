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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
        "relative overflow-hidden rounded-2xl border border-border gradient-card shadow-card transition-all flex flex-col",
        isUrgent && "border-warning/60 shadow-urgent",
        isOverdue && "border-destructive/70"
      )}
    >
      {isUrgent && <div className="absolute inset-x-0 top-0 h-1 gradient-urgent animate-pulse-urgent" />}

      <header className={cn("flex items-start justify-between gap-1", compact ? "px-2.5 pt-2.5" : "px-5 pt-4")}>
        <button onClick={goDetail} className={cn("flex-1 text-left min-w-0 flex items-center", compact ? "gap-1.5" : "gap-2")}>
          <Avatar className={cn("shrink-0", compact ? "h-5 w-5" : "h-7 w-7")}>
            {athlete.photoUrl && <AvatarImage src={athlete.photoUrl} alt={athlete.name} />}
            <AvatarFallback className={compact ? "text-[9px]" : "text-[11px]"}>
              {(athlete.name.trim()[0] || "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
          <h2 className={cn("font-bold leading-tight truncate", compact ? "text-[13px]" : "text-lg")}>{athlete.name}</h2>
          <p className={cn("text-muted-foreground tabular flex items-center gap-1.5 flex-wrap", compact ? "text-[10px]" : "text-xs")}>
            <span>
              <span className="text-foreground font-semibold">{lapsDone}</span>/{totalLaps}
            </span>
            {athlete.alertMinutes > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider">
                <Bell className="h-2.5 w-2.5" /> {athlete.alertMinutes}m
              </span>
            )}
            {finished && <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">Done</span>}
          </p>
          </div>
        </button>
        <div className="flex gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className={cn("text-muted-foreground", compact ? "h-6 w-6" : "h-8 w-8")} onClick={onEdit}>
            <Pencil className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
          <Button variant="ghost" size="icon" className={cn("text-muted-foreground hover:text-destructive", compact ? "h-6 w-6" : "h-8 w-8")} onClick={onDelete}>
            <Trash2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
      </header>

      <div className={cn(compact ? "px-2.5 pt-1.5" : "px-5 pt-3")}>
        <Progress value={progressPct} className={compact ? "h-1" : "h-1.5"} />
        <div className={cn("mt-1 flex justify-between text-muted-foreground tabular", compact ? "text-[9px]" : "text-[11px]")}>
          <span>{formatDistance(distance, athlete.unit)}</span>
          <span>{formatDistance(athlete.targetDistance, athlete.unit)}</span>
        </div>
      </div>

      <dl className={cn("grid grid-cols-3 text-center", compact ? "gap-1 px-2.5 pt-1.5" : "gap-2 px-5 pt-4")}>
        <Stat label={compact ? "Last" : "Last lap"} value={last && last.lapTime > 0 ? formatDuration(last.lapTime) : "—"} compact={compact} />
        <Stat label={compact ? "Pace" : "Avg pace"} value={avg > 0 ? formatPace(avg / athlete.lapDistance, athlete.unit) : "—"} compact={compact} />
        <Stat
          label={isOverdue ? (compact ? "Late" : "ETA (late)") : (compact ? "ETA" : "Next ETA")}
          value={eta && !finished ? formatShortClock(eta) : "—"}
          tone={isOverdue ? "destructive" : isUrgent ? "warning" : "default"}
          compact={compact}
        />
      </dl>

      {nextPlan && nextPlan.items.length > 0 && !finished && (
        <div className={cn("rounded-lg bg-secondary/80", compact ? "mx-2.5 mt-1.5 px-2 py-1.5" : "mx-5 mt-4 px-3 py-2.5")}>
          <div className="flex items-center justify-between">
            <p className={cn("font-semibold uppercase tracking-wider text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
              Lap {nextLapNumber}
            </p>
            <button onClick={goDetail} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className={compact ? "h-3 w-3" : "h-4 w-4"} />
            </button>
          </div>
          <div className={cn("mt-1 flex flex-wrap", compact ? "gap-1" : "gap-1.5")}>
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
                    "rounded-full border font-medium transition-colors",
                    compact ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2.5 py-0.5 text-xs",
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

      <div className={cn("mt-auto", compact ? "p-2.5 pt-2" : "p-5 pt-4")}>
        {finished ? (
          <div className={cn("flex items-center justify-center rounded-xl border border-success/40 bg-success/10 text-success font-bold uppercase tracking-wider", compact ? "h-10 text-[10px]" : "h-20")}>
            Race complete
          </div>
        ) : (
          <CheckpointButton athlete={athlete} lastTimestamp={last?.timestamp} size={compact ? "sm" : "md"} />
        )}
      </div>
    </article>
  );
};

const Stat = ({ label, value, tone = "default", compact = false }: { label: string; value: string; tone?: "default" | "warning" | "destructive"; compact?: boolean }) => (
  <div className="min-w-0">
    <p className={cn("font-semibold uppercase tracking-wider text-muted-foreground truncate", compact ? "text-[9px]" : "text-[10px]")}>{label}</p>
    <p
      className={cn(
        "tabular font-bold leading-tight truncate",
        compact ? "text-[12px]" : "text-base",
        tone === "warning" && "text-warning",
        tone === "destructive" && "text-destructive"
      )}
    >
      {value}
    </p>
  </div>
);

export default AthleteCard;
