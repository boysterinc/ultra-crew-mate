import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useRaceStore, newId } from "@/lib/store";
import { totalLapsFor } from "@/lib/race";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AthleteSwitcher from "@/components/AthleteSwitcher";
import { Plus, X, Save, ArrowLeft, GripVertical, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

const NutritionMatrix = () => {
  const navigate = useNavigate();
  const athletes = useRaceStore((s) => s.athletes);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const allPlans = useRaceStore((s) => s.plans);
  const setPlan = useRaceStore((s) => s.setPlan);
  const nutritionItems = useRaceStore((s) => s.nutritionItems);
  const addNutritionItem = useRaceStore((s) => s.addNutritionItem);
  const removeNutritionItem = useRaceStore((s) => s.removeNutritionItem);
  const renameNutritionItem = useRaceStore((s) => s.renameNutritionItem);
  const reorderNutritionItems = useRaceStore((s) => s.reorderNutritionItems);

  const events = useRaceStore((s) => s.events);
  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;
  const event = athlete?.eventId ? events.find((e) => e.id === athlete.eventId) : undefined;
  const totalLaps = athlete ? totalLapsFor(athlete, event) : 0;

  // Per-lap distance offsets (athlete unit) — same logic as NutritionPlan
  const lapDistsUnit = athlete
    ? (event?.kind === "distance" && event.lapMode === "variable" && event.lapDistancesKm?.length
        ? event.lapDistancesKm.filter((d) => d > 0).map((km) => (athlete.unit === "mi" ? km / 1.609344 : km))
        : Array.from({ length: totalLaps }, () => athlete.lapDistance))
    : [];
  const cumulativeAt = (n: number) =>
    lapDistsUnit.slice(0, Math.max(0, Math.min(n, lapDistsUnit.length))).reduce((s, d) => s + d, 0);
  const fmtKm = (k: number) =>
    `${k.toFixed(k >= 100 ? 0 : k >= 10 ? 1 : 2)} ${athlete?.unit ?? "km"}`;

  // Shared catalog drives columns for every athlete
  const columns = nutritionItems;

  // matrix[lapNumber][label] = boolean
  const [matrix, setMatrix] = useState<Record<number, Record<string, boolean>>>({});
  const [newCol, setNewCol] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Re-hydrate when athlete, totalLaps, or stored plans change
  const planSignature = useMemo(
    () =>
      allPlans
        .filter((p) => athlete && p.athleteId === athlete.id)
        .map((p) => `${p.lapNumber}:${p.items.map((i) => i.label).sort().join(",")}`)
        .sort()
        .join("|"),
    [allPlans, athlete]
  );

  useEffect(() => {
    if (!athlete) return;
    const m: Record<number, Record<string, boolean>> = {};
    for (let n = 1; n <= totalLaps; n++) {
      const plan = allPlans.find((p) => p.athleteId === athlete.id && p.lapNumber === n);
      const row: Record<string, boolean> = {};
      columns.forEach((c) => {
        row[c] = !!plan?.items.find((it) => it.label === c);
      });
      m[n] = row;
    }
    setMatrix(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id, totalLaps, planSignature, columns.join("|")]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    addNutritionItem(trimmed);
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
    removeNutritionItem(col);
    setMatrix((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([k, row]) => {
        const { [col]: _omit, ...rest } = row;
        next[Number(k)] = rest;
      });
      return next;
    });
    toast.success(`Removed "${col}"`);
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

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.indexOf(String(active.id));
    const newIndex = columns.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...columns];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    reorderNutritionItems(next);
  };

  const startRename = (label: string) => {
    setRenaming(label);
    setRenameValue(label);
  };
  const commitRename = () => {
    if (!renaming) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renaming) {
      setRenaming(null);
      return;
    }
    if (columns.includes(trimmed)) {
      toast.error("That item already exists");
      return;
    }
    renameNutritionItem(renaming, trimmed);
    // Carry over matrix state under new key
    setMatrix((prev) => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([k, row]) => {
        const { [renaming]: val, ...rest } = row;
        next[Number(k)] = { ...rest, [trimmed]: !!val };
      });
      return next;
    });
    toast.success(`Renamed to "${trimmed}"`);
    setRenaming(null);
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
    <AppShell title="Edit nutrition">
      <AthleteSwitcher athletes={athletes} selectedId={athlete.id} onSelect={selectAthlete} />
      <div className="rounded-2xl border border-border gradient-card p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {athlete.name} · {totalLaps} laps
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap cells to toggle. Drag headers to reorder. Click a name to rename.
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <table className="min-w-full table-fixed border-separate border-spacing-1 text-xs">
              <colgroup>
                <col style={{ width: 72 }} />
                {columns.map((c) => (
                  <col key={c} style={{ width: 80 }} />
                ))}
              </colgroup>
              <thead className="bg-background">
                <tr>
                  <th className="sticky left-0 z-10 bg-background px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Lap
                  </th>
                  <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
                    {columns.map((c) => (
                      <SortableHeader
                        key={c}
                        label={c}
                        isRenaming={renaming === c}
                        renameValue={renameValue}
                        setRenameValue={setRenameValue}
                        onStartRename={() => startRename(c)}
                        onCommitRename={commitRename}
                        onCancelRename={() => setRenaming(null)}
                        onRequestDelete={() => setConfirmDelete(c)}
                        onToggleColumn={() => {
                          const allOn = Array.from({ length: totalLaps }, (_, i) => matrix[i + 1]?.[c]).every(Boolean);
                          fillCol(c, !allOn);
                        }}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalLaps }, (_, i) => i + 1).map((lap) => (
                  <tr key={lap}>
                    <td className="sticky left-0 z-10 bg-background px-2 py-1 text-right text-sm font-bold">
                      <div className="tabular leading-none">{lap}</div>
                      <div className="tabular text-[10px] font-normal text-muted-foreground">
                        {fmtKm(cumulativeAt(lap))}
                      </div>
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
          </DndContext>
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

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{confirmDelete}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{confirmDelete}" from the shared catalog and from every lap plan. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) removeColumn(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

interface SortableHeaderProps {
  label: string;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onRequestDelete: () => void;
  onToggleColumn: () => void;
}

const SortableHeader = ({
  label,
  isRenaming,
  renameValue,
  setRenameValue,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
  onToggleColumn,
}: SortableHeaderProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: label });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <th ref={setNodeRef} style={style} className="bg-background px-1 py-2 align-bottom">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-0.5">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <button
            onClick={onStartRename}
            className="text-muted-foreground hover:text-primary"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onRequestDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Remove item"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {isRenaming ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommitRename();
                if (e.key === "Escape") onCancelRename();
              }}
              className="h-6 w-16 px-1 py-0 text-[11px]"
            />
            <button
              onClick={onCommitRename}
              className="text-primary"
              title="Save"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleColumn}
            className="block w-full break-all text-center text-[11px] font-semibold leading-tight text-foreground hover:text-primary"
            title="Toggle column"
          >
            {label}
          </button>
        )}
      </div>
    </th>
  );
};

export default NutritionMatrix;
