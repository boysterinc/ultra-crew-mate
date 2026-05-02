import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRaceStore } from "@/lib/store";
import { useDeviceMappingStore } from "@/lib/deviceMapping";

const AutoLapDeviceMapping = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const mappings = useDeviceMappingStore((s) => s.mappings);
  const setMapping = useDeviceMappingStore((s) => s.setMapping);
  const removeMapping = useDeviceMappingStore((s) => s.removeMapping);

  const [adding, setAdding] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [deviceName, setDeviceName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDeviceName, setEditDeviceName] = useState("");

  const mappedIds = new Set(mappings.map((m) => m.athlete_id));
  const availableForAdd = athletes.filter((a) => !mappedIds.has(a.id));

  const startAdd = () => {
    setSelectedAthleteId("");
    setDeviceName("");
    setAdding(true);
  };

  const cancelAdd = () => {
    setAdding(false);
    setSelectedAthleteId("");
    setDeviceName("");
  };

  const saveAdd = () => {
    const athlete = athletes.find((a) => a.id === selectedAthleteId);
    if (!athlete) {
      toast.error("Select an athlete");
      return;
    }
    const trimmed = deviceName.trim();
    if (!trimmed) {
      toast.error("Enter a device name");
      return;
    }
    setMapping(athlete.id, athlete.name, trimmed);
    toast.success(`Mapped ${athlete.name} → ${trimmed}`);
    cancelAdd();
  };

  const startEdit = (athleteId: string, currentDevice: string) => {
    setEditingId(athleteId);
    setEditDeviceName(currentDevice);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDeviceName("");
  };

  const saveEdit = (athleteId: string, athleteName: string) => {
    const trimmed = editDeviceName.trim();
    if (!trimmed) {
      toast.error("Enter a device name");
      return;
    }
    setMapping(athleteId, athleteName, trimmed);
    toast.success("Device updated");
    cancelEdit();
  };

  const handleRemove = (athleteId: string, athleteName: string) => {
    removeMapping(athleteId);
    toast(`Removed mapping for ${athleteName}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Device mapping
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Link each athlete to a device name (Bluetooth comes later).
          </p>
        </div>
        {!adding && availableForAdd.length > 0 && (
          <Button size="sm" variant="secondary" onClick={startAdd} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>

      {mappings.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-center text-xs text-muted-foreground">
          No device mappings yet.
        </p>
      )}

      <ul className="space-y-2">
        {mappings.map((m) => {
          // Keep the displayed name in sync with current athlete name when possible.
          const athlete = athletes.find((a) => a.id === m.athlete_id);
          const displayName = athlete?.name ?? m.athlete_name;
          const isEditing = editingId === m.athlete_id;
          return (
            <li
              key={m.athlete_id}
              className="rounded-lg border border-border bg-card px-3 py-2"
            >
              {isEditing ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                      value={editDeviceName}
                      onChange={(e) => setEditDeviceName(e.target.value)}
                      placeholder="Device name"
                      className="h-8"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-primary"
                      onClick={() => saveEdit(m.athlete_id, displayName)}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={cancelEdit}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {m.device_name}
                    </p>
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => startEdit(m.athlete_id, m.device_name)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(m.athlete_id, displayName)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-card p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Athlete</Label>
            {availableForAdd.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All athletes already have a mapping.
              </p>
            ) : (
              <Select value={selectedAthleteId} onValueChange={setSelectedAthleteId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select an athlete" />
                </SelectTrigger>
                <SelectContent>
                  {availableForAdd.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-name" className="text-xs">
              Device name
            </Label>
            <Input
              id="device-name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Garmin-1234"
              className="h-9"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={cancelAdd}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveAdd}
              disabled={!selectedAthleteId || !deviceName.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {athletes.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Add athletes first to create device mappings.
        </p>
      )}
    </div>
  );
};

export default AutoLapDeviceMapping;
