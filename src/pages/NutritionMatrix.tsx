import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useRaceStore, newId } from "@/lib/store";
import { totalLapsFor } from "@/lib/race";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Save, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DEFAULT_ITEMS = ["Gel", "Water", "Electrolytes", "Banana", "Bar", "Salt cap", "Coke"];

const NutritionMatrix = () => {
  const navigate = useNavigate();
  const athletes = useRaceStore((s) => s.athletes);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const allPlans = useRaceStore((s) => s.plans);
  const setPlan = useRaceStore((s) => s.setPlan);

  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;
  const totalLaps = athlete ? totalLapsFor(athlete) : 0;

  // Column definitions: union of existing labels for this athlete + defaults
  const initialColumns = useMemo(() => {
    if (!athlete) return [] as string[];
    const set = new Set<string>(DEFAULT_ITEMS);
    allPlans
      .filter((p) => p.athleteId === athlete.id)
      .forEach((p) => p.items.forEach((it) => set.add(it.label)));
    return Array.from(set);
  }, [athlete, allPlans]);

  const [columns, setColumns] = useState<string[]>([]);
  // matrix[lapNumber][label] = boolean
  const [matrix, setMatrix] = useState<Record<number, Record<string, boolean>>>({});
  const [newCol, setNewCol] = useState("");

  // Hydrate when athlete changes
  useEffect(() => {
    if (!athlete) return;
    setColumns(initialColumns);
    const m: Record<number, Record<string, boolean>> = {};
    for (let n = 1; n <= totalLaps; n++) {
      const plan = allPlans.find((p) => p.athleteId === athlete.id && p.lapNumber === n);
      const row: Record<string, boolean> = {};
      initialColumns.forEach((c) => {
        row[c] = !!plan?.items.find((it) => it.label === c);
      });
      m[n] = row;
    }
    setMatrix(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id, totalLaps]);

  if (!athlete) {
    return (
      <AppShell title="Edit nutrition">
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Add an athlete first.</p>
        </div>
      </AppShell>
    );
  }

  const toggleCell = (lap: number, col: string) => {
    setMatrix((prev) => ({
      ...prev,
      [lap]: { ...prev[lap], [col]: !prev[lap]?.[col] },
    }));
  };

  const addColumn = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (columns.includes(trimmed)) {
      toast.error("That item already exists");
      return;
    }
    setColumns((c) => [...c, trimmed]);
    setMatrix((prev) => {
      const next = { ...prev };
      for (let n = 1; n <= totalLaps; n++) {
        next[n] = { ...next[n], [trimmed]: false };
      }
      return next;
    });
    setNewCol("");
  };

  const removeColumn = (col: string) => {
    setColumns((c) => c.filter((x) => x !== col));
    setMatrix((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([k, row]) => {
        const { [col]: _omit, ...rest } = row;
        next[Number(k)] = rest;
      });
      return next;
    });
  };

  const fillCol = (col: string, value: boolean) => {
    setMatrix((prev) => {
      const next = { ...prev };
      for (let n = 1; n <= totalLaps; n++) {
        next[n] = { ...next[n], [col]: value };
      }
      return next;
    });
  };

  const onSave = () => {
    for (let n = 1; n <= totalLaps; n++) {
      const row = matrix[n] ?? {};
      const items = columns
        .filter((c) => row[c])
        .map((c) => ({ id: newId(), label: c }));
      setPlan(athlete.id, n, items);
    }
    toast.success("Nutrition plan saved");
    navigate("/nutrition");
  };

  return (
    <AppShell
      title="Edit nutrition"
      action={
        athletes.length > 1 ? (
          <Select value={athlete.id} onValueChange={(v) => selectAthlete(v)}>
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
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {athlete.name} · {totalLaps} laps
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap cells to toggle. Rows are laps, columns are items.
        </p>
      </div>

      {/* Add column */}
      <div className="mt-4 flex gap-2">
        <Input
          value={newCol}
          onChange={(e) => setNewCol(e.target.value)}
          placeholder="Add new item (e.g. SIS gel)"
          onKeyDown={(e) => {
            if (e.key === "Enter") addColumn(newCol);
          }}
        />
        <Button onClick={() => addColumn(newCol)} disabled={!newCol.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Matrix */}
      <div className="mt-4 -mx-4 overflow-x-auto">
        <div className="px-4 pb-2">
          <table className="min-w-full table-fixed border-separate border-spacing-1 text-xs">
            <colgroup>
              <col style={{ width: 44 }} />
              {columns.map((c) => (
                <col key={c} style={{ width: 72 }} />
              ))}
            </colgroup>
            <thead className="sticky top-[64px] z-20 bg-background">
              <tr>
                <th className="sticky left-0 z-30 bg-background px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lap
                </th>
                {columns.map((c) => (
                  <th key={c} className="bg-background px-1 py-2 align-bottom">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => removeColumn(c)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove item"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          const allOn = Array.from({ length: totalLaps }, (_, i) => matrix[i + 1]?.[c]).every(Boolean);
                          fillCol(c, !allOn);
                        }}
                        className="block w-full break-words text-center text-[11px] font-semibold leading-tight text-foreground hover:text-primary"
                        title="Toggle column"
                      >
                        {c}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: totalLaps }, (_, i) => i + 1).map((lap) => (
                <tr key={lap}>
                  <td className="sticky left-0 z-10 bg-background px-2 py-1 text-right tabular text-sm font-bold">
                    {lap}
                  </td>
                  {columns.map((c) => {
                    const on = !!matrix[lap]?.[c];
                    return (
                      <td key={c} className="p-0">
                        <button
                          onClick={() => toggleCell(lap, c)}
                          className={cn(
                            "h-9 w-full rounded-md border text-[11px] font-medium transition-colors",
                            on
                              ? "border-primary bg-primary text-primary-foreground shadow-glow"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {on ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-20 z-30 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 gap-2" onClick={() => navigate("/nutrition")}>
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          <Button className="flex-1 gap-2" onClick={onSave}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default NutritionMatrix;
