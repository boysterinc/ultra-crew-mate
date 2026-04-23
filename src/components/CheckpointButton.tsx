import { useEffect, useRef, useState } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import { Athlete } from "@/lib/types";
import { useRaceStore } from "@/lib/store";
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
import { formatDuration } from "@/lib/format";

interface CheckpointButtonProps {
  athlete: Athlete;
  lastTimestamp?: number;
  size?: "lg" | "md" | "sm";
  isStart?: boolean;
}

const CheckpointButton = ({ athlete, lastTimestamp, size = "md", isStart = false }: CheckpointButtonProps) => {
  const recordLap = useRaceStore((s) => s.recordLap);
  const threshold = useRaceStore((s) => s.settings.doubleTapThresholdMinutes);
  const [confirming, setConfirming] = useState(false);
  const [pressed, setPressed] = useState(false);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  const triggerLap = () => {
    const lap = recordLap(athlete.id);
    if (lap) {
      toast.success(`Lap ${lap.lapNumber} • ${athlete.name}`, {
        description: lap.lapTime > 0 ? `Lap time ${formatDuration(lap.lapTime)}` : "First checkpoint logged",
      });
      setPressed(true);
      flashTimer.current = window.setTimeout(() => setPressed(false), 600);
    }
  };

  const onClick = () => {
    if (lastTimestamp) {
      const elapsedMin = (Date.now() - lastTimestamp) / 60000;
      if (elapsedMin < threshold) {
        setConfirming(true);
        return;
      }
    }
    triggerLap();
  };

  return (
    <>
      <button
        onClick={onClick}
        className={cn(
          "group relative w-full select-none rounded-xl gradient-primary font-bold uppercase tracking-wider text-primary-foreground shadow-glow transition-transform active:scale-[0.97]",
          size === "lg" ? "h-24 text-2xl" : size === "sm" ? "h-10 text-[11px] tracking-wide" : "h-20 text-xl",
          pressed && "ring-4 ring-primary-glow/60"
        )}
      >
        <span className={cn("flex items-center justify-center", size === "sm" ? "gap-1" : "gap-2")}>
          <Zap className={size === "sm" ? "h-3.5 w-3.5" : "h-6 w-6"} strokeWidth={2.5} />
          {size === "sm" ? "Lap" : "Checkpoint"}
        </span>
      </button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Log lap so soon?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Last checkpoint for <span className="font-semibold text-foreground">{athlete.name}</span> was less than{" "}
              {threshold} min ago. This may be a double-tap.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                triggerLap();
                setConfirming(false);
              }}
            >
              Yes, log lap
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CheckpointButton;
