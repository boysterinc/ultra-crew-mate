import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import { useRaceStore } from "@/lib/store";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight } from "lucide-react";
import AthleteSwitcher from "@/components/AthleteSwitcher";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { formatDuration, formatPace, formatClock, formatDistance } from "@/lib/format";
import { totalLapsFor, distanceCovered } from "@/lib/race";
import { Checkbox } from "@/components/ui/checkbox";

const AthleteDetail = () => {
  const athletes = useRaceStore((s) => s.athletes);
  const selectedId = useRaceStore((s) => s.selectedAthleteId);
  const selectAthlete = useRaceStore((s) => s.selectAthlete);
  const allLaps = useRaceStore((s) => s.laps);
  const deleteLap = useRaceStore((s) => s.deleteLap);
  const planFor = useRaceStore((s) => s.planFor);
  const logFor = useRaceStore((s) => s.logFor);
  const toggleLogItem = useRaceStore((s) => s.toggleLogItem);
  const navigate = useNavigate();

  const athlete = athletes.find((a) => a.id === selectedId) ?? athletes[0] ?? null;

  const laps = useMemo(
    () =>
      athlete
        ? allLaps.filter((l) => l.athleteId === athlete.id).sort((a, b) => a.lapNumber - b.lapNumber)
        : [],
    [allLaps, athlete]
  );

  const chartData = laps
    .filter((l) => l.lapTime > 0)
    .map((l) => ({ lap: l.lapNumber, minutes: +(l.lapTime / 60).toFixed(2) }));

  if (!athlete) {
    return (
      <AppShell title="Athlete">
        <div className="mt-12 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No athlete selected.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Go to dashboard</Button>
        </div>
      </AppShell>
    );
  }

  const totalLaps = totalLapsFor(athlete);
  const distance = distanceCovered(athlete, laps.length);

  return (
    <AppShell title={athlete.name}>
      <AthleteSwitcher athletes={athletes} selectedId={athlete.id} onSelect={selectAthlete} />
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border gradient-card p-4 text-center shadow-card">
        <Stat label="Laps" value={`${laps.length}/${totalLaps}`} />
        <Stat label="Distance" value={formatDistance(distance, athlete.unit)} />
        <Stat label="Lap dist" value={`${athlete.lapDistance} ${athlete.unit}`} />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Lap times
        </h2>
        <div className="h-48 w-full rounded-2xl border border-border bg-card p-2">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No completed laps yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="lap"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  width={36}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} min`, "Lap time"]}
                  labelFormatter={(l) => `Lap ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Lap history
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Lap</TableHead>
                <TableHead>Pace</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {laps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Tap Checkpoint on the dashboard to start logging.
                  </TableCell>
                </TableRow>
              )}
              {[...laps].reverse().map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-bold tabular">{l.lapNumber}</TableCell>
                  <TableCell className="tabular text-muted-foreground">{formatClock(l.timestamp)}</TableCell>
                  <TableCell className="tabular">{l.lapTime > 0 ? formatDuration(l.lapTime) : "—"}</TableCell>
                  <TableCell className="tabular">{l.pace > 0 ? formatPace(l.pace, athlete.unit) : "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteLap(l.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Nutrition log
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/nutrition")} className="gap-1 text-xs">
            Edit plans <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-2">
          {laps.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Log laps to track nutrition completion.
            </p>
          )}
          {[...laps].reverse().map((l) => {
            const plan = planFor(athlete.id, l.lapNumber);
            const log = logFor(athlete.id, l.lapNumber);
            if (!plan || plan.items.length === 0) return null;
            return (
              <div key={l.id} className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lap {l.lapNumber} • {formatClock(l.timestamp)}
                </p>
                <ul className="space-y-1.5">
                  {plan.items.map((item) => {
                    const checked = log?.completedItemIds.includes(item.id) ?? false;
                    return (
                      <li key={item.id} className="flex items-center gap-3">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleLogItem(athlete.id, l.lapNumber, item.id)}
                          className="h-5 w-5"
                        />
                        <span className={checked ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="tabular text-lg font-bold">{value}</p>
  </div>
);

export default AthleteDetail;
