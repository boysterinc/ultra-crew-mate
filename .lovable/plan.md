
## Goal
Add a concept of **race "Events"** managed in Settings, group dashboard athletes by event, support drag-and-drop reordering (both groups and athletes within groups), and let each athlete pick an event + a personal goal that's referenced by the existing pace/ETA display.

---

## 1. Data model (`src/lib/types.ts` + `src/lib/store.ts`)

**New type `RaceEvent`:**
```ts
export type EventKind = "distance" | "time";
export interface RaceEvent {
  id: string;
  name: string;            // e.g. "50K", "12h Track"
  kind: EventKind;
  distanceKm?: number;     // when kind === "distance"
  durationMinutes?: number;// when kind === "time" (hours+minutes flattened)
  order: number;           // for drag-and-drop group ordering
}
```

**Athlete additions:**
- `eventId?: string` — which event the athlete is registered in.
- `goalDistanceKm?: number` — used when `event.kind === "time"` (athlete aims to cover X km in the event window).
- `goalDurationMinutes?: number` — used when `event.kind === "distance"` (athlete aims to finish in HH:MM).
- `dashboardOrder?: number` — position within their event group on the dashboard.

**Store additions:**
- `events: RaceEvent[]` (default `[]`).
- CRUD: `addEvent`, `updateEvent`, `deleteEvent` (deleting clears `eventId` on athletes that referenced it).
- `reorderEvents(orderedIds: string[])` and `reorderAthletesInEvent(eventId: string | null, orderedIds: string[])` — both write the resulting `order` / `dashboardOrder` fields so positions persist via the existing localStorage layer.
- All new fields flow through existing `addAthlete` / `updateAthlete`. **No business-logic rewrite** beyond storing the new fields and exposing helpers.

The existing `lapDistance` + `totalLapsFor()` logic stays untouched — events/goals are an additive layer.

---

## 2. Settings UI (`src/components/SettingsButton.tsx`)

Expand the existing dialog from a single numeric input into two sections:

**Section A — Safety (existing)**
- Keep the double-tap minutes input as-is.

**Section B — Race events (new)**
- List of existing events, each row: name, kind badge, value (e.g. "50 km" or "12h 00m"), edit + delete icon buttons.
- "Add event" button → inline form:
  - `Name` text input.
  - `Kind` toggle: **Distance / Time** (radio-style buttons).
  - If Distance: `Distance (km)` number input.
  - If Time: two inputs `Hours` + `Minutes` (combined into `durationMinutes`).
- Save calls `addEvent` / `updateEvent`.
- Delete uses an inline confirm (re-uses `AlertDialog`).

