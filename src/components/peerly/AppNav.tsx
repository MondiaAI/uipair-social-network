import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Users,
  Zap,
  FlaskConical,
  DollarSign,
  MessageSquare,
  User,
  Menu,
  Settings as SettingsIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { useUnreadChats } from "@/hooks/use-unread-chats";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SettingsRouteLink } from "./SettingsLink";

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center leading-none"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Smoothly scroll the relevant container to the top.
 * Looks for a per-tab inner scroll container first
 * (e.g. <div data-scroll-container="feed">), then falls back to window.
 */
function scrollTabToTop(tabKey: string) {
  if (typeof document === "undefined") return;
  const inner = document.querySelector<HTMLElement>(`[data-scroll-container="${tabKey}"]`);
  if (inner && inner.scrollHeight > inner.clientHeight) {
    inner.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

type Tab = { to: string; label: string; icon: LucideIcon; params?: Record<string, string> };

// Full nav (used by desktop sidebar)
const allTabs: Tab[] = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/circles", label: "Circles", icon: Users },
  { to: "/match", label: "Match", icon: Zap },
  { to: "/messages", label: "Chat", icon: MessageSquare },
  { to: "/lab", label: "Lab", icon: FlaskConical },
  { to: "/gigs", label: "Gigs", icon: DollarSign },
];

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const chatUnread = useUnreadChats();
  const { unread: notifUnread } = useNotifications();

  // (profileTo handled inline below via to + params for type safety)
  const isProfileActive = pathname.startsWith("/profile");

  // Mobile primary tabs (5 max for thumb-friendly bottom nav)
  const mobilePrimary: {
    key: string;
    label: string;
    icon: LucideIcon;
    to?: string;
    params?: Record<string, string>;
    active: boolean;
    onClick?: () => void;
    badge?: number;
  }[] = [
    { key: "feed", label: "Feed", icon: Home, to: "/feed", active: pathname.startsWith("/feed") },
    { key: "circles", label: "Circles", icon: Users, to: "/circles", active: pathname.startsWith("/circles") },
    { key: "chat", label: "Chat", icon: MessageSquare, to: "/messages", active: pathname.startsWith("/messages"), badge: chatUnread },
    {
      key: "profile",
      label: "Profile",
      icon: User,
      to: user ? "/profile/$userId" : "/feed",
      params: user ? { userId: user.id } : undefined,
      active: isProfileActive,
    },
    { key: "more", label: "More", icon: Menu, active: moreOpen, onClick: () => setMoreOpen(true), badge: notifUnread },
  ];

  // Mobile overflow shown inside the More sheet
  const moreItems: Tab[] = [
    { to: "/match", label: "Match", icon: Zap },
    { to: "/lab", label: "The Lab", icon: FlaskConical },
    { to: "/gigs", label: "StudyGigs", icon: DollarSign },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
    { to: "/ambassador", label: "Earn as Ambassador", icon: Sparkles },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex sticky top-16 h-[calc(100vh-4rem)] w-56 flex-col gap-1 border-r bg-card p-4">
        {allTabs.map((t) => {
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

      {/* Mobile bottom nav (5 tabs + More sheet) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
          {mobilePrimary.map((t) => {
            const Icon = t.icon;
            const className = cn(
              "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors min-h-[56px]",
              t.active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            );
            const inner = (
              <>
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  <Badge count={t.badge ?? 0} />
                </span>
                <span>{t.label}</span>
              </>
            );
            if (t.onClick) {
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={t.onClick}
                  className={className}
                  aria-label={t.label}
                  aria-current={t.active ? "page" : undefined}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={t.key}
                to={t.to as any}
                params={t.params as any}
                className={className}
                aria-label={t.label}
                aria-current={t.active ? "page" : undefined}
                onClick={(e) => {
                  // Tap-again-to-scroll-to-top: if user is already on this
                  // route, intercept and scroll the inner container (if any)
                  // or fall back to window scroll.
                  if (t.active) {
                    e.preventDefault();
                    scrollTabToTop(t.key);
                  }
                }}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile "More" sheet — overflow nav + quick actions */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-2 pb-4">
            {moreItems.map((t) => {
              const Icon = t.icon;
              const active = pathname.startsWith(t.to);
              if (t.to === "/settings") {
                return (
                  <SettingsRouteLink
                    key={t.to}
                    onBeforeNavigate={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-accent text-primary"
                        : "bg-card text-foreground hover:bg-muted",
                    )}
                  />
                );
              }
              return (
                <SheetClose asChild key={t.to}>
                  <Link
                    to={t.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-accent text-primary"
                        : "bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {t.label}
                  </Link>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
