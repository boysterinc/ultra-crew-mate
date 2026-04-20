import { useEffect, useState } from "react";
import { Athlete, DistanceUnit } from "@/lib/types";
import { useRaceStore } from "@/lib/store";
import { totalLapsFor } from "@/lib/race";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface AthleteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athlete?: Athlete | null;
}

const AthleteFormDialog = ({ open, onOpenChange, athlete }: AthleteFormDialogProps) => {
  const addAthlete = useRaceStore((s) => s.addAthlete);
  const updateAthlete = useRaceStore((s) => s.updateAthlete);

  const [name, setName] = useState("");
  const [lapDistance, setLapDistance] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [alertMinutes, setAlertMinutes] = useState("3");

  useEffect(() => {
    if (open) {
      setName(athlete?.name ?? "");
      setLapDistance(athlete ? String(athlete.lapDistance) : "");
      setTargetDistance(athlete ? String(athlete.targetDistance) : "");
      setUnit(athlete?.unit ?? "km");
      setAlertMinutes(String(athlete?.alertMinutes ?? 3));
    }
  }, [open, athlete]);

  const lapDistanceNum = parseFloat(lapDistance) || 0;
  const targetDistanceNum = parseFloat(targetDistance) || 0;
  const alertMinutesNum = Math.max(0, parseFloat(alertMinutes) || 0);
  const previewLaps = lapDistanceNum > 0 && targetDistanceNum > 0
    ? totalLapsFor({ id: "", name: "", lapDistance: lapDistanceNum, targetDistance: targetDistanceNum, unit, alertMinutes: 0, createdAt: 0 })
    : 0;

  const valid = name.trim() && lapDistanceNum > 0 && targetDistanceNum > 0;

  const onSubmit = () => {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      lapDistance: lapDistanceNum,
      targetDistance: targetDistanceNum,
      unit,
      alertMinutes: alertMinutesNum,
    };
    if (athlete) {
      updateAthlete(athlete.id, payload);
    } else {
      addAthlete(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{athlete ? "Edit athlete" : "Add athlete"}</DialogTitle>
          <DialogDescription>Set the athlete name, loop distance, and total target.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Carter" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <ToggleGroup
              type="single"
              value={unit}
              onValueChange={(v) => v && setUnit(v as DistanceUnit)}
              className="justify-start"
            >
              <ToggleGroupItem value="km" className="px-6">km</ToggleGroupItem>
              <ToggleGroupItem value="mi" className="px-6">mi</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lap">Lap distance ({unit})</Label>
              <Input
                id="lap"
                inputMode="decimal"
                value={lapDistance}
                onChange={(e) => setLapDistance(e.target.value)}
                placeholder="6.7"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target ({unit})</Label>
              <Input
                id="target"
                inputMode="decimal"
                value={targetDistance}
                onChange={(e) => setTargetDistance(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>
          {previewLaps > 0 && (
            <div className="rounded-xl bg-secondary/60 p-3 text-sm">
              <span className="text-muted-foreground">Total laps:</span>{" "}
              <span className="font-bold tabular text-primary">{previewLaps}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!valid}>{athlete ? "Save" : "Add athlete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AthleteFormDialog;
