import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Zap, FlaskConical, DollarSign, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/circles", label: "Circles", icon: Users },
  { to: "/match", label: "Match", icon: Zap },
  { to: "/messages", label: "Chat", icon: MessageSquare },
  { to: "/lab", label: "Lab", icon: FlaskConical },
  { to: "/gigs", label: "Gigs", icon: DollarSign },
];

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex sticky top-16 h-[calc(100vh-4rem)] w-56 flex-col gap-1 border-r bg-card p-4">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {t.label}
            </Link>
          );
        })}
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card">
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
