import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { PRICE_MATRIX, periodEndForPlan, type Plan } from "./flutterwave.shared";

const FLW_BASE = "https://api.flutterwave.com/v3";

function siteOrigin(): string {
  // Flutterwave redirects the user back here after checkout.
  return (
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://uipair-social-network.lovable.app"
  );
}

const CheckoutInput = z.object({
  plan: z.enum(["monthly", "yearly"]),
  currency: z.string().min(3).max(3),
});

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => CheckoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secret) return { error: "Flutterwave is not configured. Contact support." };

    const matrix = PRICE_MATRIX[data.currency];
    if (!matrix) return { error: `Currency ${data.currency} is not supported yet.` };
    const amount = matrix[data.plan as Plan];

    // Pull user info (email + name)
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userRow?.user?.email ?? "";
    if (!email) return { error: "Your account has no email on file." };

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();
    const name = prof?.full_name || prof?.username || email.split("@")[0];

    const txRef = `uipair_${userId}_${data.plan}_${Date.now()}`;

    // Pre-create / update the subscription row in 'incomplete' so the
    // webhook can flip it to 'active' when payment lands.
    const { error: upsertErr } = await supabaseAdmin
      .from("flutterwave_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: data.plan,
          status: "incomplete",
          currency: data.currency,
          amount_cents: Math.round(amount * 100),
          flw_tx_ref: txRef,
          flw_customer_email: email,
        },
        { onConflict: "user_id" },
      );
    if (upsertErr) return { error: upsertErr.message };

    const body = {
      tx_ref: txRef,
      amount,
      currency: data.currency,
      redirect_url: `${siteOrigin()}/settings?flw=return`,
      customer: { email, name },
      customizations: {
        title: "UiPair Premium",
        description: `UiPair Premium — ${data.plan} plan`,
        logo: `${siteOrigin()}/icon-512.png`,
      },
      meta: { user_id: userId, plan: data.plan, currency: data.currency },
    };

    try {
      const res = await fetch(`${FLW_BASE}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json: any = await res.json();
      if (!res.ok || json?.status !== "success" || !json?.data?.link) {
        return { error: json?.message || "Failed to create checkout" };
      }
      return { url: json.data.link as string };
    } catch (e: any) {
      return { error: e?.message ?? "Checkout request failed" };
    }
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("flutterwave_subscriptions")
      .select("plan,status,currency,amount_cents,current_period_start,current_period_end,cancel_at_period_end,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { subscription: null };
    return { subscription: data };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("flutterwave_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("user_id", userId);
    if (error) return { error: error.message };
    return { ok: true };
  });

// Helper used by the webhook route — exported via a server-only module
// since webhooks call it directly.
export async function applySuccessfulFlwTransaction(args: {
  tx_ref: string;
  transaction_id: string | number;
}): Promise<{ ok: true } | { error: string }> {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) return { error: "FLUTTERWAVE_SECRET_KEY missing" };

  // Verify with Flutterwave (defence in depth)
  const verifyRes = await fetch(
    `${FLW_BASE}/transactions/${args.transaction_id}/verify`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const verify: any = await verifyRes.json();
  if (verify?.status !== "success") return { error: "Could not verify transaction" };
  const tx = verify.data;
  if (tx?.status !== "successful") return { error: `Transaction status is ${tx?.status}` };
  if (tx?.tx_ref !== args.tx_ref) return { error: "tx_ref mismatch" };

  const userId: string | undefined = tx?.meta?.user_id;
  const plan: Plan | undefined = tx?.meta?.plan;
  if (!userId || !plan) return { error: "Missing user_id/plan in meta" };

  const start = new Date();
  const end = periodEndForPlan(plan, start);

  const { error } = await supabaseAdmin
    .from("flutterwave_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan,
        status: "active",
        currency: tx.currency,
        amount_cents: Math.round(Number(tx.amount) * 100),
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: true, // user can re-subscribe to renew
        flw_tx_ref: args.tx_ref,
        flw_transaction_id: String(args.transaction_id),
        flw_customer_email: tx?.customer?.email ?? null,
        last_event: tx,
      },
      { onConflict: "user_id" },
    );
  if (error) return { error: error.message };
  return { ok: true };
}
