import { Athlete } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AthleteSwitcherProps {
  athletes: Athlete[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const AthleteSwitcher = ({ athletes, selectedId, onSelect }: AthleteSwitcherProps) => {
  if (athletes.length <= 1) return null;
  return (
    <div className="mb-4 grid grid-cols-4 gap-2 sm:gap-3">
      {athletes.map((a) => {
        const active = a.id === selectedId;
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/60"
            )}
          >
            <Avatar
              className={cn(
                "aspect-square h-auto w-full max-w-[96px] sm:max-w-[120px] rounded-xl",
                active && "ring-2 ring-primary"
              )}
            >
              {a.photoUrl && <AvatarImage src={a.photoUrl} alt={a.name} className="object-cover" />}
              <AvatarFallback className="rounded-xl text-base font-bold">
                {initials(a.name)}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "w-full truncate text-center text-xs font-medium leading-tight sm:text-sm",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {a.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default AthleteSwitcher;
