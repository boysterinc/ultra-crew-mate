import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import WeatherWidget from "./WeatherWidget";

interface AppShellProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

const AppShell = ({ title, action, children, wide = false }: AppShellProps) => {
  const maxW = wide ? "max-w-7xl" : "max-w-md";
  const mainPad = wide ? "px-2 sm:px-4" : "px-4";
  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className={`mx-auto flex ${maxW} items-center justify-between px-4 py-3 gap-2`}>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Ultra Crew</p>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              Developed by{" "}
              <a
                href="https://www.facebook.com/share/1CioUBLuP7/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Runner x Therapist
              </a>
            </p>
          </div>
          <div className="hidden md:flex flex-1 justify-center min-w-0 px-2">
            <WeatherWidget compact />
          </div>
          {action}
        </div>
      </header>
      <main className={`mx-auto ${maxW} ${mainPad} pt-4 safe-bottom animate-fade-in`}>{children}</main>
      <BottomNav />
    </div>
  );
};

export default AppShell;
