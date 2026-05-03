// Step 3: Basic Web Bluetooth scanner.
// - Requests a single device via the chooser (browser-native permission flow).
// - Adds detected devices to a local list.
// - Does NOT connect to AutoLap logic yet.
import { useState } from "react";
import { Bluetooth, BluetoothSearching, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
      // Basic request: any device. The browser shows its native permission/chooser UI.
      const device: BluetoothDevice = await (navigator as any).bluetooth.requestDevice({
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
        // User dismissed the chooser without picking — not really an error.
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

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bluetooth devices
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Scan for nearby devices. Connection comes later.
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
          {devices.map((d) => (
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
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeDevice(d.id)}
                aria-label="Remove device"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BluetoothScanner;
