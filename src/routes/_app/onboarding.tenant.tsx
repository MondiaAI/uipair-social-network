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
          <p className="py-4 text-center text-sm text-muted-foreground">
            No match for "{query}".
          </p>
        )}
      </div>

      <AddUniversityForm
        initialName={query}
        onAdded={(t) => {
          setTenants((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
          setSelected(t.id);
          setQuery("");
        }}
      />

      <Button className="mt-6 w-full" size="lg" disabled={!selected || saving} onClick={confirm}>
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function AddUniversityForm({ initialName, onAdded }: { initialName: string; onAdded: (t: TenantRow) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => { if (open) setName(initialName); }, [initialName, open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted"
      >
        + Can't find your university? Add it
      </button>
    );
  }

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Enter a university name");
    setSaving(true);
    const slug = `${slugify(trimmed)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("tenants")
      .insert({ name: trimmed, country: country.trim() || null, slug, is_active: true })
      .select("id, slug, name, country, email_domain, primary_color")
      .single();
    if (!error && data && user) {
      await supabase.from("tenant_admins").insert({ tenant_id: data.id, user_id: user.id, role: "owner" });
    }
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Could not add");
    toast.success(`Added ${data.name}`);
    onAdded(data as TenantRow);
    setOpen(false);
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm font-medium">Add your university</p>
      <Input placeholder="University name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Country (optional)" value={country} onChange={(e) => setCountry(e.target.value)} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add & select"}
        </Button>
      </div>
    </div>
  );
}
