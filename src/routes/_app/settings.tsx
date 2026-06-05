import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UniversitySelector } from "@/components/peerly/UniversitySelector";
import { normalizeLocation } from "@/lib/normalize-location";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { broadcastProfileUpdate } from "@/lib/profile-broadcast";
import { Switch } from "@/components/ui/switch";
import { useDataLight, setDataLight } from "@/lib/data-light";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Settings · UiPair" }, { name: "description", content: "Manage your profile settings" }],
  }),
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const dataLight = useDataLight();
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [graduationYear, setGraduationYear] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUniversityId(profile.university_id ?? null);
    setUniversityName(profile.university ?? null);
    setCountry(profile.country ?? null);
    setGraduationYear(((profile as any).graduation_year ?? "").toString());
  }, [profile]);

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Please sign in.</div>;
  }

  const save = async () => {
    setSaving(true);
    const gyNum = graduationYear.trim() === "" ? null : Number(graduationYear);
    if (gyNum !== null && (!Number.isInteger(gyNum) || gyNum < 1950 || gyNum > 2100)) {
      toast.error("Enter a valid graduation year (1950–2100)");
      setSaving(false);
      return;
    }
    // Snapshot for revert
    const prev = {
      university_id: profile?.university_id ?? null,
      university: profile?.university ?? null,
      country: profile?.country ?? null,
      graduation_year: (profile as any)?.graduation_year ?? null,
    };
    const next = {
      university_id: universityId,
      university: normalizeLocation(universityName),
      country: normalizeLocation(country),
      graduation_year: gyNum,
    };
    // Optimistic toast — UI fields already reflect `next` from local state.
    const successToastId = toast.success("Settings saved");

    const rollback = (reason: string) => {
      setUniversityId(prev.university_id);
      setUniversityName(prev.university);
      setCountry(prev.country);
      setGraduationYear((prev.graduation_year ?? "").toString());
      toast.dismiss(successToastId);
      toast.error(`Couldn't save settings — changes reverted${reason ? `: ${reason}` : ""}`);
    };

    // 1) Network write
    let writeError: any = null;
    try {
      const { error } = await supabase.from("profiles").update(next).eq("id", user.id);
      writeError = error;
    } catch (e) {
      writeError = e;
    }
    if (writeError) {
      rollback(writeError?.message ?? "network error");
      setSaving(false);
      return;
    }

    // 2) Broadcast + background refetch — guarded so any failure rolls back.
    try {
      broadcastProfileUpdate(user.id);
      await Promise.resolve(refreshProfile());
      await Promise.resolve(router.invalidate());
    } catch (e: any) {
      rollback(e?.message ?? "sync failed");
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
        <div>
          <label className="text-sm font-medium block mb-1.5">Graduation year</label>
          <input
            type="number"
            inputMode="numeric"
            min={1950}
            max={2100}
            placeholder="e.g. 2024"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            className="w-40 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Required to join your university's Alumni Community.
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Data-Light Mode</h2>
            <p className="text-sm text-muted-foreground">
              Stops live session previews and autoplaying video from loading in the background. Great for slow or expensive connections.
            </p>
          </div>
          <Switch checked={dataLight} onCheckedChange={setDataLight} aria-label="Data-Light Mode" />
        </div>
      </Card>
    </div>
  );
}
