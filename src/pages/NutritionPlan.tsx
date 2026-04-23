import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useRaceStore, newId } from "@/lib/store";
import AthleteSwitcher from "@/components/AthleteSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil, Table2 } from "lucide-react";
import { totalLapsFor } from "@/lib/race";
import { toast } from "sonner";

const NutritionPlan = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const allPlans = useRaceStore((s) => s.plans);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const planFor = useRaceStore((s) => s.planFor);
  const setPlan = useRaceStore((s) => s.setPlan);
  const navigate = useNavigate();

  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;
  const totalLaps = athlete ? totalLapsFor(athlete) : 0;
  const [lapNumber, setLapNumber] = useState(1);
  const [newItem, setNewItem] = useState("");

  const plan = useMemo(
    () => (athlete ? planFor(athlete.id, lapNumber) : undefined),
    [athlete, lapNumber, planFor]
  );
  const items = plan?.items ?? [];

  if (!athlete) {
    return (
      <AppShell title="Nutrition">
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Add an athlete first to plan nutrition.</p>
        </div>
      </AppShell>
    );
  }

  const addItem = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setPlan(athlete.id, lapNumber, [...items, { id: newId(), label: trimmed }]);
    setNewItem("");
  };

  const removeItem = (id: string) => {
    setPlan(athlete.id, lapNumber, items.filter((i) => i.id !== id));
  };

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
                ({(lapNumber * athlete.lapDistance).toFixed(athlete.lapDistance % 1 === 0 ? 0 : 2)} {athlete.unit})
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

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Items for this lap
        </h2>
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              No items yet. Add some below.
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="font-medium">{item.label}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add item (e.g. SIS gel)"
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem(newItem);
            }}
          />
          <Button onClick={() => addItem(newItem)} disabled={!newItem.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

      </section>

      <PlanOverview
        athleteId={athlete.id}
        totalLaps={totalLaps}
        plans={allPlans}
        currentLap={lapNumber}
        onJump={(n) => setLapNumber(n)}
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
}

const PlanOverview = ({ athleteId, totalLaps, plans, currentLap, onJump }: PlanOverviewProps) => {
  const setPlan = useRaceStore((s) => s.setPlan);

  const athletePlans = plans
    .filter((p) => p.athleteId === athleteId && p.lapNumber <= totalLaps)
    .sort((a, b) => a.lapNumber - b.lapNumber);
  const nonEmpty = athletePlans.filter((p) => p.items.length > 0);

  // Union of all item labels currently used across this athlete's plans
  const usedLabels = Array.from(
    new Set(athletePlans.flatMap((p) => p.items.map((it) => it.label)))
  ).sort();

  const removeLabelEverywhere = (label: string) => {
    athletePlans.forEach((p) => {
      if (p.items.some((it) => it.label === label)) {
        setPlan(
          athleteId,
          p.lapNumber,
          p.items.filter((it) => it.label !== label)
        );
      }
    });
    toast.success(`Removed "${label}" from all laps`);
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
