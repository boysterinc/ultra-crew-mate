import { useState } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus, Activity } from "lucide-react";
import AthleteCard from "@/components/AthleteCard";
import AthleteFormDialog from "@/components/AthleteFormDialog";
import SettingsButton from "@/components/SettingsButton";
import { useRaceStore } from "@/lib/store";
import { Athlete } from "@/lib/types";
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
  const deleteAthlete = useRaceStore((s) => s.deleteAthlete);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Athlete | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Athlete | null>(null);

  return (
    <AppShell
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
        <div className="space-y-4">
          {athletes.map((a) => (
            <AthleteCard
              key={a.id}
              athlete={a}
              onEdit={() => {
                setEditing(a);
                setFormOpen(true);
              }}
              onDelete={() => setConfirmDelete(a)}
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
