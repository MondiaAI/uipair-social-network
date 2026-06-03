import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFeedMode } from "@/lib/feed-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./NotificationPanel";
import { ProUpgradeModal } from "./ProUpgradeModal";
import { PeerlyLogo } from "./PeerlyLogo";
import { SettingsRouteLink } from "./SettingsLink";
import { useNotifications } from "@/lib/notifications-context";
import { useFriendRequestCount } from "@/hooks/use-friend-request-count";
import { isNativeApp } from "@/lib/platform";

export function Header() {
  const { user, profile, tenant, signOut } = useAuth();
  const { mode, setMode } = useFeedMode();
  const navigate = useNavigate();
  const { unread } = useNotifications();
  const friendReqCount = useFriendRequestCount();
  const [notifOpen, setNotifOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const native = isNativeApp();


  const initials = (profile?.full_name || profile?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
    <header className="sticky top-0 z-40 w-full border-b bg-card sm:h-16">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        {/* Left: Logo + tenant */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/feed" aria-label="UiPair home" className="shrink-0">
            <PeerlyLogo size="sm" variant="light" />
          </Link>
          {tenant && (
            <span
              className="hidden md:inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground truncate max-w-[200px]"
              title={tenant.name}
              style={tenant.primary_color ? { borderColor: tenant.primary_color, color: tenant.primary_color } : undefined}
            >
              {tenant.name}
            </span>
          )}
        </div>


        {/* Center: Campus/Global toggle */}
        <div className="hidden sm:flex items-center rounded-full border bg-muted p-1">
          <button
            onClick={() => setMode("campus")}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
              mode === "campus"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Campus
          </button>
          <button
            onClick={() => setMode("global")}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
              mode === "global"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Global
          </button>
        </div>

        {/* Right: Bell + Avatar */}
        <div className="flex items-center gap-3">
          {user && (
            <button
              type="button"
              onClick={() => navigate({ to: "/match" })}
              className="relative rounded-full p-2 hover:bg-muted transition-colors"
              aria-label={`Friend requests${friendReqCount > 0 ? ` (${friendReqCount} pending)` : ""}`}
            >
              <UserPlus className="h-5 w-5" />
              {friendReqCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {friendReqCount > 99 ? "99+" : friendReqCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            className="relative rounded-full p-2 hover:bg-muted transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread}
              </span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold">{profile?.full_name || "Student"}</span>
                  <span className="text-xs text-muted-foreground">@{profile?.username}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user && (
                <DropdownMenuItem asChild>
                  <Link to="/profile/$userId" params={{ userId: user.id }}>View Profile</Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <SettingsRouteLink showIcon={false} />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ambassador">Earn as Ambassador</Link>
              </DropdownMenuItem>
              {!native && (
                <DropdownMenuItem onClick={() => setProOpen(true)}>UiPair Pro</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile toggle */}
      <div className="flex sm:hidden items-center justify-center pb-2">
        <div className="flex items-center rounded-full border bg-muted p-1">
          <button
            onClick={() => setMode("campus")}
            className={cn(
              "px-4 py-1 text-xs font-medium rounded-full",
              mode === "campus" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Campus
          </button>
          <button
            onClick={() => setMode("global")}
            className={cn(
              "px-4 py-1 text-xs font-medium rounded-full",
              mode === "global" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Global
          </button>
        </div>
      </div>
    </header>
    <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />
    <ProUpgradeModal open={proOpen} onOpenChange={setProOpen} />
    </>
  );
}
