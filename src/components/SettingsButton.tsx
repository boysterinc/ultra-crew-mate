import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRaceStore } from "@/lib/store";

const SettingsButton = () => {
  const threshold = useRaceStore((s) => s.settings.doubleTapThresholdMinutes);
  const setThreshold = useRaceStore((s) => s.setDoubleTapMinutes);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(threshold));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setValue(String(threshold)); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Tune the safety guards for race-day taps.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
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
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              const n = parseFloat(value);
              if (!isNaN(n) && n >= 0) setThreshold(n);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsButton;
