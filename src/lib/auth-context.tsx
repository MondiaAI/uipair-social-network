import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureDeviceKeypair } from "@/lib/e2ee";
import { onProfileUpdate } from "@/lib/profile-broadcast";
import { toast } from "sonner";
import { uniqueRealtimeChannelName } from "@/lib/realtime-channel";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  university: string | null;
  university_id: string | null;
  country: string | null;
  field_of_study: string | null;
  year_of_study: number | null;
  bio: string | null;
  is_pro: boolean;
  is_verified: boolean;
  reputation_score: number;
  tenant_id: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  tenant: Tenant | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    const p = data as Profile | null;
    setProfile(p);
    if (p?.tenant_id) {
      const { data: t } = await supabase
        .from("tenants")
        .select("id, slug, name, country, logo_url, primary_color")
        .eq("id", p.tenant_id)
        .maybeSingle();
      setTenant((t as Tenant) ?? null);
    } else {
      setTenant(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setTimeout(() => loadProfile(newSession.user.id), 0);
        setTimeout(() => { ensureDeviceKeypair(newSession.user.id).catch(() => {}); }, 0);
      } else {
        setProfile(null);
        setTenant(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id);
        ensureDeviceKeypair(s.user.id).catch(() => {});
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const timeout = setTimeout(() => setLoading(false), 1500);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(uniqueRealtimeChannelName(`own-profile-${user.id}`))
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => loadProfile(user.id),
      )
      .subscribe();
    const off = onProfileUpdate((e) => {
      if (e.userId === user.id) {
        loadProfile(user.id);
        toast.message("Profile updated in another tab");
      }
    });
    return () => { supabase.removeChannel(channel); off(); };
  }, [user?.id]);

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshProfile = async () => { if (user) await loadProfile(user.id); };

  return (
    <AuthContext.Provider value={{ user, session, profile, tenant, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
