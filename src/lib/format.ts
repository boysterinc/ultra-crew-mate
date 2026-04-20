export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatPace(secondsPerUnit: number, unit: "km" | "mi"): string {
  if (!isFinite(secondsPerUnit) || secondsPerUnit <= 0) return "—";
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${String(s).padStart(2, "0")}/${unit}`;
}

export function formatClock(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function formatShortClock(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDistance(d: number, unit: "km" | "mi"): string {
  return `${d.toFixed(d >= 100 ? 0 : d >= 10 ? 1 : 2)} ${unit}`;
}
