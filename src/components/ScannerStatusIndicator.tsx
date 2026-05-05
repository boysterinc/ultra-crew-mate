// Global Bluetooth scanner debug indicator.
// Shows live scanning status + last scan tick timestamp on every page.
// Reads from the singleton useAutoLapScanner store (module-level state),
// so it reflects the global manager — not any per-page lifecycle.
import { useEffect, useState } from "react";
import { Radio, RadioTower } from "lucide-react";
import { useAutoLapScanner } from "@/lib/autoLapScanner";

const formatClock = (ts: number | null) => {
  if (!ts) return "--:--:--";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const ScannerStatusIndicator = () => {
  const status = useAutoLapScanner((s) => s.status);
  const lastSeenAt = useAutoLapScanner((s) => s.lastSeenAt);
  const detectedDevices = useAutoLapScanner((s) => s.detectedDevices);

  // Tick every second so "last scan" timestamp updates even with no devices.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Hide when scanner is fully idle (e.g. AutoLap locked) — nothing to show.
  if (status === "idle") return null;

  // Most recent advertisement across all devices.
  const lastScanTime = Object.values(lastSeenAt).reduce<number | null>(
    (acc, t) => (t && (!acc || t > acc) ? t : acc),
    null
  );
  const deviceCount = Object.keys(detectedDevices).length;
  const active = status === "scanning";

  const label = active
    ? "Scanning…"
    : status === "unsupported"
      ? "BT n/a"
      : status === "error"
        ? "BT error"
        : "Idle";

  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border bg-card/60 px-1.5 py-0.5 text-[10px] leading-tight"
      title={`Bluetooth scanner: ${status} • ${deviceCount} device(s) seen`}
    >
      {active ? (
        <RadioTower className="h-3 w-3 text-primary animate-pulse" />
      ) : (
        <Radio className="h-3 w-3 text-muted-foreground" />
      )}
      <div className="flex flex-col">
        <span
          className={
            active ? "font-semibold text-primary" : "font-semibold text-muted-foreground"
          }
        >
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatClock(lastScanTime)}
        </span>
      </div>
    </div>
  );
};

export default ScannerStatusIndicator;
