// Submit a client-side crash report to the backend.
// Inserts directly into the public.crash_reports table — RLS allows anon
// inserts so SSR/anon crashes are captured too.

import { supabase } from "@/integrations/supabase/client";

export interface CrashReportPayload {
  label: string;
  route?: string | null;
  errorName?: string | null;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  context?: Record<string, unknown>;
}

export async function submitCrashReport(payload: CrashReportPayload) {
  const { data: userData } = await supabase.auth.getUser();
  const row = {
    user_id: userData?.user?.id ?? null,
    label: payload.label,
    route: payload.route ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : null),
    error_name: payload.errorName ?? null,
    message: payload.message,
    stack: payload.stack ?? null,
    component_stack: payload.componentStack ?? null,
    context: payload.context ?? {},
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };
  const { data, error } = await supabase
    .from("crash_reports")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
