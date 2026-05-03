// Step 3+: Web Bluetooth scanner with athlete assignment.
// - Scans devices via the browser-native chooser.
// - Lets the user assign a scanned device NAME to an athlete (no pairing).
// - Saves into the same device_name mapping store used in Step 2.
import { useState } from "react";
import {
  Bluetooth,
  BluetoothSearching,
  AlertTriangle,
  Trash2,
  RefreshCw,
  UserPlus,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type DetectedDevice = {
  id: string;
  name: string;
};

type BlockReason =
  | "unsupported"
  | "insecure"
  | "permission"
  | "cancelled"
  | "error"
  | null;

const isWebBluetoothSupported = () =>
  typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

const isSecureContextOk = () =>
  typeof window !== "undefined" &&
  (window.isSecureContext || window.location.hostname === "localhost");

const BluetoothScanner = () => {
  const [devices, setDevices] = useState<DetectedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [blocked, setBlocked] = useState<BlockReason>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [assignDevice, setAssignDevice] = useState<DetectedDevice | null>(null);
  const [assignAthleteId, setAssignAthleteId] = useState<string>("");

  const athletes = useRaceStore((s) => s.athletes);
  const mappings = useDeviceMappingStore((s) => s.mappings);
  const setMapping = useDeviceMappingStore((s) => s.setMapping);

  const handleScan = async () => {
    setErrorMsg(null);
    setBlocked(null);

    if (!isSecureContextOk()) {
      setBlocked("insecure");
      return;
    }
    if (!isWebBluetoothSupported()) {
      setBlocked("unsupported");
      return;
    }

    setScanning(true);
    try {
      const device: { id: string; name?: string } = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [],
      });

      const detected: DetectedDevice = {
        id: device.id,
        name: device.name || "(Unnamed device)",
      };

      setDevices((prev) => {
        if (prev.some((d) => d.id === detected.id)) return prev;
        return [...prev, detected];
      });
      toast.success(`Detected: ${detected.name}`);
    } catch (err: any) {
      const name = err?.name || "";
      const msg = err?.message || String(err);
      if (name === "NotFoundError") {
        setBlocked("cancelled");
      } else if (name === "SecurityError" || /permission/i.test(msg)) {
        setBlocked("permission");
      } else if (name === "NotSupportedError") {
        setBlocked("unsupported");
      } else {
        setBlocked("error");
        setErrorMsg(msg);
      }
    } finally {
      setScanning(false);
    }
  };

  const removeDevice = (id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  };

  const openAssign = (device: DetectedDevice) => {
    setAssignDevice(device);
    setAssignAthleteId("");
  };

  const closeAssign = () => {
    setAssignDevice(null);
    setAssignAthleteId("");
  };

  const confirmAssign = () => {
    if (!assignDevice) return;
    const athlete = athletes.find((a) => a.id === assignAthleteId);
    if (!athlete) {
      toast.error("Select an athlete");
      return;
    }
    // Store ONLY the device name on the mapping. No pairing/connection.
    setMapping(athlete.id, athlete.name, assignDevice.name);
    toast.success(`Assigned ${assignDevice.name} → ${athlete.name}`);
    closeAssign();
  };

  // Helper: which athlete (if any) currently has this device name assigned.
  const assignedAthleteName = (deviceName: string) =>
    mappings.find((m) => m.device_name === deviceName)?.athlete_name;

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bluetooth devices
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Scan, then assign a device name to an athlete. No pairing.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleScan}
          disabled={scanning}
          className="gap-1"
        >
          {scanning ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <BluetoothSearching className="h-3.5 w-3.5" /> Scan Devices
            </>
          )}
        </Button>
      </div>

      {blocked && blocked !== "cancelled" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-destructive">
              {blocked === "unsupported" && "Bluetooth not supported"}
              {blocked === "insecure" && "Secure context required"}
              {blocked === "permission" && "Bluetooth permission blocked"}
              {blocked === "error" && "Scan failed"}
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Enable Bluetooth on this device.</li>
              <li>Use Google Chrome or Microsoft Edge (desktop or Android).</li>
              <li>Open the app over HTTPS (or localhost).</li>
              {blocked === "permission" && (
                <li>Allow Bluetooth permission in your browser/site settings.</li>
              )}
            </ul>
            {errorMsg && (
              <p className="text-[11px] text-destructive/80 break-words">
                Details: {errorMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {blocked === "cancelled" && (
        <p className="text-[11px] text-muted-foreground">
          No device selected. Click <span className="font-medium">Scan Devices</span> to try again.
        </p>
      )}

      {devices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-center text-xs text-muted-foreground">
          No devices detected yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {devices.map((d) => {
            const assignedTo = assignedAthleteName(d.name);
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bluetooth className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate tabular">
                      ID: {d.id}
                    </p>
                    {assignedTo && (
                      <p className="text-[11px] text-primary truncate flex items-center gap-1">
                        <Check className="h-3 w-3" /> Assigned to {assignedTo}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    onClick={() => openAssign(d)}
                    aria-label="Assign to athlete"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDevice(d.id)}
                    aria-label="Remove device"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!assignDevice} onOpenChange={(o) => !o && closeAssign()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign device to athlete</DialogTitle>
            <DialogDescription>
              The device name will be saved on the athlete's mapping. No pairing happens.
            </DialogDescription>
          </DialogHeader>

          {assignDevice && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Device
                </p>
                <p className="text-sm font-semibold truncate flex items-center gap-1">
                  <Bluetooth className="h-3.5 w-3.5 text-primary" />
                  {assignDevice.name}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Athlete</Label>
                {athletes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No athletes available. Add athletes first.
                  </p>
                ) : (
                  <Select value={assignAthleteId} onValueChange={setAssignAthleteId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select an athlete" />
                    </SelectTrigger>
                    <SelectContent>
                      {athletes.map((a) => {
                        const existing = mappings.find((m) => m.athlete_id === a.id);
                        return (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                            {existing ? ` — current: ${existing.device_name}` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closeAssign}>
              Cancel
            </Button>
            <Button onClick={confirmAssign} disabled={!assignAthleteId}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BluetoothScanner;
