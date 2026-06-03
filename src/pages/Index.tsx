import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Activity, GripVertical, RotateCcw } from "lucide-react";
import AthleteCard from "@/components/AthleteCard";
import AthleteFormDialog from "@/components/AthleteFormDialog";
import SettingsButton from "@/components/SettingsButton";
import WeatherWidget from "@/components/WeatherWidget";
import UpcomingArrivals from "@/components/UpcomingArrivals";
import { useRaceStore } from "@/lib/store";
import { Athlete, RaceEvent } from "@/lib/types";
import { formatHM } from "@/lib/format";
import { cn } from "@/lib/utils";
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
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const UNASSIGNED = "__unassigned__";

interface AthleteGroup {
  key: string; // event id or UNASSIGNED
  event: RaceEvent | null;
  athletes: Athlete[];
}

const Index = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const events = useRaceStore((s) => s.events);
  const deleteAthlete = useRaceStore((s) => s.deleteAthlete);
  const reorderEvents = useRaceStore((s) => s.reorderEvents);
  const reorderAthletesInEvent = useRaceStore((s) => s.reorderAthletesInEvent);
  const resetEventLaps = useRaceStore((s) => s.resetEventLaps);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Athlete | null>(null);
  const [confirmReset, setConfirmReset] = useState<AthleteGroup | null>(null);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.order - b.order), [events]);

  const groups: AthleteGroup[] = useMemo(() => {
    const byEvent = new Map<string, Athlete[]>();
    athletes.forEach((a) => {
      const k = a.eventId && events.some((e) => e.id === a.eventId) ? a.eventId : UNASSIGNED;
      if (!byEvent.has(k)) byEvent.set(k, []);
      byEvent.get(k)!.push(a);
    });
    const sortAthletes = (arr: Athlete[]) =>
      [...arr].sort((a, b) => {
        const ao = a.dashboardOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.dashboardOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.createdAt - b.createdAt;
      });

    const result: AthleteGroup[] = sortedEvents
      .filter((e) => byEvent.has(e.id))
      .map((e) => ({ key: e.id, event: e, athletes: sortAthletes(byEvent.get(e.id) || []) }));

    if (byEvent.has(UNASSIGNED)) {
      result.push({ key: UNASSIGNED, event: null, athletes: sortAthletes(byEvent.get(UNASSIGNED) || []) });
    }
    return result;
  }, [athletes, events, sortedEvents]);

  // Density: based on largest group size
  const largest = groups.reduce((m, g) => Math.max(m, g.athletes.length), 0);
  const compact = largest >= 2;
  const colsClass = largest >= 7 ? "grid-cols-2 md:grid-cols-4" : largest >= 5 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2";
  const colsPerRow = largest >= 7 ? 4 : largest >= 5 ? 3 : 2;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // Group reordering (only sortable event groups; Unassigned is pinned at the end)
  const sortableGroupIds = groups.filter((g) => g.event).map((g) => g.key);

  const onGroupDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sortableGroupIds.indexOf(String(active.id));
    const newIdx = sortableGroupIds.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    reorderEvents(arrayMove(sortableGroupIds, oldIdx, newIdx));
  };

  return (
    <AppShell
      wide
      title="Dashboard"
      action={
        <div className="flex items-center gap-1">
          <SettingsButton />
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Athlete
          </Button>
        </div>
      }
    >
      {athletes.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
            <Activity className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-bold">No athletes yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first runner to start tracking laps.
          </p>
          <Button
            className="mt-5"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add athlete
          </Button>
        </div>
      ) : (
        <>
        <UpcomingArrivals />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd}>
          <SortableContext items={sortableGroupIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {groups.map((g) =>
                g.event ? (
                  <SortableGroupSection
                    key={g.key}
                    group={g}
                    colsClass={colsClass}
                    colsPerRow={colsPerRow}
                    compact={compact}
                    onEditAthlete={(a) => { setEditing(a); setFormOpen(true); }}
                    onDeleteAthlete={(a) => setConfirmDelete(a)}
                    onAthletesReordered={(ids) => reorderAthletesInEvent(g.event!.id, ids)}
                  />
                ) : (
                  <GroupSection
                    key={g.key}
                    group={g}
                    colsClass={colsClass}
                    colsPerRow={colsPerRow}
                    compact={compact}
                    onEditAthlete={(a) => { setEditing(a); setFormOpen(true); }}
                    onDeleteAthlete={(a) => setConfirmDelete(a)}
                    onAthletesReordered={(ids) => reorderAthletesInEvent(null, ids)}
                  />
                )
              )}
            </div>
          </SortableContext>
        </DndContext>
        </>
      )}

      <AthleteFormDialog open={formOpen} onOpenChange={setFormOpen} athlete={editing} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete athlete?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-semibold text-foreground">{confirmDelete?.name}</span> and all related laps and nutrition data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) deleteAthlete(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

