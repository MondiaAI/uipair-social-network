import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Check } from "lucide-react";
import { SUBJECTS } from "@/lib/subjects";
import { uploadToBucket } from "@/lib/storage";
import { toast } from "sonner";
import { SplitAuthLayout } from "@/components/peerly/SplitAuthLayout";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const UNIVERSITIES = [
  "MIT", "Stanford University", "Harvard University", "University of Cape Town",
  "University of Lagos", "National University of Singapore", "University of Oxford",
  "ETH Zurich", "University of Toronto", "Tsinghua University", "Other",
];
const COUNTRIES = ["United States", "United Kingdom", "South Africa", "Nigeria", "Singapore", "Canada", "Germany", "India", "Brazil", "Other"];
const SKILL_OPTIONS = ["Python", "JavaScript", "Research", "Writing", "Design", "Data Analysis", "Public Speaking", "Statistics", "Machine Learning", "UI/UX", "Marketing", "Translation"];

function SignupPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [university, setUniversity] = useState("");
  const [country, setCountry] = useState("");
  const [field, setField] = useState("");
  const [year, setYear] = useState<number>(1);
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // If logged in already (e.g. after Google), jump to step 2 to finish profile
  useEffect(() => {
    if (user && step === 1) setStep(2);
  }, [user]);

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setStep(2);
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed");
  };

  const onPickAvatar = (file: File) => {
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const finish = async () => {
    if (!user) return;
    setLoading(true);
    let avatar_url: string | null = null;
    if (avatarFile) avatar_url = await uploadToBucket("avatars", user.id, avatarFile);
    const update: any = {
      university, country, field_of_study: field, year_of_study: year, bio,
      skills, interests, onboarding_completed: true,
    };
    if (avatar_url) update.avatar_url = avatar_url;
    if (fullName) update.full_name = fullName;
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Welcome to peerly!");
    navigate({ to: "/feed" });
  };

  const toggle = (arr: string[], val: string, set: (a: string[]) => void) =>
    set(arr.includes(val) ? arr.filter((s) => s !== val) : [...arr, val]);

  return (
    <SplitAuthLayout>
      <div className="space-y-6">


      {/* Stepper */}
      <div className="flex items-center gap-2 mb-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={cn("flex-1 h-1.5 rounded-full", s <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {step === 1 && (
          <>
            <h1 className="text-xl font-bold">Create your account</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 1 of 4</p>
            <Button variant="outline" className="w-full mb-3" onClick={handleGoogle}>Continue with Google</Button>
            <div className="relative my-3"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            <form onSubmit={handleStep1} className="space-y-3">
              <div><Label>Full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Continue"}</Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold">Academic info</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 2 of 4</p>
            <div className="space-y-3">
              <div>
                <Label>University</Label>
                <Select value={university} onValueChange={setUniversity}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{UNIVERSITIES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Field of study</Label><Input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Computer Science" /></div>
              <div>
                <Label>Year of study</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5, 6].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={() => setStep(3)} disabled={!university || !country || !field} className="w-full">Continue</Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-xl font-bold">About you</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 3 of 4</p>
            <div className="flex flex-col items-center gap-2 mb-4">
              <Avatar className="h-20 w-20"><AvatarImage src={avatarPreview} /><AvatarFallback>{fullName.charAt(0) || "?"}</AvatarFallback></Avatar>
              <label className="cursor-pointer text-sm text-primary inline-flex items-center gap-1">
                <Camera className="h-4 w-4" /> Upload photo
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onPickAvatar(e.target.files[0])} />
              </label>
            </div>
            <div className="space-y-3">
              <div><Label>Bio</Label><Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="A line about you" /></div>
              <div>
                <Label>Skills (3–5)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {SKILL_OPTIONS.map((s) => (
                    <button type="button" key={s} onClick={() => toggle(skills, s, setSkills)}
                      className={cn("rounded-full border px-3 py-1 text-xs", skills.includes(s) ? "bg-primary text-primary-foreground border-primary" : "hover:border-foreground/40")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={() => setStep(4)} disabled={skills.length < 3} className="w-full">Continue</Button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-xl font-bold">Pick your interests</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 4 of 4 — choose 3+ to personalize your feed</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SUBJECTS.map((s) => {
                const on = interests.includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggle(interests, s, setInterests)}
                    className={cn("rounded-lg border p-3 text-sm text-left flex items-center justify-between", on ? "bg-accent border-primary" : "hover:border-foreground/40")}>
                    {s}{on && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Button onClick={finish} disabled={loading || interests.length < 3} className="w-full">
              {loading ? "Finishing…" : "Finish & enter peerly"}
            </Button>
          </>
        )}
      </div>

      {step === 1 && (
        <p className="mt-4 text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
      )}
      </div>
    </SplitAuthLayout>
  );
}
