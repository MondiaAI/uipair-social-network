import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UniversitySelector } from "@/components/peerly/UniversitySelector";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Settings · UiPair" }, { name: "description", content: "Manage your profile settings" }],
  }),
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUniversityId(profile.university_id ?? null);
    setUniversityName(profile.university ?? null);
    setCountry(profile.country ?? null);
  }, [profile]);

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please sign in.</div>;
  }

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          university_id: universityId,
          university: universityName,
          country: country,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/profile/$userId" params={{ userId: user.id }}>View profile</Link>
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="font-semibold">University & country</h2>
          <p className="text-sm text-muted-foreground">
            Used to match you with peers on your campus and across the world.
          </p>
        </div>
        <UniversitySelector
          value={universityId}
          country={country}
          onChange={({ universityId, universityName, country }) => {
            setUniversityId(universityId);
            setUniversityName(universityName);
            setCountry(country);
          }}
        />
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
