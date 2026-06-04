import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type AlumniCircle = { id: string; name: string; member_count: number };

export function AlumniCommunityCard() {
  const { user, profile } = useAuth();
  const [circle, setCircle] = useState<AlumniCircle | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!profile?.tenant_id || !user) {
        setLoading(false);
        return;
      }
      const { data: c } = await supabase
        .from("circles")
        .select("id, name, member_count")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_alumni", true)
        .maybeSingle();
      if (cancelled) return;
      if (c) {
        setCircle(c as AlumniCircle);
        const { data: m } = await supabase
          .from("circle_members")
          .select("user_id")
          .eq("circle_id", c.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setJoined(!!m);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.tenant_id, user]);

  if (loading || !circle) return null;

  const gy = (profile as any)?.graduation_year as number | null | undefined;
  const eligible = !!gy && gy <= new Date().getFullYear();

  const handleJoin = async () => {
    if (!user) return;
    if (!eligible) {
      toast.error("Add a past graduation year in Settings to join the Alumni Community.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("circle_members")
      .insert({ circle_id: circle.id, user_id: user.id, role: "member" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setJoined(true);
    setCircle({ ...circle, member_count: circle.member_count + 1 });
    toast.success("Welcome to the Alumni Community!");
  };

  return (
    <Card className="mb-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <div className="p-5 flex items-start gap-4">
        <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{circle.name}</h3>
            <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/15 text-primary px-2 py-0.5">
              Alumni
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Become part of a growing network of graduates excelling across industries — learning,
            collaborating, and succeeding together.
          </p>
          <p className="text-xs text-muted-foreground mt-1">{circle.member_count} member{circle.member_count === 1 ? "" : "s"}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {joined ? (
              <Button asChild size="sm">
                <Link to="/circles/$circleId" params={{ circleId: circle.id }}>Open community</Link>
              </Button>
            ) : eligible ? (
              <Button size="sm" onClick={handleJoin} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Join community
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/settings">Add graduation year</Link>
                </Button>
                <span className="text-xs text-muted-foreground">Required to join</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
