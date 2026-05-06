import { useEffect, useMemo, useRef, useState } from "react";
import { Athlete, DistanceUnit } from "@/lib/types";
import { useRaceStore } from "@/lib/store";
import { totalLapsFor } from "@/lib/race";
import { formatHM, parseHM } from "@/lib/format";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";


const downscaleImage = (file: File, max = 128): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(max, Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        // cover-crop to square
        const scale = size / Math.min(img.width, img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

interface AthleteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athlete?: Athlete | null;
}

const NONE_VALUE = "__none__";

const AthleteFormDialog = ({ open, onOpenChange, athlete }: AthleteFormDialogProps) => {
  const addAthlete = useRaceStore((s) => s.addAthlete);
  const updateAthlete = useRaceStore((s) => s.updateAthlete);
  const events = useRaceStore((s) => s.events);
  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.order - b.order), [events]);

  const [name, setName] = useState("");
  const [lapDistance, setLapDistance] = useState("");
  const [targetDistance, setTargetDistance] = useState("");
  const [unit, setUnit] = useState<DistanceUnit>("km");
  const [alertMinutes, setAlertMinutes] = useState("3");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [goalDistanceKm, setGoalDistanceKm] = useState("");
  const [goalHM, setGoalHM] = useState("");
  const [paceMS, setPaceMS] = useState(""); // "MM:SS" required pace per unit
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(athlete?.name ?? "");
      setLapDistance(athlete ? String(athlete.lapDistance) : "");
      setTargetDistance(athlete ? String(athlete.targetDistance) : "");
      setUnit(athlete?.unit ?? "km");
      setAlertMinutes(String(athlete?.alertMinutes ?? 3));
      setPhotoUrl(athlete?.photoUrl);
      setEventId(athlete?.eventId);
      setGoalDistanceKm(athlete?.goalDistanceKm ? String(athlete.goalDistanceKm) : "");
      const m = athlete?.goalDurationMinutes ?? 0;
      setGoalHM(m > 0 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "");
      setPaceMS("");
    }
  }, [open, athlete]);

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await downscaleImage(file, 128);
      setPhotoUrl(url);
    } catch {
      // ignore
    }
  };

  const lapDistanceNum = parseFloat(lapDistance) || 0;
  const alertMinutesNum = Math.max(0, parseFloat(alertMinutes) || 0);
  const selectedEvent = sortedEvents.find((e) => e.id === eventId);

  // When an event is selected, the target distance is derived from the event/goal — no separate Target field.
  // - distance event: target = event.distanceKm (converted to athlete unit)
  // - time event: target = goalDistanceKm (km, converted to athlete unit)
  // - no event: user enters target manually.
  const kmToUnit = (km: number) => (unit === "mi" ? km / 1.609344 : km);
  let derivedTarget = 0;
  if (selectedEvent?.kind === "distance" && selectedEvent.distanceKm) {
    derivedTarget = kmToUnit(selectedEvent.distanceKm);
  } else if (selectedEvent?.kind === "time") {
    const g = parseFloat(goalDistanceKm) || 0;
    derivedTarget = g > 0 ? kmToUnit(g) : 0;
  }
  const targetDistanceNum = selectedEvent ? derivedTarget : parseFloat(targetDistance) || 0;
  const previewLaps = lapDistanceNum > 0 && targetDistanceNum > 0
    ? totalLapsFor({ id: "", name: "", lapDistance: lapDistanceNum, targetDistance: targetDistanceNum, unit, alertMinutes: 0, createdAt: 0 })
    : 0;

  const valid = name.trim() && lapDistanceNum > 0 && targetDistanceNum > 0;

  const onSubmit = () => {
    if (!valid) return;
    const goalDurationMinutes = selectedEvent?.kind === "distance" ? parseHM(goalHM) : undefined;
    const goalDistance = selectedEvent?.kind === "time" ? parseFloat(goalDistanceKm) || undefined : undefined;
    const payload = {
      name: name.trim(),
      lapDistance: lapDistanceNum,
      targetDistance: targetDistanceNum,
      unit,
      alertMinutes: alertMinutesNum,
      photoUrl,
      eventId: eventId,
      goalDistanceKm: goalDistance,
      goalDurationMinutes: goalDurationMinutes && goalDurationMinutes > 0 ? goalDurationMinutes : undefined,
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
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Label>Photo</Label>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  {photoUrl && <AvatarImage src={photoUrl} alt={name || "athlete"} />}
                  <AvatarFallback>
                    {(name.trim()[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickPhoto(e.target.files?.[0])}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Upload className="h-4 w-4" /> {photoUrl ? "Change" : "Upload"}
                </Button>
                {photoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl(undefined)} className="gap-1.5">
                    <X className="h-4 w-4" /> Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2 w-24">
              <Label htmlFor="alert">Alert (min)</Label>
              <Input
                id="alert"
                inputMode="decimal"
                value={alertMinutes}
                onChange={(e) => setAlertMinutes(e.target.value)}
                placeholder="3"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Carter" autoFocus />
          </div>

          <div className="space-y-2">
            <Label>Race event</Label>
            {sortedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No events defined yet. Create events in Settings to assign one here.
              </p>
            ) : (
              <Select
                value={eventId ?? NONE_VALUE}
                onValueChange={(v) => setEventId(v === NONE_VALUE ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— None —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— None —</SelectItem>
                  {sortedEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} · {e.kind === "distance" ? `${e.distanceKm} km` : formatHM(e.durationMinutes ?? 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedEvent?.kind === "distance" && (() => {
              const distKm = selectedEvent.distanceKm ?? 0;
              const distInUnit = unit === "mi" ? distKm / 1.609344 : distKm;

              // Parse pace input: accepts "MM:SS", "MM", or "MM.S" (decimal minutes)
              const parseMS = (s: string): number => {
                if (!s) return 0;
                const trimmed = s.trim();
                const colon = trimmed.match(/^(\d+):(\d{1,2})$/);
                if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
                const dec = parseFloat(trimmed);
                if (!isNaN(dec) && dec > 0) return dec * 60;
                return 0;
              };
              const fmtMS = (sec: number): string => {
                if (!sec || sec <= 0) return "";
                const m = Math.floor(sec / 60);
                const s = Math.round(sec - m * 60);
                return `${m}:${String(s).padStart(2, "0")}`;
              };

              const recomputeGoalFromPace = (paceStr: string) => {
                const secPerUnit = parseMS(paceStr);
                if (secPerUnit > 0 && distInUnit > 0) {
                  const totalMin = (secPerUnit * distInUnit) / 60;
                  const hh = Math.floor(totalMin / 60);
                  const mm = Math.round(totalMin - hh * 60);
                  setGoalHM(`${hh}:${String(mm).padStart(2, "0")}`);
                } else {
                  setGoalHM("");
                }
              };

              const onPaceChange = (v: string) => {
                setPaceMS(v);
                recomputeGoalFromPace(v);
              };
              const onGoalChange = (v: string) => {
                setGoalHM(v);
                const goalMin = parseHM(v);
                if (goalMin > 0 && distInUnit > 0) {
                  const secPerUnit = (goalMin * 60) / distInUnit;
                  setPaceMS(fmtMS(secPerUnit));
                }
              };

              // Display pace: prefer user input, otherwise derive from goal
              const goalMin = parseHM(goalHM);
              const derivedPaceSec = goalMin > 0 && distInUnit > 0 ? (goalMin * 60) / distInUnit : 0;
              const paceValue = paceMS !== "" ? paceMS : (derivedPaceSec > 0 ? fmtMS(derivedPaceSec) : "");

              return (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="pace-input" className="text-xs">Required pace (MM:SS / {unit})</Label>
                    <Input
                      id="pace-input"
                      inputMode="numeric"
                      value={paceValue}
                      onChange={(e) => onPaceChange(e.target.value)}
                      placeholder="5:30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="goal-time" className="text-xs">Goal finish time (HH:MM)</Label>
                    <Input
                      id="goal-time"
                      inputMode="numeric"
                      value={goalHM}
                      onChange={(e) => onGoalChange(e.target.value)}
                      placeholder="5:00"
                    />
                  </div>
                </div>
              );
            })()}
            {selectedEvent?.kind === "time" && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="goal-km" className="text-xs">Goal distance (km)</Label>
                <Input
                  id="goal-km"
                  inputMode="decimal"
                  value={goalDistanceKm}
                  onChange={(e) => setGoalDistanceKm(e.target.value)}
                  placeholder="100"
                />
              </div>
            )}
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lap">Lap ({unit})</Label>
              <Input
                id="lap"
                inputMode="decimal"
                value={lapDistance}
                onChange={(e) => setLapDistance(e.target.value)}
                placeholder="6.7"
              />
            </div>
            {!selectedEvent ? (
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
            ) : (
              <div className="space-y-2">
                <Label className="text-muted-foreground">Target ({unit})</Label>
                <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-muted/40 px-3 text-sm tabular">
                  {derivedTarget > 0 ? derivedTarget.toFixed(2) : "—"}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="alert">Alert (min)</Label>
              <Input
                id="alert"
                inputMode="decimal"
                value={alertMinutes}
                onChange={(e) => setAlertMinutes(e.target.value)}
                placeholder="3"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Notify when predicted arrival is within this many minutes. Set to 0 to disable.
          </p>

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
