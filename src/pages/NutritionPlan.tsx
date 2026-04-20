import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRaceStore, newId } from "@/lib/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { totalLapsFor } from "@/lib/race";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const QUICK_ITEMS = ["Gel", "Water", "Electrolytes", "Banana", "Bar", "Salt cap", "Coke"];

const NutritionPlan = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const planFor = useRaceStore((s) => s.planFor);
  const setPlan = useRaceStore((s) => s.setPlan);
  const duplicate = useRaceStore((s) => s.duplicatePlanToRange);

  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;
  const totalLaps = athlete ? totalLapsFor(athlete) : 0;
  const [lapNumber, setLapNumber] = useState(1);
  const [newItem, setNewItem] = useState("");
  const [dupOpen, setDupOpen] = useState(false);
  const [dupStart, setDupStart] = useState("");
  const [dupEnd, setDupEnd] = useState("");

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

  const onDuplicate = () => {
    const s = parseInt(dupStart, 10);
    const e = parseInt(dupEnd, 10);
    if (isNaN(s) || isNaN(e) || s < 1 || e > totalLaps || s > e) {
      toast.error(`Enter a range between 1 and ${totalLaps}`);
      return;
    }
    duplicate(athlete.id, lapNumber, s, e);
    toast.success(`Duplicated lap ${lapNumber} to laps ${s}–${e}`);
    setDupOpen(false);
  };

  return (
    <AppShell
      title="Nutrition"
      action={
        athletes.length > 1 ? (
          <Select value={athlete.id} onValueChange={(v) => { selectAthlete(v); setLapNumber(1); }}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {athletes.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
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
            <p className="text-xs text-muted-foreground">of {totalLaps}</p>
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

        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ITEMS.map((q) => (
            <button
              key={q}
              onClick={() => addItem(q)}
              className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              + {q}
            </button>
          ))}
        </div>
      </section>

      <Button
        variant="secondary"
        className="mt-6 w-full gap-2"
        disabled={items.length === 0 || totalLaps <= 1}
        onClick={() => {
          setDupStart(String(Math.min(lapNumber + 1, totalLaps)));
          setDupEnd(String(totalLaps));
          setDupOpen(true);
        }}
      >
        <Copy className="h-4 w-4" /> Duplicate to other laps
      </Button>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Duplicate lap {lapNumber}</DialogTitle>
            <DialogDescription>
              Copy these {items.length} item(s) to a range of laps. Existing plans for those laps will be overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="from">From lap</Label>
              <Input id="from" inputMode="numeric" value={dupStart} onChange={(e) => setDupStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To lap</Label>
              <Input id="to" inputMode="numeric" value={dupEnd} onChange={(e) => setDupEnd(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDupOpen(false)}>Cancel</Button>
            <Button onClick={onDuplicate}>Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default NutritionPlan;
