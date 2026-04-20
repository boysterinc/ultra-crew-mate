import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Activity } from "lucide-react";
import AthleteCard from "@/components/AthleteCard";
import AthleteFormDialog from "@/components/AthleteFormDialog";
import SettingsButton from "@/components/SettingsButton";
import { useRaceStore } from "@/lib/store";
import { Athlete } from "@/lib/types";
import { nextEta, totalLapsFor } from "@/lib/race";
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

const Index = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const allLaps = useRaceStore((s) => s.laps);
  const deleteAthlete = useRaceStore((s) => s.deleteAthlete);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Athlete | null>(null);

  // Re-tick every 5s so ordering follows live ETA
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  const sortedAthletes = useMemo(() => {
    const now = Date.now();
    const score = (a: Athlete) => {
      const laps = allLaps
        .filter((l) => l.athleteId === a.id)
        .sort((x, y) => x.lapNumber - y.lapNumber);
      const finished = laps.length >= totalLapsFor(a);
      if (finished) return Number.POSITIVE_INFINITY; // push to bottom
      const eta = nextEta(laps);
      if (!eta) return Number.POSITIVE_INFINITY - 1; // no data yet → bottom (above finished)
      const ms = eta - now;
      // Overdue runners get the smallest score (most urgent), then soonest ETA
      return ms < 0 ? ms : ms;
    };
    return [...athletes].sort((a, b) => score(a) - score(b));
  }, [athletes, allLaps]);

  // Pair-based grid: round up to even count, max 8 visible per page
  const visibleCount = Math.min(8, sortedAthletes.length);
  const slotCount = Math.max(2, visibleCount + (visibleCount % 2));
  const placeholders = slotCount - visibleCount;
  // Columns: 2 athletes => 2 cols; 3-4 => 2 cols; 5-6 => 3 cols; 7-8 => 4 cols
  const cols =
    slotCount <= 4 ? "sm:grid-cols-2" : slotCount <= 6 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  const compact = slotCount >= 4;

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
        <div className={`grid grid-cols-1 ${cols} gap-3`}>
          {sortedAthletes.slice(0, 8).map((a) => (
            <AthleteCard
              key={a.id}
              athlete={a}
              compact={compact}
              onEdit={() => {
                setEditing(a);
                setFormOpen(true);
              }}
              onDelete={() => setConfirmDelete(a)}
            />
          ))}
          {Array.from({ length: placeholders }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="rounded-2xl border border-dashed border-border/50 bg-card/30"
              aria-hidden
            />
          ))}
        </div>
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

export default Index;
