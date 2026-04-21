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
    <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
      <div className="flex gap-2">
        {athletes.map((a) => {
          const active = a.id === selectedId;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={cn(
                "flex flex-1 min-w-[96px] max-w-[140px] items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/60"
              )}
            >
              <Avatar className="h-6 w-6 shrink-0">
                {a.photoUrl && <AvatarImage src={a.photoUrl} alt={a.name} />}
                <AvatarFallback className="text-[10px]">{initials(a.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{a.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AthleteSwitcher;
