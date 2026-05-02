import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Plus, Pencil, Trash2, Check, X, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import {
  checkAutoLapAccess,
  tryUnlockAutoLap,
  lockAutoLapAccess,
} from "@/lib/autoLapAccess";
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

  // ---- AutoLap access (Step 1: password gate only) ----
  const [autoLapUnlocked, setAutoLapUnlocked] = useState<boolean>(() => checkAutoLapAccess());
  const [autoLapModalOpen, setAutoLapModalOpen] = useState(false);
  const [autoLapPassword, setAutoLapPassword] = useState("");
  const [autoLapError, setAutoLapError] = useState<string | null>(null);

  // Refresh unlocked state whenever the Settings dialog opens.
  useEffect(() => {
    if (open) setAutoLapUnlocked(checkAutoLapAccess());
  }, [open]);

  const openAutoLapModal = () => {
    setAutoLapPassword("");
    setAutoLapError(null);
    setAutoLapModalOpen(true);
  };

  const submitAutoLapPassword = () => {
    if (tryUnlockAutoLap(autoLapPassword)) {
      setAutoLapUnlocked(true);
      setAutoLapModalOpen(false);
      setAutoLapPassword("");
      setAutoLapError(null);
      toast.success("AutoLap unlocked");
    } else {
      setAutoLapError("Incorrect password");
    }
  };

  const handleLockAutoLap = () => {
    lockAutoLapAccess();
    setAutoLapUnlocked(false);
    toast("AutoLap locked");
  };

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
    let payload: Omit<RaceEvent, "id" | "order">;
    if (draft.kind === "distance") {
      const variable = draft.lapMode === "variable";
      const lapDists = variable
        ? draft.lapDistancesKm.map((s) => Math.max(0, parseFloat(s) || 0)).filter((d) => d > 0)
        : [];
      const distanceKm = variable
        ? lapDists.reduce((s, d) => s + d, 0)
        : Math.max(0, parseFloat(draft.distanceKm) || 0);
      if (distanceKm <= 0) return;
      payload = {
        name,
        kind: "distance",
        distanceKm,
        ...(variable
          ? { lapMode: "variable" as const, lapDistancesKm: lapDists }
          : { lapMode: "fixed" as const }),
      };
    } else {
      const durationMinutes =
        Math.max(0, parseInt(draft.hours || "0", 10) || 0) * 60 +
        Math.max(0, parseInt(draft.minutes || "0", 10) || 0);
      if (durationMinutes <= 0) return;
      payload = { name, kind: "time", durationMinutes };
    }
    if (editingId) {
      updateEvent(editingId, payload);
    } else {
      addEvent(payload);
    }
    cancelDraft();
  };

  const formatEventValue = (e: RaceEvent) => {
    if (e.kind === "distance") {
      if (e.lapMode === "variable" && e.lapDistancesKm?.length) {
        return `${e.distanceKm} km · ${e.lapDistancesKm.length} variable laps`;
      }
      return `${e.distanceKm} km`;
    }
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

          <section className="space-y-3 border-t border-border pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  AutoLap
                  {autoLapUnlocked ? (
                    <LockOpen className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Password-protected. {autoLapUnlocked ? "Unlocked for this session." : "Enter password to access."}
                </p>
              </div>
              {autoLapUnlocked ? (
                <Button size="sm" variant="ghost" onClick={handleLockAutoLap} className="gap-1">
                  <Lock className="h-3.5 w-3.5" /> Lock
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={openAutoLapModal} className="gap-1">
                  <LockOpen className="h-3.5 w-3.5" /> Unlock
                </Button>
              )}
            </div>
            {autoLapUnlocked && (
              <div className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
                AutoLap controls will appear here. (Not wired up yet.)
              </div>
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
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Lap layout</Label>
            <ToggleGroup
              type="single"
              value={draft.lapMode}
              onValueChange={(v) => v && setDraft({ ...draft, lapMode: v as "fixed" | "variable" })}
              className="justify-start"
            >
              <ToggleGroupItem value="fixed" className="px-4">Fixed laps</ToggleGroupItem>
              <ToggleGroupItem value="variable" className="px-4">Variable laps</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {draft.lapMode === "fixed" ? (
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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Checkpoint distances (km)</Label>
                <span className="text-[10px] tabular text-muted-foreground">
                  Total{" "}
                  {draft.lapDistancesKm
                    .map((s) => parseFloat(s) || 0)
                    .reduce((a, b) => a + b, 0)
                    .toFixed(2)}{" "}
                  km
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Distance from previous checkpoint (or start) to this one.
              </p>
              <div className="space-y-1.5">
                {draft.lapDistancesKm.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-6 text-right text-[11px] tabular text-muted-foreground">{idx + 1}.</span>
                    <Input
                      inputMode="decimal"
                      value={val}
                      onChange={(e) => {
                        const next = [...draft.lapDistancesKm];
                        next[idx] = e.target.value;
                        setDraft({ ...draft, lapDistancesKm: next });
                      }}
                      placeholder="e.g. 5"
                      className="h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const next = draft.lapDistancesKm.filter((_, i) => i !== idx);
                        setDraft({ ...draft, lapDistancesKm: next.length ? next : [""] });
                      }}
                      aria-label="Remove checkpoint"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => setDraft({ ...draft, lapDistancesKm: [...draft.lapDistancesKm, ""] })}
              >
                <Plus className="h-3.5 w-3.5" /> Add checkpoint
              </Button>
            </div>
          )}
        </>
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
