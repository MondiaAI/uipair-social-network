import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";

function isStripeEnv(v: unknown): v is StripeEnv {
  return v === "sandbox" || v === "live";
}

/**
 * Create a Stripe Embedded Checkout session for a premium circle subscription.
 * Returns a clientSecret for EmbeddedCheckoutProvider.
 */
export const createCircleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { circleId: string; environment: StripeEnv }) => {
    if (!input?.circleId || typeof input.circleId !== "string" || input.circleId.length > 64) {
      throw new Error("Invalid circleId");
    }
    if (!isStripeEnv(input.environment)) throw new Error("Invalid environment");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: circle, error } = await supabase
      .from("circles")
      .select("id,name,is_premium,price_monthly,description")
      .eq("id", data.circleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!circle) throw new Error("Circle not found");
    if (!circle.is_premium) throw new Error("This circle is free — no checkout needed");
    if (!circle.price_monthly || Number(circle.price_monthly) <= 0) {
      throw new Error("Circle price is not configured");
    }

    // Already a member?
    const { data: existing } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circle.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("You are already a member of this circle");

    // Already an active subscription? (covers the case where membership was removed manually)
    const { data: activeSub } = await supabase
      .from("circle_subscriptions")
      .select("stripe_subscription_id,status,current_period_end")
      .eq("user_id", userId)
      .eq("circle_id", circle.id)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      activeSub &&
      ["active", "trialing", "past_due"].includes(activeSub.status as string)
    ) {
      throw new Error("You already have an active subscription to this circle");
    }

    const req = getRequest();
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const unitAmount = Math.round(Number(circle.price_monthly) * 100);

    const stripe = createStripeClient(data.environment);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${origin}/circles/${circle.id}?checkout_session_id={CHECKOUT_SESSION_ID}`,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Premium circle — ${circle.name}`,
              ...(circle.description && {
                description: circle.description.slice(0, 500),
              }),
            },
            unit_amount: unitAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: { circle_id: circle.id, user_id: userId },
      subscription_data: {
        metadata: { circle_id: circle.id, user_id: userId },
      },
      client_reference_id: `${userId}:${circle.id}`,
    });

    return {
      sessionId: session.id,
      clientSecret: session.client_secret as string,
    };
  });

/**
 * Verify a Stripe checkout session is paid. Idempotent fast-path used after
 * embedded checkout completes, before the webhook may have landed.
 * Does NOT directly insert membership — the webhook is the source of truth.
 */
export const verifyCircleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string; environment: StripeEnv }) => {
    if (!input?.sessionId || !input.sessionId.startsWith("cs_")) {
      throw new Error("Invalid sessionId");
    }
    if (!isStripeEnv(input.environment)) throw new Error("Invalid environment");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const stripe = createStripeClient(data.environment);
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });

    const paid =
      session.payment_status === "paid" || session.status === "complete";
    if (!paid) return { paid: false as const };

    const sessionUserId = session.metadata?.user_id;
    if (sessionUserId !== userId) {
      return { paid: false as const, reason: "user_mismatch" };
    }
    return {
      paid: true as const,
      circleId: session.metadata?.circle_id ?? null,
    };
  });

/**
 * Cancel an active circle subscription at period end. The user keeps access
 * until current_period_end; the webhook will revoke when Stripe fires
 * customer.subscription.updated with cancel_at_period_end=true (recorded), and
 * the access expires naturally because the gating function checks period_end.
 */
export const cancelCircleSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { circleId: string; environment: StripeEnv }) => {
    if (!input?.circleId || typeof input.circleId !== "string") {
      throw new Error("Invalid circleId");
    }
    if (!isStripeEnv(input.environment)) throw new Error("Invalid environment");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: sub, error } = await supabase
      .from("circle_subscriptions")
      .select("stripe_subscription_id,status,cancel_at_period_end")
      .eq("user_id", userId)
      .eq("circle_id", data.circleId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No subscription found for this circle");
    if (sub.cancel_at_period_end) {
      return { ok: true, alreadyCanceled: true };
    }
    if (!["active", "trialing", "past_due"].includes(sub.status as string)) {
      throw new Error(`Cannot cancel a subscription in status: ${sub.status}`);
    }

    const stripe = createStripeClient(data.environment);
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    return { ok: true, alreadyCanceled: false };
  });
