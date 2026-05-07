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
  
  const [paceMin, setPaceMin] = useState("5");
  const [paceSec, setPaceSec] = useState("00");
  
  const fileRef = useRef<HTMLInputElement>(null);

  const minuteOptions = Array.from({ length: 100 }, (_, i) => String(i));
  const secondOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

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
      
      // @ts-ignore
      const oldPace = athlete?.targetPace || "5:00";
      const parts = oldPace.includes(':') ? oldPace.split(':') : oldPace.split('.');
      if (parts.length === 2) {
        setPaceMin(parts[0]);
        setPaceSec(parts[1].padStart(2, '0'));
      }

      const m = athlete?.goalDurationMinutes ?? 0;
      setGoalHM(m > 0 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : "");
    }
  }, [open, athlete]);

  useEffect(() => {
    const pMin = parseInt(paceMin) || 0;
    const pSec = parseInt(paceSec) || 0;
    const totalPaceSeconds = (pMin * 60) + pSec;
    const selectedEvent = events.find(e => e.id === eventId);

    if (totalPaceSeconds > 0) {
      if (selectedEvent?.kind === 'distance') {
        const distKm = selectedEvent.distanceKm ?? 0;
        const distInUnit = unit === "mi" ? distKm / 1.609344 : distKm;
        const totalFinishSec = totalPaceSeconds * distInUnit;
        
        const hh = Math.floor(totalFinishSec / 3600);
        const mm = Math.floor((totalFinishSec % 3600) / 60);
        const ss = Math.round(totalFinishSec % 60);
        setGoalHM(`${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`);
      } else if (selectedEvent?.kind === 'time') {
        const durMin = selectedEvent.durationMinutes ?? 0;
        const totalRaceSec = durMin * 60;
        const distResult = totalRaceSec / totalPaceSeconds;
        setGoalDistanceKm(distResult.toFixed(2));
      }
    }
  }, [paceMin, paceSec, eventId, unit, events]);

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await downscaleImage(file, 128);
      setPhotoUrl(url);
    } catch { /* ignore */ }
  };

  const lapDistanceNum = parseFloat(lapDistance) || 0;
  const alertMinutesNum = Math.max(0, parseFloat(alertMinutes) || 0);
  const selectedEvent = sortedEvents.find((e) => e.id === eventId);
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

  const valid = name.trim() && lapDistanceNum > 0 && (selectedEvent ? true : targetDistanceNum > 0);

  const onSubmit = () => {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      lapDistance: lapDistanceNum,
      targetDistance: targetDistanceNum,
      unit,
      alertMinutes: alertMinutesNum,
      photoUrl,
      eventId: eventId,
      targetPace: `${paceMin}:${paceSec}`, 
      goalDistanceKm: selectedEvent?.kind === "time" ? parseFloat(goalDistanceKm) : undefined,
      goalDurationMinutes: selectedEvent?.kind === "distance" ? parseHM(goalHM) : undefined,
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
                  <AvatarFallback>{(name.trim()[0] || "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickPhoto(e.target.files?.[0])} />
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Upload className="h-4 w-4" /> {photoUrl ? "Change" : "Upload"}
                </Button>
                {photoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoUrl(undefined)} className="gap-1.5">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2 w-24 text-right">
              <Label htmlFor="alert">Alert (min)</Label>
              <Input id="alert" inputMode="decimal" value={alertMinutes} onChange={(e) => setAlertMinutes(e.target.value)} placeholder="3" className="text-right" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="boy" />
          </div>

          <div className="space-y-2">
            <Label>Race event</Label>
            <Select value={eventId ?? NONE_VALUE} onValueChange={(v) => setEventId(v === NONE_VALUE ? undefined : v)}>
              <SelectTrigger className="border-primary/50">
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
          </div>

          <div className="space-y-2">
            <Label>Unit</Label>
            <ToggleGroup type="single" value={unit} onValueChange={(v) => v && setUnit(v as DistanceUnit)} className="justify-start">
              <ToggleGroupItem value="km" className="px-6">km</ToggleGroupItem>
              <ToggleGroupItem value="mi" className="px-6">mi</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-[0.7fr_1.5fr_1fr] gap-3 items-end">
            <div className="space-y-2">
              <Label className="text-xs">{unit}/lap</Label>
              <Input inputMode="decimal" value={lapDistance} onChange={(e) => setLapDistance(e.target.value)} placeholder="2.2" />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold">Target pace (min/{unit})</Label>
              <div className="flex items-center gap-1">
                <Select value={paceMin} onValueChange={setPaceMin}>
                  <SelectTrigger className="h-10 w-full px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map(m => (
                      <SelectItem key={m} value={m}>{m} m</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <span className="font-bold">:</span>

                <Select value={paceSec} onValueChange={setPaceSec}>
                  <SelectTrigger className="h-10 w-full px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {secondOptions.map(s => (
                      <SelectItem key={s} value={s}>{s} s</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {selectedEvent?.kind === 'time' ? "Goal Dist" : "Goal Time"}
              </Label>
              <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-muted/40 px-2 text-[12px] tabular overflow-hidden font-bold text-primary">
                {selectedEvent?.kind === 'time' ? `${parseFloat(goalDistanceKm) || 0} ${unit}` : (goalHM || "—")}
              </div>
            </div>
          </div>

          {previewLaps > 0 && (
            <div className="rounded-xl bg-secondary/40 p-3 text-sm">
              <span className="text-muted-foreground">Total laps:</span>{" "}
              <span className="font-bold tabular text-primary">{previewLaps}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!valid} className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AthleteFormDialog;
