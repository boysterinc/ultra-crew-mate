import { useEffect, useMemo, useRef, useState, HTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { Athlete, RaceEvent } from "@/lib/types";
import { useRaceStore } from "@/lib/store";
import { totalLapsFor, distanceCovered, avgRecentLapTime, nextEta, goalLapTime, isAthleteFinished } from "@/lib/race";
import { formatPace, formatShortClock, formatDistance, formatHM } from "@/lib/format";
import CheckpointButton from "./CheckpointButton";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, Trash2, Pencil, Bell, GripVertical, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { speakArrival } from "@/lib/speech";
import { useDeviceMappingStore } from "@/lib/deviceMapping";
import { useAthleteSignal } from "@/lib/autoLapStatus";
import { useRankingsStore } from "@/lib/rankingsStore";

interface AthleteCardProps {
  athlete: Athlete;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

const AthleteCard = ({ athlete, onEdit, onDelete, compact = false, dragHandleProps }: AthleteCardProps) => {
  const allLaps = useRaceStore((s) => s.laps);
  const laps = useMemo(
    () => allLaps.filter((l) => l.athleteId === athlete.id).sort((a, b) => a.lapNumber - b.lapNumber),
    [allLaps, athlete.id]
  );
  const planFor = useRaceStore((s) => s.planFor);
  const logFor = useRaceStore((s) => s.logFor);
  const toggleSkipItem = useRaceStore((s) => s.toggleSkipItem);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const events = useRaceStore((s) => s.events);
  const event: RaceEvent | undefined = athlete.eventId ? events.find((e) => e.id === athlete.eventId) : undefined;
  const navigate = useNavigate();

  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const totalLaps = totalLapsFor(athlete, event);
  const lapsDone = laps.length;
  const finished = isAthleteFinished(athlete, laps, event);
  const last = laps[laps.length - 1];
  const measuredAvg = avgRecentLapTime(laps);
  const goalLap = goalLapTime(athlete, event, lapsDone);
  // Use measured pace once available, otherwise fall back to the goal pace.
  const avg = measuredAvg > 0 ? measuredAvg : goalLap;
  const eta = nextEta(laps, athlete, event);
  const distance = distanceCovered(athlete, lapsDone, event);
  const progressTarget = event?.kind === "distance" && event.lapMode === "variable" && event.lapDistancesKm?.length
    ? event.lapDistancesKm.reduce((s, d) => s + (athlete.unit === "mi" ? d / 1.609344 : d), 0)
    : athlete.targetDistance;
  const progressPct = progressTarget > 0 ? Math.min(100, (distance / progressTarget) * 100) : 0;

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
    speakArrival(athlete.name);
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
          <div className="flex items-center gap-2 min-w-0">
            <h2 className={cn("font-bold leading-tight truncate flex-1 min-w-0", compact ? "text-base sm:text-lg md:text-xl lg:text-2xl" : "text-xl md:text-2xl lg:text-3xl")}>
              {athlete.name}
              {athlete.bib && (
                <span className={cn("ml-1.5 tabular font-semibold text-muted-foreground", compact ? "text-xs sm:text-sm md:text-base" : "text-sm md:text-base lg:text-lg")}>#{athlete.bib}</span>
              )}
              <RankBadge athlete={athlete} compact={compact} />
            </h2>
            <DeviceWatchIndicator athleteId={athlete.id} compact={compact} />
            <span className={cn("tabular shrink-0 text-muted-foreground", compact ? "text-sm sm:text-base md:text-lg lg:text-xl" : "text-base md:text-lg lg:text-xl")}>
              <span className="text-foreground font-semibold">{lapsDone}</span>/{totalLaps}
            </span>
            {athlete.alertMinutes > 0 && (
              <span className="inline-flex items-center gap-0.5 shrink-0 rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold">
                <Bell className="h-3 w-3" /> {athlete.alertMinutes}m
              </span>
            )}
          </div>
          {finished && (
            <p className="mt-0.5">
              <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-success">Done</span>
            </p>
          )}
          </div>
        </button>
        <div className="flex gap-0.5 shrink-0">
          {dragHandleProps && (
            <button
              type="button"
              {...dragHandleProps}
              aria-label="Drag to reorder"
              className={cn(
                "flex items-center justify-center text-muted-foreground hover:text-foreground touch-none cursor-grab active:cursor-grabbing rounded-md",
                compact ? "h-6 w-5" : "h-8 w-6"
              )}
              onClick={(e) => e.preventDefault()}
            >
              <GripVertical className={compact ? "h-3 w-3" : "h-4 w-4"} />
            </button>
          )}
          <Button variant="ghost" size="icon" className={cn("text-muted-foreground", compact ? "h-6 w-6" : "h-8 w-8")} onClick={onEdit}>
            <Pencil className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
          <Button variant="ghost" size="icon" className={cn("text-muted-foreground hover:text-destructive", compact ? "h-6 w-6" : "h-8 w-8")} onClick={onDelete}>
            <Trash2 className={compact ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
      </header>

      {event && (athlete.goalDistanceKm || athlete.goalDurationMinutes) && (
        <GoalLine athlete={athlete} event={event} avgLapSec={avg} lapsDone={lapsDone} compact={compact} />
      )}

      <div className={cn(compact ? "px-2.5 pt-1.5" : "px-5 pt-3")}>
        <Progress value={progressPct} className={compact ? "h-1" : "h-1.5"} />
        <div className={cn("mt-1 flex justify-between text-muted-foreground tabular", compact ? "text-[9px]" : "text-[11px]")}>
          <span>{formatDistance(distance, athlete.unit)}</span>
          <span>{formatDistance(athlete.targetDistance, athlete.unit)}</span>
        </div>
      </div>

      <dl className={cn("grid grid-cols-2 text-center", compact ? "gap-1 px-2.5 pt-1.5" : "gap-2 px-5 pt-4")}>
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
              const skipped = !!log?.skippedItemIds?.includes(it.id);
              const received = !skipped; // default to received
              return (
                <button
                  key={it.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSkipItem(athlete.id, nextLapNumber, it.id);
                  }}
                  className={cn(
                    "rounded-full border font-medium transition-colors",
                    compact ? "px-2 py-1 text-sm sm:text-base md:text-lg lg:text-xl leading-tight" : "px-3 py-1 text-base md:text-lg lg:text-xl",
                    received
                      ? "border-success bg-success text-success-foreground"
                      : "border-border bg-card text-muted-foreground line-through hover:border-primary/60"
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
          <CheckpointButton athlete={athlete} lastTimestamp={last?.timestamp} size={compact ? "sm" : "md"} isStart={lapsDone === 0} />
        )}
      </div>
    </article>
  );
};

const Stat = ({ label, value, tone = "default", compact = false }: { label: string; value: string; tone?: "default" | "warning" | "destructive"; compact?: boolean }) => (
  <div className="min-w-0 flex flex-col items-center sm:flex-row sm:items-baseline sm:justify-center gap-0.5 sm:gap-1">
    <span className={cn("text-muted-foreground font-medium uppercase tracking-wider truncate", compact ? "text-[9px] sm:text-[10px] md:text-[11px]" : "text-[10px] md:text-xs")}>{label}</span>
    <span
      className={cn(
        "tabular font-bold leading-tight truncate",
        compact ? "text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl" : "text-xl sm:text-2xl md:text-3xl lg:text-4xl",
        tone === "warning" && "text-warning",
        tone === "destructive" && "text-destructive"
      )}
    >
      {value}
    </span>
  </div>
);

const GoalLine = ({
  athlete,
  event,
  avgLapSec,
  lapsDone,
  compact,
}: {
  athlete: Athlete;
  event: RaceEvent;
  avgLapSec: number;
  lapsDone: number;
  compact: boolean;
}) => {
  // Convert lapDistance to km for unified math (mi → km)
  const lapKm = athlete.unit === "mi" ? athlete.lapDistance * 1.609344 : athlete.lapDistance;
  const distanceKm = lapsDone * lapKm;
  const paceSecPerKm = avgLapSec > 0 && lapKm > 0 ? avgLapSec / lapKm : 0;

  let goalText = "";
  let projectionText = "";
  let onTrack: boolean | null = null;

  if (event.kind === "distance" && athlete.goalDurationMinutes && event.distanceKm) {
    const requiredPace = (athlete.goalDurationMinutes * 60) / event.distanceKm;
    goalText = `Goal ${formatHM(athlete.goalDurationMinutes)} · need ${formatPace(requiredPace, "km")}`;
    if (paceSecPerKm > 0) {
      const remainingKm = Math.max(0, event.distanceKm - distanceKm);
      const projectedSec = lapsDone > 0 ? (avgLapSec * lapsDone) + remainingKm * paceSecPerKm : remainingKm * paceSecPerKm;
      projectionText = `ETA finish ${formatHM(projectedSec / 60)}`;
      onTrack = paceSecPerKm <= requiredPace;
    }
  } else if (event.kind === "time" && athlete.goalDistanceKm && event.durationMinutes) {
    const requiredPace = (event.durationMinutes * 60) / athlete.goalDistanceKm;
    goalText = `Goal ${athlete.goalDistanceKm} km · need ${formatPace(requiredPace, "km")}`;
    if (paceSecPerKm > 0) {
      const projectedKm = (event.durationMinutes * 60) / paceSecPerKm;
      projectionText = `Projected ${projectedKm.toFixed(1)} km`;
      onTrack = paceSecPerKm <= requiredPace;
    }
  }

  if (!goalText) return null;

  return (
    <div className={cn("mx-2.5 mt-1.5 rounded-md border border-border/60 bg-secondary/40 px-2 py-1", compact ? "text-[9px]" : "text-[10px] mx-5", "flex items-center justify-between gap-2 tabular")}>
      <span className="text-muted-foreground truncate">{goalText}</span>
      {projectionText && (
        <span
          className={cn(
            "font-semibold shrink-0",
            onTrack === true && "text-success",
            onTrack === false && "text-warning"
          )}
        >
          {projectionText}
        </span>
      )}
    </div>
  );
};

const RankBadge = ({ athlete, compact }: { athlete: Athlete; compact: boolean }) => {
  const rank = useRankingsStore((s) =>
    athlete.eventId && athlete.bib ? s.byEvent[athlete.eventId]?.[athlete.bib.trim()] : undefined
  );
  if (!rank || rank.rank == null) return null;
  const medal = rank.rank === 1 ? "🥇" : rank.rank === 2 ? "🥈" : rank.rank === 3 ? "🥉" : "🏆";
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 tabular font-bold align-middle",
        compact ? "text-[10px] sm:text-xs md:text-sm" : "text-xs md:text-sm lg:text-base"
      )}
      title={rank.time ? `Time: ${rank.time}` : undefined}
    >
      {medal} {rank.rank}
    </span>
  );
};

const DeviceWatchIndicator = ({ athleteId, compact }: { athleteId: string; compact: boolean }) => {
  const mapping = useDeviceMappingStore((s) =>
    s.mappings.find((m) => m.athlete_id === athleteId)
  );
  const signal = useAthleteSignal(athleteId);
  if (!mapping) return null;
  const active = signal.present;
  return (
    <Watch
      className={cn(
        "shrink-0 transition-colors",
        compact ? "h-3.5 w-3.5" : "h-4 w-4",
        active ? "text-success" : "text-muted-foreground/40"
      )}
      strokeWidth={2.25}
      aria-label={active ? "Device signal active" : "Device signal lost"}
    />
  );
};

export default AthleteCard;
