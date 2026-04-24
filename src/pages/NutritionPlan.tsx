import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useRaceStore } from "@/lib/store";
import AthleteSwitcher from "@/components/AthleteSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, ChevronLeft, ChevronRight, Pencil, Table2, Check, X } from "lucide-react";
import { totalLapsFor } from "@/lib/race";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NutritionPlan = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const allPlans = useRaceStore((s) => s.plans);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const navigate = useNavigate();

  const events = useRaceStore((s) => s.events);
  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;
  const event = athlete?.eventId ? events.find((e) => e.id === athlete.eventId) : undefined;
  const totalLaps = athlete ? totalLapsFor(athlete, event) : 0;
  const [lapNumber, setLapNumber] = useState(1);

  // Per-lap distance offsets (athlete unit)
  const lapDistsUnit = athlete
    ? (event?.kind === "distance" && event.lapMode === "variable" && event.lapDistancesKm?.length
        ? event.lapDistancesKm.filter((d) => d > 0).map((km) => (athlete.unit === "mi" ? km / 1.609344 : km))
        : Array.from({ length: totalLaps }, () => athlete.lapDistance))
    : [];
  const cumulativeAt = (n: number) =>
    lapDistsUnit.slice(0, Math.max(0, Math.min(n, lapDistsUnit.length))).reduce((s, d) => s + d, 0);

  if (!athlete) {
    return (
      <AppShell title="Nutrition">
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Add an athlete first to plan nutrition.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Nutrition">
      <AthleteSwitcher
        athletes={athletes}
        selectedId={athlete.id}
        onSelect={(v) => { selectAthlete(v); setLapNumber(1); }}
      />
      <div className="rounded-2xl border border-border gradient-card p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planning lap</p>
        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setLapNumber((n) => Math.max(1, n - 1))}
            disabled={lapNumber <= 1}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="tabular text-4xl font-bold leading-none">{lapNumber}</p>
            <p className="text-xs text-muted-foreground">
              of {totalLaps} ·{" "}
              <span className="tabular">
                {(() => {
                  const k = cumulativeAt(lapNumber);
                  return `(${k.toFixed(k >= 100 ? 0 : k >= 10 ? 1 : 2)} ${athlete.unit})`;
                })()}
              </span>
            </p>
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setLapNumber((n) => Math.min(totalLaps, n + 1))}
            disabled={lapNumber >= totalLaps}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Button
        variant="default"
        className="mt-4 w-full gap-2"
        onClick={() => navigate("/nutrition/edit")}
      >
        <Table2 className="h-4 w-4" /> Edit full plan as table
      </Button>


      <PlanOverview
        athleteId={athlete.id}
        totalLaps={totalLaps}
        plans={allPlans}
        currentLap={lapNumber}
        onJump={(n) => setLapNumber(n)}
        unit={athlete.unit}
        cumulativeAt={cumulativeAt}
      />
    </AppShell>
  );
};

interface PlanOverviewProps {
  athleteId: string;
  totalLaps: number;
  plans: ReturnType<typeof useRaceStore.getState>["plans"];
  currentLap: number;
  onJump: (lap: number) => void;
  unit: "km" | "mi";
  cumulativeAt: (lap: number) => number;
}

const PlanOverview = ({ athleteId, totalLaps, plans, currentLap, onJump, unit, cumulativeAt }: PlanOverviewProps) => {
  const nutritionItems = useRaceStore((s) => s.nutritionItems);
  const removeNutritionItem = useRaceStore((s) => s.removeNutritionItem);

  const athletePlans = plans
    .filter((p) => p.athleteId === athleteId && p.lapNumber <= totalLaps)
    .sort((a, b) => a.lapNumber - b.lapNumber);
  const nonEmpty = athletePlans.filter((p) => p.items.length > 0);

  // Items in use = the shared catalog (single source of truth, shared with the matrix editor)
  const usedLabels = [...nutritionItems].sort();

  const removeLabelEverywhere = (label: string) => {
    // Removes from the catalog AND from every plan in one shot.
    removeNutritionItem(label);
    toast.success(`Removed "${label}" from catalog and all laps`);
  };

  return (
    <section className="mt-8 space-y-6">
      {usedLabels.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Items in use ({usedLabels.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {usedLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary pl-3 pr-1 py-1 text-xs font-medium"
              >
                {label}
                <button
                  onClick={() => removeLabelEverywhere(label)}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  title={`Remove "${label}" from all laps`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          All planned laps ({nonEmpty.length})
        </h2>
        {nonEmpty.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No plans yet. Add items above to start building the race nutrition plan.
          </p>
        ) : (
          <div className="space-y-2">
            {nonEmpty.map((p) => (
              <button
                key={p.lapNumber}
                onClick={() => onJump(p.lapNumber)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                  p.lapNumber === currentLap
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lap</span>
                    <span className="tabular text-lg font-bold leading-none">{p.lapNumber}</span>
                    <span className="text-xs text-muted-foreground">/ {totalLaps}</span>
                    <span className="text-xs text-muted-foreground tabular">
                      {(() => {
                        const k = cumulativeAt(p.lapNumber);
                        return `(${k.toFixed(k >= 100 ? 0 : k >= 10 ? 1 : 2)} ${unit})`;
                      })()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.items.map((it) => (
                      <span
                        key={it.id}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                      >
                        {it.label}
                      </span>
                    ))}
                  </div>
                </div>
                <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default NutritionPlan;
