import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, DollarSign, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GIG_CATEGORIES, CATEGORY_LABEL, formatPrice, type GigCategory } from "@/lib/gig-meta";
import { GigCard, type GigCardData } from "@/components/peerly/GigCard";
import { BountyCard, type BountyCardData } from "@/components/peerly/BountyCard";
import { ResourceCard, type ResourceCardData } from "@/components/peerly/ResourceCard";
import { PostGigModal } from "@/components/peerly/PostGigModal";
import { PostBountyModal } from "@/components/peerly/PostBountyModal";
import { GigDetailSheet } from "@/components/peerly/GigDetailSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/gigs")({
  component: GigsPage,
});

type ProfileLite = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; university: string | null };

function GigsPage() {
  const { user } = useAuth();
  const [gigs, setGigs] = useState<GigCardData[]>([]);
  const [bounties, setBounties] = useState<BountyCardData[]>([]);
  const [resources, setResources] = useState<ResourceCardData[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [earnings, setEarnings] = useState({ total: 0, active: 0, rating: 0 });
  const [category, setCategory] = useState<GigCategory | "all">("all");
  const [showEarnings, setShowEarnings] = useState(true);
  const [openGigModal, setOpenGigModal] = useState(false);
  const [openBountyModal, setOpenBountyModal] = useState(false);
  const [activeGigId, setActiveGigId] = useState<string | null>(null);

  const loadAll = async () => {
    const [gigsRes, bountiesRes, resourcesRes] = await Promise.all([
      supabase.from("gigs").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(50),
      supabase.from("bounties").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("resources").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(50),
    ]);
    const sellerIds = new Set<string>();
    (gigsRes.data ?? []).forEach((g) => sellerIds.add(g.seller_id));
    (bountiesRes.data ?? []).forEach((b) => sellerIds.add(b.poster_id));
    (resourcesRes.data ?? []).forEach((r) => sellerIds.add(r.uploader_id));
    let profiles: Record<string, ProfileLite> = {};
    if (sellerIds.size) {
      const { data: profs } = await supabase.from("profiles").select("id,username,full_name,avatar_url,university").in("id", Array.from(sellerIds));
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p as ProfileLite]));
    }
    setGigs((gigsRes.data ?? []).map((g) => ({ ...g, seller: profiles[g.seller_id] ?? null })) as any);
    setBounties((bountiesRes.data ?? []).map((b) => ({ ...b, poster: profiles[b.poster_id] ?? null })) as any);
    setResources((resourcesRes.data ?? []).map((r) => ({ ...r, uploader: profiles[r.uploader_id] ?? null })) as any);
  };

  const loadOrders = async () => {
    if (!user) return;
    const { data: myOrders } = await supabase
      .from("gig_orders")
      .select("*, gig:gigs(title)")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    setOrders(myOrders ?? []);
    const sold = (myOrders ?? []).filter((o) => o.seller_id === user.id);
    const total = sold.filter((o) => o.status === "completed").reduce((s, o) => s + o.amount_cents, 0);
    const active = sold.filter((o) => ["pending", "in_progress"].includes(o.status)).length;
    const { data: myGigs } = await supabase.from("gigs").select("rating_avg,review_count").eq("seller_id", user.id);
    const totalReviews = (myGigs ?? []).reduce((s, g) => s + g.review_count, 0);
    const weighted = (myGigs ?? []).reduce((s, g) => s + g.rating_avg * g.review_count, 0);
    setEarnings({ total, active, rating: totalReviews ? weighted / totalReviews : 0 });
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadOrders(); }, [user?.id]);

  const filteredGigs = useMemo(
    () => (category === "all" ? gigs : gigs.filter((g) => g.category === category)),
    [gigs, category]
  );

  const claimBounty = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("bounties").update({ claimer_id: user.id, status: "claimed" }).eq("id", id).eq("status", "open");
    if (error) return toast.error(error.message);
    toast.success("Bounty claimed!");
    loadAll();
  };

  const buyResource = async (id: string) => {
    if (!user) return;
    const r = resources.find((x) => x.id === id);
    if (!r) return;
    const { data: full } = await supabase.from("resources").select("uploader_id,price_cents").eq("id", id).maybeSingle();
    if (!full) return;
    if (full.uploader_id === user.id) return toast.error("This is your own resource");
    const { error } = await supabase.from("resource_purchases").insert({
      resource_id: id, buyer_id: user.id, seller_id: full.uploader_id, amount_cents: full.price_cents,
    });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success(full.price_cents === 0 ? "Downloaded!" : "Purchased! File unlocked.");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">StudyGigs</h1>
          <p className="text-sm text-muted-foreground">Earn from your knowledge</p>
        </div>
        <Button onClick={() => setOpenGigModal(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Post a Gig
        </Button>
      </div>

      {/* Earnings */}
      {user && (
        <Card className="p-4">
          <button className="flex w-full items-center justify-between" onClick={() => setShowEarnings((v) => !v)}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              My Earnings
            </div>
            {showEarnings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showEarnings && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold text-emerald-600">{formatPrice(earnings.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Orders</p>
                <p className="text-2xl font-bold">{earnings.active}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-2xl font-bold inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {earnings.rating.toFixed(1)}
                </p>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" disabled>Withdraw (Stripe)</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Tabs defaultValue="gigs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="gigs">Gigs</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="orders">My Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="gigs" className="space-y-6">
          {/* Bounty Board */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Open Bounties</h2>
                <Badge variant="secondary">{bounties.filter((b) => b.status === "open").length}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenBountyModal(true)}>Post a Bounty</Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {bounties.length === 0 && <p className="text-sm text-muted-foreground">No bounties yet. Be the first to post one!</p>}
              {bounties.map((b) => <BountyCard key={b.id} bounty={b} onClaim={claimBounty} />)}
            </div>
          </section>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <CategoryPill active={category === "all"} onClick={() => setCategory("all")}>All</CategoryPill>
            {GIG_CATEGORIES.map((c) => (
              <CategoryPill key={c} active={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c]}</CategoryPill>
            ))}
          </div>

          {/* Gigs grid */}
          {filteredGigs.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">No gigs in this category yet.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredGigs.map((g) => <GigCard key={g.id} gig={g} onOpen={setActiveGigId} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resources">
          {resources.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">No study resources uploaded yet.</Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((r) => <ResourceCard key={r.id} resource={r} onBuy={buyResource} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders">
          {orders.length === 0 ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              No orders yet.
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Card key={o.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium">{o.gig?.title ?? "Gig"}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.buyer_id === user?.id ? "Bought" : "Sold"} • {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{formatPrice(o.amount_cents)}</p>
                    <Badge variant="outline" className="text-xs">{o.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PostGigModal open={openGigModal} onOpenChange={setOpenGigModal} onCreated={loadAll} />
      <PostBountyModal open={openBountyModal} onOpenChange={setOpenBountyModal} onCreated={loadAll} />
      <GigDetailSheet gigId={activeGigId} open={!!activeGigId} onOpenChange={(o) => !o && setActiveGigId(null)} />
    </div>
  );
}

function CategoryPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