// -- Group section (non-sortable, used for "Unassigned") --

interface GroupSectionProps {
  group: AthleteGroup;
  colsClass: string;
  colsPerRow: number;
  compact: boolean;
  onEditAthlete: (a: Athlete) => void;
  onDeleteAthlete: (a: Athlete) => void;
  onAthletesReordered: (ids: string[]) => void;
  onResetLaps?: () => void;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement>;
}

const GroupHeader = ({
  group,
  dragHandle,
  onResetLaps,
}: {
  group: AthleteGroup;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement>;
  onResetLaps?: () => void;
}) => {
  const e = group.event;
  return (
    <div className="flex items-center gap-2 px-1">
      {dragHandle && (
        <button
          type="button"
          {...dragHandle}
          aria-label="Drag group"
          className="flex h-7 w-6 items-center justify-center text-muted-foreground hover:text-foreground touch-none cursor-grab active:cursor-grabbing rounded-md"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <h2 className="text-sm font-bold uppercase tracking-wider">
        {e ? e.name : "Unassigned"}
      </h2>
      {e && (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground tabular">
          {e.kind === "distance" ? `${e.distanceKm} km` : formatHM(e.durationMinutes ?? 0)}
        </span>
      )}
      <span className="text-xs text-muted-foreground tabular">
        {group.athletes.length}
      </span>
      {onResetLaps && group.athletes.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetLaps}
          className="ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          title="Reset all laps in this event"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset laps
        </Button>
      )}
    </div>
  );
};

const GroupSection = ({
  group,
  colsClass,
  colsPerRow,
  compact,
  onEditAthlete,
  onDeleteAthlete,
  onAthletesReordered,
  onResetLaps,
  dragHandle,
}: GroupSectionProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );
  const ids = group.athletes.map((a) => a.id);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onAthletesReordered(arrayMove(ids, oldIdx, newIdx));
  };

  // Pad with empty slots so each group fills the row before the next group starts.
  const remainder = group.athletes.length % colsPerRow;
  const placeholders = remainder === 0 ? 0 : colsPerRow - remainder;

  return (
    <section className="space-y-2">
      <GroupHeader group={group} dragHandle={dragHandle} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className={cn("grid gap-2 sm:gap-3", colsClass)}>
            {group.athletes.map((a) => (
              <SortableAthleteCard
                key={a.id}
                athlete={a}
                compact={compact}
                onEdit={() => onEditAthlete(a)}
                onDelete={() => onDeleteAthlete(a)}
              />
            ))}
            {Array.from({ length: placeholders }).map((_, i) => (
              <div
                key={`ph-${i}`}
                className="rounded-2xl border border-dashed border-border/40 bg-card/20"
                aria-hidden
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
};

// -- Sortable wrapper for an event group section --

const SortableGroupSection = (props: GroupSectionProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.group.key,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const handle = { ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <div ref={setNodeRef} style={style}>
      <GroupSection {...props} dragHandle={handle} />
    </div>
  );
};

// -- Sortable wrapper for an athlete card --

const SortableAthleteCard = ({
  athlete,
  compact,
  onEdit,
  onDelete,
}: {
  athlete: Athlete;
  compact: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: athlete.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const handle = { ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>;
  return (
    <div ref={setNodeRef} style={style}>
      <AthleteCard
        athlete={athlete}
        compact={compact}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={handle}
      />
    </div>
  );
};

export default Index;
