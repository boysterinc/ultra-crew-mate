import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useRaceStore } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight, Plus, X, Pencil, Check } from "lucide-react";
import AthleteSwitcher from "@/components/AthleteSwitcher";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { formatDuration, formatPace, formatClock, formatDistance, formatHM } from "@/lib/format";
import { totalLapsFor, distanceCovered, avgRecentLapTime } from "@/lib/race";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Lap } from "@/lib/types";

const pad2 = (n: number) => String(n).padStart(2, "0");
const tsToDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const tsToTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const AthleteDetail = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const allLaps = useRaceStore((s) => s.laps);
  const deleteLap = useRaceStore((s) => s.deleteLap);
  const addManualLap = useRaceStore((s) => s.addManualLap);
  const updateLapTimestamp = useRaceStore((s) => s.updateLapTimestamp);
  const planFor = useRaceStore((s) => s.planFor);
  const logFor = useRaceStore((s) => s.logFor);
  const toggleLogItem = useRaceStore((s) => s.toggleLogItem);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [editLap, setEditLap] = useState<Lap | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [confirmDeleteLap, setConfirmDeleteLap] = useState<Lap | null>(null);
  const navigate = useNavigate();

  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;

  const laps = useMemo(
    () =>
      athlete
        ? allLaps.filter((l) => l.athleteId === athlete.id).sort((a, b) => a.lapNumber - b.lapNumber)
        : [],
    [allLaps, athlete]
  );

  const chartData = laps
    .filter((l) => l.lapTime > 0)
    .map((l) => ({ lap: l.lapNumber, minutes: +(l.lapTime / 60).toFixed(2) }));

  if (!athlete) {
    return (
      <AppShell title="Athlete">
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No athlete selected.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Go to dashboard</Button>
        </div>
      </AppShell>
    );
  }

  const totalLaps = totalLapsFor(athlete);
  const distance = distanceCovered(athlete, laps.length);

  const openEdit = (l: Lap) => {
    setEditLap(l);
    setEditDate(tsToDate(l.timestamp));
    setEditTime(tsToTime(l.timestamp));
  };

  const saveEdit = () => {
    if (!editLap) return;
    if (!editDate || !editTime) {
      toast.error("Pick a date and time");
      return;
    }
    const ts = new Date(`${editDate}T${editTime}`).getTime();
    if (!isFinite(ts)) {
      toast.error("Invalid date/time");
      return;
    }
    if (ts > Date.now() + 60_000) {
      toast.error("Time can't be in the future");
      return;
    }
    updateLapTimestamp(editLap.id, ts);
    toast.success(`Lap updated to ${formatClock(ts)}`);
    setEditLap(null);
  };

  return (
    <AppShell title={athlete.name}>
      <AthleteSwitcher athletes={athletes} selectedId={athlete.id} onSelect={selectAthlete} />
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border gradient-card p-4 text-center shadow-card">
        <Stat label="Laps" value={`${laps.length}/${totalLaps}`} />
        <Stat label="Distance" value={formatDistance(distance, athlete.unit)} />
        <Stat label="Lap dist" value={`${athlete.lapDistance} ${athlete.unit}`} />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Lap times
        </h2>
        <div className="h-48 w-full rounded-2xl border border-border bg-card p-2">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No completed laps yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="lap"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  width={36}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} min`, "Lap time"]}
                  labelFormatter={(l) => `Lap ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Lap history
          </h2>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => navigate("/nutrition")} className="gap-1 text-xs">
              Edit plans <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() => {
                const now = new Date();
                setManualDate(tsToDate(now.getTime()));
                setManualTime(tsToTime(now.getTime()));
                setManualOpen((v) => !v);
              }}
            >
              {manualOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {manualOpen ? "Cancel" : "Manual lap"}
            </Button>
          </div>
        </div>

        {manualOpen && (
          <div className="mb-2 rounded-2xl border border-primary/40 bg-card p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Add a checkpoint you forgot to tap. Lap times will be recalculated from this timestamp.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-date" className="text-xs">Date</Label>
                <Input
                  id="m-date"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-time" className="text-xs">Time (HH:MM)</Label>
                <Input
                  id="m-time"
                  type="time"
                  step="60"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setManualOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!manualDate || !manualTime) {
                    toast.error("Pick a date and time");
                    return;
                  }
                  const ts = new Date(`${manualDate}T${manualTime}`).getTime();
                  if (!isFinite(ts)) {
                    toast.error("Invalid date/time");
                    return;
                  }
                  if (ts > Date.now() + 60_000) {
                    toast.error("Time can't be in the future");
                    return;
                  }
                  const inserted = addManualLap(athlete.id, ts);
                  if (inserted) {
                    toast.success(`Lap ${inserted.lapNumber} added at ${formatClock(inserted.timestamp)}`);
                    setManualOpen(false);
                  }
                }}
              >
                Add lap
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {laps.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Tap Lap on the dashboard to start logging.
            </p>
          )}
          {[...laps].reverse().map((l) => {
            const plan = planFor(athlete.id, l.lapNumber);
            const log = logFor(athlete.id, l.lapNumber);
            const km = l.lapNumber * athlete.lapDistance;
            return (
              <div key={l.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lap</span>
                      <span className="tabular text-lg font-bold leading-none">{l.lapNumber}</span>
                      <span className="text-xs text-muted-foreground tabular">
                        ({km.toFixed(athlete.lapDistance % 1 === 0 ? 0 : 2)} {athlete.unit})
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular text-muted-foreground">
                      <span>⏱ {formatClock(l.timestamp)}</span>
                      <span>Δ {l.lapTime > 0 ? formatDuration(l.lapTime) : "—"}</span>
                      <span>{l.pace > 0 ? formatPace(l.pace, athlete.unit) : "—"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(l)}
                      aria-label="Edit lap"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteLap(l)}
                      aria-label="Delete lap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {plan && plan.items.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                    {plan.items.map((item) => {
                      const checked = log?.completedItemIds.includes(item.id) ?? false;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => toggleLogItem(athlete.id, l.lapNumber, item.id)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-secondary/40 text-muted-foreground line-through hover:border-primary/60"
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                            {item.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Edit lap dialog */}
      <Dialog open={!!editLap} onOpenChange={(v) => !v && setEditLap(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit lap {editLap?.lapNumber}</DialogTitle>
            <DialogDescription>
              Change the checkpoint time. Toggle nutrition items below to update what was actually consumed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-date" className="text-xs">Date</Label>
              <Input id="e-date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-time" className="text-xs">Time (HH:MM)</Label>
              <Input id="e-time" type="time" step="60" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
            </div>
          </div>

          {editLap && (() => {
            const plan = planFor(athlete.id, editLap.lapNumber);
            const log = logFor(athlete.id, editLap.lapNumber);
            if (!plan || plan.items.length === 0) {
              return (
                <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No nutrition items planned for this lap.
                </p>
              );
            }
            return (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nutrition received
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {plan.items.map((item) => {
                    const checked = log?.completedItemIds.includes(item.id) ?? false;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => toggleLogItem(athlete.id, editLap.lapNumber, item.id)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-secondary/40 text-muted-foreground line-through hover:border-primary/60"
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditLap(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete lap */}
      <AlertDialog open={!!confirmDeleteLap} onOpenChange={(v) => !v && setConfirmDeleteLap(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lap {confirmDeleteLap?.lapNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the checkpoint at{" "}
              <span className="font-semibold text-foreground tabular">
                {confirmDeleteLap ? formatClock(confirmDeleteLap.timestamp) : ""}
              </span>
              . Subsequent laps will be renumbered. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDeleteLap) {
                  deleteLap(confirmDeleteLap.id);
                  toast.success(`Lap ${confirmDeleteLap.lapNumber} deleted`);
                }
                setConfirmDeleteLap(null);
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

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="tabular text-lg font-bold">{value}</p>
  </div>
);

export default AthleteDetail;
