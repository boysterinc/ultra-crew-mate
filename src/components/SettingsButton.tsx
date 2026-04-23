import { useState } from "react";
import { Settings as SettingsIcon, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useRaceStore } from "@/lib/store";
import { EventKind, RaceEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = {
  name: string;
  kind: EventKind;
  distanceKm: string;
  hours: string;
  minutes: string;
  lapMode: "fixed" | "variable";
  lapDistancesKm: string[]; // editable per-checkpoint distances (km)
};

const emptyDraft = (): Draft => ({
  name: "",
  kind: "distance",
  distanceKm: "",
  hours: "",
  minutes: "",
  lapMode: "fixed",
  lapDistancesKm: [""],
});

const SettingsButton = () => {
  const threshold = useRaceStore((s) => s.settings.doubleTapThresholdMinutes);
  const setThreshold = useRaceStore((s) => s.setDoubleTapMinutes);
  const events = useRaceStore((s) => s.events);
  const addEvent = useRaceStore((s) => s.addEvent);
  const updateEvent = useRaceStore((s) => s.updateEvent);
  const deleteEvent = useRaceStore((s) => s.deleteEvent);

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(threshold));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [confirmDelete, setConfirmDelete] = useState<RaceEvent | null>(null);

  const startAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setAdding(true);
  };

  const startEdit = (e: RaceEvent) => {
    setAdding(false);
    setEditingId(e.id);
    setDraft({
      name: e.name,
      kind: e.kind,
      distanceKm: e.distanceKm ? String(e.distanceKm) : "",
      hours: e.durationMinutes ? String(Math.floor(e.durationMinutes / 60)) : "",
      minutes: e.durationMinutes ? String(e.durationMinutes % 60) : "",
      lapMode: e.lapMode === "variable" ? "variable" : "fixed",
      lapDistancesKm:
        e.lapMode === "variable" && e.lapDistancesKm?.length
          ? e.lapDistancesKm.map((d) => String(d))
          : [""],
    });
  };

  const cancelDraft = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const saveDraft = () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload: Omit<RaceEvent, "id" | "order"> = {
      name,
      kind: draft.kind,
      ...(draft.kind === "distance"
        ? { distanceKm: Math.max(0, parseFloat(draft.distanceKm) || 0) }
        : {
            durationMinutes:
              Math.max(0, parseInt(draft.hours || "0", 10) || 0) * 60 +
              Math.max(0, parseInt(draft.minutes || "0", 10) || 0),
          }),
    };
    if (
      (payload.kind === "distance" && (payload.distanceKm ?? 0) <= 0) ||
      (payload.kind === "time" && (payload.durationMinutes ?? 0) <= 0)
    ) {
      return;
    }
    if (editingId) {
      updateEvent(editingId, payload);
    } else {
      addEvent(payload);
    }
    cancelDraft();
  };

  const formatEventValue = (e: RaceEvent) => {
    if (e.kind === "distance") return `${e.distanceKm} km`;
    const h = Math.floor((e.durationMinutes ?? 0) / 60);
    const m = (e.durationMinutes ?? 0) % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  };

  const sortedEvents = [...events].sort((a, b) => a.order - b.order);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setValue(String(threshold)); cancelDraft(); } }}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <SettingsIcon className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Tune safety guards and manage race events.</DialogDescription>
          </DialogHeader>

          <section className="space-y-2">
            <Label htmlFor="threshold">Double-tap window (minutes)</Label>
            <Input
              id="threshold"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              If a checkpoint is tapped within this window, you'll be asked to confirm.
            </p>
          </section>

          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Race events</h3>
                <p className="text-xs text-muted-foreground">Define races by distance or time.</p>
              </div>
              {!adding && !editingId && (
                <Button size="sm" variant="secondary" onClick={startAdd} className="gap-1">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>

            {sortedEvents.length === 0 && !adding && (
              <p className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-center text-xs text-muted-foreground">
                No events yet. Add one to group athletes on the dashboard.
              </p>
            )}

            <ul className="space-y-2">
              {sortedEvents.map((e) => (
                <li key={e.id}>
                  {editingId === e.id ? (
                    <DraftForm draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={cancelDraft} />
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{e.name}</p>
                        <p className="text-xs text-muted-foreground tabular">
                          <span className="uppercase tracking-wider">{e.kind}</span> · {formatEventValue(e)}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => startEdit(e)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {adding && (
              <DraftForm draft={draft} setDraft={setDraft} onSave={saveDraft} onCancel={cancelDraft} />
            )}
          </section>

          <DialogFooter>
            <Button
              onClick={() => {
                const n = parseFloat(value);
                if (!isNaN(n) && n >= 0) setThreshold(n);
                setOpen(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be removed. Athletes registered in this event will become Unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) deleteEvent(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const DraftForm = ({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-card p-3">
      <div className="space-y-1.5">
        <Label htmlFor="ev-name" className="text-xs">Event name</Label>
        <Input
          id="ev-name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. 50K Trail"
          className="h-9"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Type</Label>
        <ToggleGroup
          type="single"
          value={draft.kind}
          onValueChange={(v) => v && setDraft({ ...draft, kind: v as EventKind })}
          className="justify-start"
        >
          <ToggleGroupItem value="distance" className="px-4">Distance</ToggleGroupItem>
          <ToggleGroupItem value="time" className="px-4">Time</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {draft.kind === "distance" ? (
        <div className="space-y-1.5">
          <Label htmlFor="ev-km" className="text-xs">Distance (km)</Label>
          <Input
            id="ev-km"
            inputMode="decimal"
            value={draft.distanceKm}
            onChange={(e) => setDraft({ ...draft, distanceKm: e.target.value })}
            placeholder="50"
            className="h-9"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="ev-h" className="text-xs">Hours</Label>
            <Input
              id="ev-h"
              inputMode="numeric"
              value={draft.hours}
              onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
              placeholder="12"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ev-m" className="text-xs">Minutes</Label>
            <Input
              id="ev-m"
              inputMode="numeric"
              value={draft.minutes}
              onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
              placeholder="0"
              className="h-9"
            />
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} className="gap-1">
          <Check className="h-3.5 w-3.5" /> Save
        </Button>
      </div>
    </div>
  );
};

export default SettingsButton;
