import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Star, ShoppingBag, Pencil, Pause, Play, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GIG_CATEGORIES, CATEGORY_LABEL, CATEGORY_CHIP, formatPrice, type GigCategory } from "@/lib/gig-meta";
import { GigCard, type GigCardData } from "@/components/peerly/GigCard";
import { BountyCard, type BountyCardData } from "@/components/peerly/BountyCard";
import { PostGigModal } from "@/components/peerly/PostGigModal";
import { PostBountyModal } from "@/components/peerly/PostBountyModal";
import { GigDetailSheet } from "@/components/peerly/GigDetailSheet";
import { JobsDashboard } from "@/components/peerly/JobsDashboard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/gigs")({
  component: GigsPage,
});

type ProfileLite = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
  country: string | null;
};

type MyGigRow = {
  id: string;
  title: string;
  price_cents: number;
  order_count: number;
  is_active: boolean;
  category: GigCategory;
};

// Visible category chip filter (matches the spec's tab list)
const FILTER_CATS: (GigCategory | "all")[] = [
  "all", "tutoring", "notes", "coding", "research", "design", "writing", "translation",
];

function GigsPage() {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<GigCardData[]>([]);
  const [bounties, setBounties] = useState<BountyCardData[]>([]);
  const [myGigs, setMyGigs] = useState<MyGigRow[]>([]);
  const [myEarnings, setMyEarnings] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<GigCategory | "all">("all");
  const [openGigModal, setOpenGigModal] = useState(false);
  const [openBountyModal, setOpenBountyModal] = useState(false);
  const [activeGigId, setActiveGigId] = useState<string | null>(null);

  const loadFindGigs = async () => {
    const [gigsRes, bountiesRes] = await Promise.all([
      supabase.from("gigs").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(50),
      supabase.from("bounties").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    const sellerIds = new Set<string>();
    (gigsRes.data ?? []).forEach((g) => sellerIds.add(g.seller_id));
    (bountiesRes.data ?? []).forEach((b) => sellerIds.add(b.poster_id));
    let profiles: Record<string, ProfileLite> = {};
    if (sellerIds.size) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,university,country")
        .in("id", Array.from(sellerIds));
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p as ProfileLite]));
    }
    setGigs((gigsRes.data ?? []).map((g) => ({ ...g, seller: profiles[g.seller_id] ?? null })) as GigCardData[]);
    setBounties((bountiesRes.data ?? []).map((b) => ({ ...b, poster: profiles[b.poster_id] ?? null })) as BountyCardData[]);
  };

  const loadMyServices = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("gigs")
      .select("id,title,price_cents,order_count,is_active,category")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    setMyGigs((data ?? []) as MyGigRow[]);

    const { data: completed } = await supabase
      .from("gig_orders")
      .select("gig_id,amount_cents,status")
      .eq("seller_id", user.id)
      .eq("status", "completed");
    const map: Record<string, number> = {};
    (completed ?? []).forEach((o) => {
      map[o.gig_id] = (map[o.gig_id] ?? 0) + o.amount_cents;
    });
    setMyEarnings(map);
  };

  useEffect(() => {
    loadFindGigs();
  }, []);
  useEffect(() => {
    loadMyServices();
  }, [user?.id]);

  const filteredGigs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return gigs.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (!term) return true;
      return (
        g.title.toLowerCase().includes(term) ||
        CATEGORY_LABEL[g.category].toLowerCase().includes(term) ||
        (g.seller?.full_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [gigs, category, search]);

  const claimBounty = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("bounties")
      .update({ claimer_id: user.id, status: "claimed" })
      .eq("id", id)
      .eq("status", "open");
    if (error) return toast.error(error.message);
    toast.success("Bounty claimed!");
    loadFindGigs();
  };

  const togglePause = async (g: MyGigRow) => {
    const { error } = await supabase.from("gigs").update({ is_active: !g.is_active }).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success(g.is_active ? "Gig paused" : "Gig activated");
    loadMyServices();
    loadFindGigs();
  };

  const deleteGig = async (id: string) => {
    if (!confirm("Delete this gig? This cannot be undone.")) return;
    const { error } = await supabase.from("gigs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Gig deleted");
    loadMyServices();
    loadFindGigs();
  };

  const openBounties = bounties.filter((b) => b.status === "open");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">StudyGigs</h1>
        <p className="text-sm text-muted-foreground">The student gig marketplace</p>
      </header>

      <Tabs defaultValue="find" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="find">Find Gigs</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="mine">My Services</TabsTrigger>
        </TabsList>

        {/* ─── FIND GIGS ─── */}
        <TabsContent value="find" className="space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for tutoring, notes, coding help..."
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTER_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                {c === "all" ? "All" : CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>

          {filteredGigs.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              No gigs match your search.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGigs.map((g) => (
                <GigCard key={g.id} gig={g} onOpen={setActiveGigId} />
              ))}
            </div>
          )}

          {/* Bounty Board */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Open Bounties</h2>
                <Badge variant="secondary">{openBounties.length}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenBountyModal(true)}>
                Post a Bounty
              </Button>
            </div>
            {bounties.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No bounties yet. Be the first to post one!
              </Card>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {bounties.map((b) => (
                  <BountyCard key={b.id} bounty={b} onClaim={claimBounty} />
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* ─── MY SERVICES ─── */}
        <TabsContent value="mine" className="space-y-4">
          <Button onClick={() => setOpenGigModal(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Create a Gig
          </Button>

          {!user ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">Sign in to manage services.</Card>
          ) : myGigs.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8" />
              You haven't created any gigs yet. Tap “Create a Gig” to get started.
            </Card>
          ) : (
            <div className="space-y-3">
              {myGigs.map((g) => {
                const earned = myEarnings[g.id] ?? 0;
                return (
                  <Card key={g.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{g.title}</p>
                        <Badge variant="outline" className={cn(CATEGORY_CHIP[g.category], "text-[10px]")}>
                          {CATEGORY_LABEL[g.category]}
                        </Badge>
                        {!g.is_active && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Price <span className="font-medium text-foreground">{formatPrice(g.price_cents)}</span></span>
                        <span>Orders <span className="font-medium text-foreground">{g.order_count}</span></span>
                        <span>Total earned <span className="font-medium text-emerald-600">{formatPrice(earned)}</span></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setActiveGigId(g.id)}>
                        <Pencil className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => togglePause(g)}>
                        {g.is_active ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Activate</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteGig(g.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Quick rollup */}
          {user && myGigs.length > 0 && (
            <Card className="grid grid-cols-3 gap-4 p-4 sm:max-w-md">
              <div>
                <p className="text-xs text-muted-foreground">Active gigs</p>
                <p className="text-xl font-bold">{myGigs.filter((g) => g.is_active).length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total orders</p>
                <p className="text-xl font-bold">{myGigs.reduce((s, g) => s + g.order_count, 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total earned</p>
                <p className="inline-flex items-baseline gap-1 text-xl font-bold text-emerald-600">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {formatPrice(Object.values(myEarnings).reduce((a, b) => a + b, 0))}
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <PostGigModal
        open={openGigModal}
        onOpenChange={setOpenGigModal}
        onCreated={() => { loadFindGigs(); loadMyServices(); }}
      />
      <PostBountyModal open={openBountyModal} onOpenChange={setOpenBountyModal} onCreated={loadFindGigs} />
      <GigDetailSheet gigId={activeGigId} open={!!activeGigId} onOpenChange={(o) => !o && setActiveGigId(null)} />
    </div>
  );
}