Layout uses existing semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`) — no new colors.

---

## 3. Athlete form (`src/components/AthleteFormDialog.tsx`)

Add two new field rows after the existing distance fields:

- **Event** — `Select` listing all `events` (plus an "— None —" option). Hidden if `events.length === 0`, with a hint "Create events in Settings".
- **Goal** — rendered conditionally based on the selected event:
  - Selected event is **distance** → input "Goal time (HH:MM)" → stored as `goalDurationMinutes`.
  - Selected event is **time** → input "Goal distance (km)" → stored as `goalDistanceKm`.
  - No event selected → goal section hidden.

Save flows through existing `addAthlete` / `updateAthlete`. Default values for the goal inputs come from the editing athlete.

---

## 4. Dashboard grouping + drag-and-drop (`src/pages/Index.tsx`)

**Grouping logic (replaces the current `sortedAthletes` block):**
- Group athletes by `eventId`. Athletes without an event go into a final "Unassigned" group.
- Group order = `events` sorted by `order`, then "Unassigned".
- Within a group, athletes are sorted by `dashboardOrder` (fallback: `createdAt`). **No more live re-sort by ETA** — positions are fixed (per the user's instruction "ตำแหน่งเดิมตลอด").
- The 5s tick interval is removed (no longer needed for ordering; cards already update themselves via store changes).

**Per-group rendering:**
- Group header: event name + chip showing kind/value (e.g. "50K · 50 km" or "12h Track · 12h 00m"). For "Unassigned" just show the label.
- Grid: same `grid-cols-2 md:grid-cols-4` pair-based layout, **but applied per group**. If a group has an odd number of athletes, render one empty placeholder slot to fill the row before the next group starts (this is the user's "เลขคี่ → เว้น block ที่ 4 แล้วขึ้นกลุ่มใหม่" rule, generalized to whichever column count is active).
- The existing `compact` / `ultraCompact` density logic now keys off the **largest group size** so cards stay readable.

**Drag-and-drop:**
- Add `@dnd-kit/core` and `@dnd-kit/sortable` (small, React-idiomatic, matches our stack — preferred over `react-beautiful-dnd` which is unmaintained).
- Two sortable contexts:
  1. **Groups**: vertical sortable list of group sections. Drag handle = group header. On drop → `reorderEvents(newOrderedIds)`. The "Unassigned" group is rendered but pinned (not sortable).
  2. **Athletes within a group**: horizontal sortable grid using `rectSortingStrategy`. Drag handle = a small grip icon on the card header (added in `AthleteCard.tsx`, only rendered when `onDragHandleProps` is passed). On drop → `reorderAthletesInEvent(eventId, newOrderedIds)`.
- Touch + mouse sensors enabled with a small activation distance so taps on existing card buttons (lap, edit, delete, switcher) still work.

**Notification highlight (no reorder):**
- Currently `AthleteCard` already pulses a ring/border when overdue (see existing styles). **Verify and keep** that behavior — explicitly remove any code that would have moved overdue athletes. The toast notification path (already in `CheckpointButton`) is unchanged.

---

## 5. Athlete card goal display (`src/components/AthleteCard.tsx`)

Inside the existing top stats row of the card, add one compact line (replaces nothing — fits in the existing slot the user has been calling "ด้านบน"):

- If athlete has an event + goal:
  - **Distance event + goal time** → show `Goal: HH:MM · Pace: M:SS/km` (required pace = goalDurationMinutes / event.distanceKm).
  - **Time event + goal distance** → show `Goal: X km · Pace: M:SS/km` (required pace = (event.durationMinutes / goalDistanceKm)).
- Plus a live "Plan finish" readout already implied in the spec:
  - For distance events: projected finish time = elapsed + remainingKm × currentAvgPace.
  - For time events: projected total distance at end = currentAvgPace⁻¹ × event.durationMinutes.
- All formatting goes through `src/lib/format.ts` helpers (add small helpers `formatHM(mins)` and `formatPace(secPerKm)` if not already present).

This is purely presentational — uses existing `lapsFor` + `pace` data from the store.

---

## 6. Files touched

- `src/lib/types.ts` — add `RaceEvent`, `EventKind`, new `Athlete` fields.
- `src/lib/store.ts` — add `events` slice, CRUD, reorder helpers, new athlete fields.
- `src/lib/format.ts` — add `formatHM`, `formatPace` helpers if missing.
- `src/components/SettingsButton.tsx` — events management UI.
- `src/components/AthleteFormDialog.tsx` — event + goal fields.
- `src/components/AthleteCard.tsx` — goal/projected-finish line + drag handle slot.
- `src/pages/Index.tsx` — grouping, fixed ordering, drag-and-drop, odd-slot padding.
- `package.json` (via `code--add_dependency`) — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

---

## 7. Out of scope (explicit)

- No backend / Lovable Cloud — everything stays in localStorage via the existing persisted store (the key `ultraCrewData` you just set up automatically picks up the new fields).
- No changes to nutrition pages, switcher, or AppShell.
- No migration of legacy data — existing athletes simply have `eventId === undefined` and land in the "Unassigned" group until the user assigns them.
