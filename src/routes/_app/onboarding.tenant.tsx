import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, GraduationCap, Check } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding/tenant")({
  component: PickTenantPage,
});

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  email_domain: string | null;
  primary_color: string | null;
}

function PickTenantPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("tenants").select("*").eq("is_active", true).order("name").then(({ data }) => {
      setTenants((data as TenantRow[]) ?? []);
    });
  }, []);

  // Auto-suggest based on email domain
  const suggestion = useMemo(() => {
    const email = user?.email;
    if (!email) return null;
    const domain = email.split("@")[1]?.toLowerCase();
    return tenants.find((t) => t.email_domain && domain?.endsWith(t.email_domain)) ?? null;
  }, [tenants, user?.email]);

  useEffect(() => { if (suggestion && !selected) setSelected(suggestion.id); }, [suggestion, selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.country?.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q),
    );
  }, [tenants, query]);

  const confirm = async () => {
    if (!user || !selected) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ tenant_id: selected }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success("Welcome to your university!");
    navigate({ to: "/feed" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-full bg-primary/10 p-3"><GraduationCap className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Pick your university</h1>
          <p className="text-sm text-muted-foreground">You'll see students, circles, and gigs from this university.</p>
        </div>
      </div>

      {suggestion && (
        <Card className="mb-4 border-primary/40 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wide text-primary">Suggested from your email</p>
          <p className="mt-1 font-semibold">{suggestion.name}</p>
          <p className="text-sm text-muted-foreground">{suggestion.country}</p>
        </Card>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search universities…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {filtered.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
            >
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.country}{t.email_domain ? ` · @${t.email_domain}` : ""}</p>
              </div>
              {active && <Check className="h-5 w-5 text-primary" />}
            </button>
          );
        })}
        {!filtered.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No match. Ask an admin to add your university.
          </p>
        )}
      </div>

      <Button className="mt-6 w-full" size="lg" disabled={!selected || saving} onClick={confirm}>
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}
