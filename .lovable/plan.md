
## Goal
Two related UX improvements to athlete switching:
1. On the **Athlete Detail** and **Nutrition Plan** pages, replace the athlete `Select` dropdown with a horizontal row of equal-width name buttons that switch the active athlete on tap.
2. Allow each athlete to have a small avatar photo, shown next to their name in the dashboard card header and inside the new athlete-switcher pills (without changing the existing layout).

## 1. Athlete avatars (data + form)

**`src/lib/types.ts`**
- Add optional `photoUrl?: string` to `Athlete`.

**`src/components/AthleteFormDialog.tsx`**
- Add a small "Photo" row above the name field:
  - Circular preview (uses `Avatar` from `src/components/ui/avatar.tsx`, fallback = initials).
  - "Upload" button → file input (accept `image/*`). On select: read file with `FileReader.readAsDataURL`, downscale to 128×128 via an offscreen `<canvas>` to keep localStorage small, store as data URL in form state.
  - "Remove" button when a photo exists.
- Save flow includes `photoUrl` in the payload to `addAthlete` / `updateAthlete`.

No store changes beyond the new field flowing through existing `addAthlete` / `updateAthlete`.

## 2. Reusable athlete switcher

**New `src/components/AthleteSwitcher.tsx`**
- Props: `athletes: Athlete[]`, `selectedId: string | null`, `onSelect: (id: string) => void`.
- Renders a horizontal scrollable row (`flex gap-2 overflow-x-auto`) of equal-width pills:
  - Each pill is `flex-1 min-w-[96px] max-w-[140px]` so widths are equal when they fit, and scroll horizontally when there are many athletes.
  - Pill content: small `Avatar` (h-6 w-6) + truncated name.
  - Selected pill: `bg-primary text-primary-foreground border-primary`.
  - Unselected: `bg-card border-border hover:border-primary/60`.
- Hidden entirely when `athletes.length <= 1`.

## 3. Wire switcher into pages

**`src/pages/AthleteDetail.tsx`**
- Remove the existing `Select` block in the header.
- Render `<AthleteSwitcher athletes={athletes} selectedId={selectedAthleteId} onSelect={selectAthlete} />` in the same slot inside `AppShell`.

**`src/pages/NutritionPlan.tsx`**
- Same swap: remove the `Select`, drop in `<AthleteSwitcher />`.

**`src/pages/NutritionMatrix.tsx`** (uses the same switcher for consistency)
- Replace its `Select` with `<AthleteSwitcher />` so all three athlete-context pages match.

## 4. Dashboard avatar (no layout change)

**`src/components/AthleteCard.tsx`**
- In the existing header `<button>` (the name area), prepend a small `Avatar` (h-7 w-7 normal, h-5 w-5 in `compact` mode) before the name `<h2>`. Wrap in a `flex items-center gap-2` (`gap-1.5` compact) so the name truncation behavior is preserved.
- Fallback = first letter of `athlete.name`.
- No changes to padding, stats grid, nutrition strip, or checkpoint button — only the inner flex of the name button is adjusted.

## Files touched
- `src/lib/types.ts` — add `photoUrl?`
- `src/components/AthleteFormDialog.tsx` — photo upload/preview
- `src/components/AthleteSwitcher.tsx` — new equal-width pill row
- `src/components/AthleteCard.tsx` — avatar in card header
- `src/pages/AthleteDetail.tsx` — replace dropdown with switcher
- `src/pages/NutritionPlan.tsx` — replace dropdown with switcher
- `src/pages/NutritionMatrix.tsx` — replace dropdown with switcher

## Notes
- Photos live in localStorage as 128×128 data URLs (~5–15 KB each). With the current store size and a typical crew (≤ 8 athletes) this stays well within the 5 MB localStorage budget.
- Switcher uses horizontal scroll when pills overflow on mobile, so equal-width behavior holds without breaking layout for large rosters.
