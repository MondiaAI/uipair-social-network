import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { PasswordInput } from "@/components/peerly/PasswordInput";
import { PasswordStrengthMeter } from "@/components/peerly/PasswordStrengthMeter";
import { evaluatePassword } from "@/lib/password-strength";
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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dobDay, setDobDay] = useState<string>("");
  const [dobMonth, setDobMonth] = useState<string>("");
  const [dobYear, setDobYear] = useState<string>("");

  // Refs for jump-to-field on validation errors
  const universityRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const confirmPwRef = useRef<HTMLDivElement>(null);
  const dobRef = useRef<HTMLDivElement>(null);
  const dobDayRef = useRef<HTMLDivElement>(null);
  const dobMonthRef = useRef<HTMLDivElement>(null);
  const dobYearRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);
  const interestsRef = useRef<HTMLDivElement>(null);

  const focusField = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
      el.classList.add("ring-2", "ring-destructive", "rounded-md");
      setTimeout(() => el.classList.remove("ring-2", "ring-destructive", "rounded-md"), 2000);
    }, 50);
  };

  const validateStep2 = (): boolean => {
    if (!university) { setStep(2); toast.error("Please enter your university"); focusField(universityRef); return false; }
    if (!country) { setStep(2); toast.error("Please select your country"); focusField(countryRef); return false; }
    if (!field) { setStep(2); toast.error("Please enter your field of study"); focusField(fieldRef); return false; }
    if (!passwordsMatch) { setStep(2); toast.error("Passwords don't match"); focusField(confirmPwRef); return false; }
    if (!dob) {
      setStep(2);
      const missingRef = !dobDay ? dobDayRef : !dobMonth ? dobMonthRef : !dobYear ? dobYearRef : dobDayRef;
      toast.error(
        !dobDay ? "Please select your day of birth"
        : !dobMonth ? "Please select your month of birth"
        : !dobYear ? "Please select your year of birth"
        : "That date doesn't look valid — please correct it",
      );
      focusField(missingRef);
      return false;
    }
    if (!dobValid) {
      setStep(2);
      toast.error(`You must be 18+ to join (you're ${age})`);
      focusField(dobYearRef);
      return false;
    }
    if (!acceptTerms) { setStep(2); toast.error("Please accept the Terms"); focusField(termsRef); return false; }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (skills.length < 3) { setStep(3); toast.error("Pick at least 3 skills"); focusField(skillsRef); return false; }
    return true;
  };

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordStrong = evaluatePassword(password).score >= 2;

  const daysInMonth = (() => {
    const m = Number(dobMonth);
    const y = Number(dobYear) || 2000; // leap-safe fallback
    if (!m) return 31;
    return new Date(y, m, 0).getDate();
  })();

  // Auto-correct day if it exceeds the days in the selected month/year
  useEffect(() => {
    const d = Number(dobDay);
    if (!d || !dobMonth) return;
    if (d > daysInMonth) {
      setDobDay(String(daysInMonth));
      toast.info(`Adjusted day to ${daysInMonth} — that month only has ${daysInMonth} days.`);
      focusField(dobDayRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dobMonth, dobYear]);

  // Timezone-safe: treat DOB and "today" as plain calendar dates (y/m/d ints)
  // so age never flips around midnight regardless of UTC offset / DST.
  const dobParts = (() => {
    const d = Number(dobDay), m = Number(dobMonth), y = Number(dobYear);
    if (!d || !m || !y) return null;
    // Validate calendar date (e.g. reject Feb 30) using UTC math (no TZ shift).
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y, m, d };
  })();
  const dob = dobParts ? new Date(Date.UTC(dobParts.y, dobParts.m - 1, dobParts.d)) : null;
  const age = (() => {
    if (!dobParts) return 0;
    const now = new Date();
    const ty = now.getFullYear();
    const tm = now.getMonth() + 1;
    const td = now.getDate();
    let a = ty - dobParts.y;
    if (tm < dobParts.m || (tm === dobParts.m && td < dobParts.d)) a--;
    return a;
  })();
  const dobValid = !!dobParts && age >= 18;
  // Inline per-field validity (only flag once user has touched the field)
  const dobDayInvalid = !!dobDay && !!dobMonth && !!dobYear && !dobParts;
  const dobMonthMissing = (!!dobDay || !!dobYear) && !dobMonth;
  const dobDayMissing = (!!dobMonth || !!dobYear) && !dobDay;
  const dobYearMissing = (!!dobDay || !!dobMonth) && !dobYear;
  const currentYear = new Date().getFullYear();
  // Cap years so the youngest selectable year still allows turning 18 (validated precisely by `age`)
  const maxYear = currentYear - 18;
  const yearOptions = Array.from({ length: 100 }, (_, i) => maxYear - i);
  const monthOptions = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];


  // If logged in already (e.g. after Google), jump to step 2 to finish profile
  useEffect(() => {
    if (user && step === 1) setStep(2);
  }, [user]);

  const handleStep1 = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) return toast.error("Please accept the Terms of Service and Privacy Policy");
    if (!passwordStrong) return toast.error("Please choose a stronger password");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName, terms_accepted_at: new Date().toISOString() } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setStep(2);
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const googleSubmittingRef = useRef(false);

  const handleGoogle = async () => {
    if (!acceptTerms) return toast.error("Please accept the Terms of Service and Privacy Policy");
    if (googleSubmittingRef.current || googleLoading) return;
    googleSubmittingRef.current = true;
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        toast.error("Google sign-in failed");
        return;
      }
      if (result.redirected) return; // keep spinner; browser will redirect
    } finally {
      googleSubmittingRef.current = false;
      setGoogleLoading(false);
    }
  };

  const onPickAvatar = (file: File) => {
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const finish = async () => {
    if (!user) return;
    if (!validateStep2()) return;
    if (!validateStep3()) return;
    if (interests.length < 3) {
      setStep(4);
      toast.error("Pick at least 3 interests");
      focusField(interestsRef);
      return;
    }
    setLoading(true);
    let avatar_url: string | null = null;
    if (avatarFile) avatar_url = await uploadToBucket("avatars", user.id, avatarFile);
    const update: any = {
      university, country, field_of_study: field, year_of_study: year, bio,
      skills, interests, onboarding_completed: true,
      terms_accepted_at: new Date().toISOString(),
      date_of_birth: dob!.toISOString().slice(0, 10),
    };
    if (avatar_url) update.avatar_url = avatar_url;
    if (fullName) update.full_name = fullName;
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Welcome to UiPair!");
    navigate({ to: "/feed" });
  };

  const toggle = (arr: string[], val: string, set: (a: string[]) => void) =>
    set(arr.includes(val) ? arr.filter((s) => s !== val) : [...arr, val]);

  return (
    <SplitAuthLayout>
      <div className="space-y-6">


      {/* Stepper */}
      <div className="flex items-center gap-2 mb-2">
        {[1, 2, 3, 4].map((s) => {
          const isDone = s < step;
          const isActive = s === step;
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition",
                  isDone && "bg-primary text-primary-foreground border-primary",
                  isActive && "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30",
                  !isDone && !isActive && "bg-muted text-muted-foreground border-transparent",
                )}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${s}${isDone ? " completed" : isActive ? " current" : ""}`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : s}
              </div>
              {s < 4 && (
                <div className={cn("h-1 flex-1 rounded-full", s < step ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {step === 1 && (
          <>
            <h1 className="text-xl font-bold">Create your account</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 1 of 4</p>
            <Button
              variant="outline"
              className="w-full mb-3"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              aria-busy={googleLoading}
            >
              {googleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {googleLoading ? "Connecting…" : "Continue with Google"}
            </Button>
            <div className="relative my-3"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div></div>
            <form onSubmit={handleStep1} className="space-y-3">
              <div><Label>Full name</Label><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                <PasswordStrengthMeter value={password} showChecklist />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to UiPair's{" "}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={loading || !acceptTerms || !passwordStrong}>{loading ? "Creating…" : "Continue"}</Button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold">Academic info</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 2 of 4</p>
            <div className="space-y-3">
              <div ref={universityRef}>
                <Label>University</Label>
                <UniversityField
                  userId={user?.id}
                  value={university}
                  onChange={setUniversity}
                />
              </div>
              <div ref={countryRef}>
                <Label>Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div ref={fieldRef}><Label>Field of study</Label><Input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Computer Science" /></div>
              <div>
                <Label>Year of study</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5, 6].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div ref={confirmPwRef} className="space-y-1.5 pt-1">
                <Label>Confirm password</Label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                {confirmPassword.length > 0 && (
                  <p className={cn("text-xs", passwordsMatch ? "text-emerald-600" : "text-destructive")}>
                    {passwordsMatch ? "Passwords match" : "Passwords don't match"}
                  </p>
                )}
              </div>
              <div ref={dobRef} className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>Date of birth</Label>
                  {dob && (
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        dobValid ? "text-emerald-600" : "text-destructive",
                      )}
                      aria-live="polite"
                    >
                      Age: {age}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">You must be at least 18 to use UiPair.</p>
                <div className="grid grid-cols-3 gap-2">
                  <div ref={dobDayRef}>
                    <Select value={dobDay} onValueChange={setDobDay}>
                      <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                          <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div ref={dobMonthRef}>
                    <Select value={dobMonth} onValueChange={setDobMonth}>
                      <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {monthOptions.map((name, idx) => (
                          <SelectItem key={name} value={String(idx + 1)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div ref={dobYearRef}>
                    <Select value={dobYear} onValueChange={setDobYear}>
                      <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {dobDay && dobMonth && dobYear && !dob && (
                  <p className="text-xs text-destructive">That date doesn't look valid.</p>
                )}
                {dob && !dobValid && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <strong className="block">You must be 18+ to join UiPair.</strong>
                    <span>Based on your date of birth, you're {age} year{age === 1 ? "" : "s"} old.</span>
                  </div>
                )}
                {dobValid && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                    ✓ Age confirmed — you're {age} years old and eligible to join.
                  </div>
                )}
              </div>
              <div ref={termsRef}>
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                />
                <span>
                  I agree to UiPair's{" "}
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
                </span>
              </label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button onClick={() => { if (validateStep2()) setStep(3); }} className="flex-1">Continue</Button>
              </div>
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
              <div ref={skillsRef}>
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button onClick={() => { if (validateStep3()) setStep(4); }} className="flex-1">Continue</Button>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-xl font-bold">Pick your interests</h1>
            <p className="text-sm text-muted-foreground mb-4">Step 4 of 4 — choose 3+ to personalize your feed</p>
            <div ref={interestsRef} className="grid grid-cols-2 gap-2 mb-4">
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={loading}>Back</Button>
              <Button onClick={finish} disabled={loading} className="flex-1">
                {loading ? "Finishing…" : "Finish & enter UiPair"}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              By joining, you confirm you're at least 18 years old.
            </p>
          </>
        )}
      </div>

      {step === 1 && (
        <p className="mt-4 text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
      )}
      <p className="mt-2 text-center text-xs text-muted-foreground lg:text-left">
        <Link to="/terms" className="hover:underline">Terms</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:underline">Privacy</Link>
      </p>
      </div>
    </SplitAuthLayout>
  );
}

function UniversityField({
  userId,
  value,
  onChange,
}: {
  userId: string | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  const persist = async (next: string) => {
    onChange(next);
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ university: next || null })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save university");
      return;
    }
    setSavedAt(Date.now());
  };

  const onDraftChange = (v: string) => {
    setDraft(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persist(v.trim());
    }, 700);
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
        <span className="truncate text-sm">{value || "—"}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          list="university-options"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (draft.trim() !== value) persist(draft.trim());
          }}
          placeholder="Type your university name"
          autoFocus
        />
        {value && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
          >
            Done
          </Button>
        )}
      </div>
      <datalist id="university-options">
        {UNIVERSITIES.filter((u) => u !== "Other").map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <p className="text-xs text-muted-foreground">
        {saving ? "Saving…" : savedAt ? "✓ Saved" : "Autosaves as you type"}
      </p>
    </div>
  );
}
