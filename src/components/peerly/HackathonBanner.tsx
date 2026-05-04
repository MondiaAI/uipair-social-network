import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { format, isValid } from "date-fns";

interface Banner {
  id: string;
  title: string;
  sponsor_name: string;
  sponsor_logo_url: string | null;
  prize_amount: string | null;
  deadline: string | null;
  register_url: string;
}

export function HackathonBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    supabase
      .from("hackathon_banners")
      .select("id, title, sponsor_name, sponsor_logo_url, prize_amount, deadline, register_url")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data }) => setBanners((data ?? []) as Banner[]));
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[idx];
  const dl = b.deadline ? new Date(b.deadline) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 p-4">
      <div className="flex items-center gap-4">
        <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-background sm:flex">
          {b.sponsor_logo_url ? (
            <img src={b.sponsor_logo_url} alt={b.sponsor_name} className="h-10 w-10 object-contain" />
          ) : (
            <Trophy className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Sponsored by {b.sponsor_name}
          </p>
          <h3 className="truncate text-base font-semibold">{b.title}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {b.prize_amount && <span className="font-medium text-primary">{b.prize_amount}</span>}
            {dl && isValid(dl) && <span>Deadline {format(dl, "MMM d, yyyy")}</span>}
          </div>
        </div>
        <Button asChild size="sm">
          <a href={b.register_url} target="_blank" rel="noreferrer">Register</a>
        </Button>
      </div>
      {banners.length > 1 && (
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            onClick={() => setIdx((i) => (i - 1 + banners.length) % banners.length)}
            className="rounded p-0.5 hover:bg-background/50"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % banners.length)}
            className="rounded p-0.5 hover:bg-background/50"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
