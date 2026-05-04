import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
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
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./NotificationPanel";
import { ProUpgradeModal } from "./ProUpgradeModal";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { mode, setMode } = useFeedMode();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnread(count ?? 0);
    };
    load();
  }, [user]);

  const initials = (profile?.full_name || profile?.username || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b bg-card">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
        {/* Left: Logo */}
        <Link to="/feed" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            P
          </div>
          <span className="text-lg font-bold tracking-tight">PEERLY</span>
        </Link>

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
          <button
            type="button"
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
              <DropdownMenuItem disabled>View Profile</DropdownMenuItem>
              <DropdownMenuItem disabled>Settings</DropdownMenuItem>
              <DropdownMenuItem disabled>PEERLY Pro</DropdownMenuItem>
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
  );
}
