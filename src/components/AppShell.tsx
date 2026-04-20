import { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface AppShellProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}

const AppShell = ({ title, action, children, wide = false }: AppShellProps) => {
  const maxW = wide ? "max-w-7xl" : "max-w-md";
  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className={`mx-auto flex ${maxW} items-center justify-between px-4 py-3`}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Ultra Crew</p>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          </div>
          {action}
        </div>
      </header>
      <main className={`mx-auto ${maxW} px-4 pt-4 safe-bottom animate-fade-in`}>{children}</main>
      <BottomNav />
    </div>
  );
};

export default AppShell;
