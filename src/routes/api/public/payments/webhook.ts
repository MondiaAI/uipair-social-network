import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import type Stripe from "stripe";

/**
 * Stripe webhook for premium-circle subscriptions.
 * URL: /api/public/payments/webhook?env=sandbox|live
 *
 * Handled events:
 *   - checkout.session.completed     → upsert subscription + grant membership
 *   - customer.subscription.created  → upsert subscription + grant membership
 *   - customer.subscription.updated  → upsert subscription, sync access
 *   - customer.subscription.deleted  → mark canceled (access until period end)
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[payments-webhook] missing/invalid env query:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;

        let event: Stripe.Event;
        try {
          event = await verifyWebhook(request, env);
        } catch (err) {
          console.error("[payments-webhook] signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed":
              await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, env);
              break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await handleSubscriptionUpsert(event.data.object as Stripe.Subscription, env);
              break;
            case "customer.subscription.deleted":
              await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, env);
              break;
            default:
              console.log("[payments-webhook] ignored event:", event.type);
          }
          return Response.json({ received: true, handled: true });
        } catch (err) {
          console.error("[payments-webhook] handler error", event.type, err);
          // Return 200 to avoid endless retries on logical issues.
          return Response.json({ received: true, handled: false });
        }
      },
    },
  },
});

// ---- Handlers --------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, env: StripeEnv) {
  const circleId = session.metadata?.circle_id;
  const userId = session.metadata?.user_id;
  const subId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id;
  if (!circleId || !userId || !subId) {
    console.warn("[payments-webhook] checkout.session.completed missing data", {
      circleId, userId, subId,
    });
    return;
  }
  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) return;

  // Insert minimal sub row immediately (status will be refined by subscription.* events).
  await supabaseAdmin
    .from("circle_subscriptions")
    .upsert(
      {
        user_id: userId,
        circle_id: circleId,
        stripe_subscription_id: subId,
        stripe_customer_id: typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? "",
        status: "active",
        environment: env,
      },
      { onConflict: "stripe_subscription_id" },
    );

  await grantMembership(circleId, userId);
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription, env: StripeEnv) {
  const circleId = sub.metadata?.circle_id;
  const userId = sub.metadata?.user_id;
  if (!circleId || !userId) {
    console.warn("[payments-webhook] subscription event missing metadata", sub.id);
    return;
  }

  // Period fields: dahlia/basil put them on the subscription item.
  const item = sub.items?.data?.[0];
  const periodStart = (item as any)?.current_period_start ?? (sub as any).current_period_start;
  const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end;

  await supabaseAdmin
    .from("circle_subscriptions")
    .upsert(
      {
        user_id: userId,
        circle_id: circleId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        status: sub.status,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );

  if (sub.status === "active" || sub.status === "trialing") {
    await grantMembership(circleId, userId);
  } else if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
    // For "canceled", access stays until period end — only revoke when period has passed.
    const ended = periodEnd ? periodEnd * 1000 < Date.now() : true;
    if (ended) await revokeMembership(circleId, userId);
  }
  // past_due: keep access; Stripe is retrying.
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription, env: StripeEnv) {
  const circleId = sub.metadata?.circle_id;
  const userId = sub.metadata?.user_id;
  if (!circleId || !userId) return;

  const item = sub.items?.data?.[0];
  const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end;

  await supabaseAdmin
    .from("circle_subscriptions")
    .update({
      status: "canceled",
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);

  // Revoke only if period has actually ended (immediate cancel) or no period info.
  const ended = periodEnd ? periodEnd * 1000 < Date.now() : true;
  if (ended) await revokeMembership(circleId, userId);
}

async function grantMembership(circleId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from("circle_members")
    .insert({ circle_id: circleId, user_id: userId, role: "member" });
  if (error && !/duplicate key|unique/i.test(error.message)) throw error;
  console.log("[payments-webhook] granted access", { circleId, userId });
}

async function revokeMembership(circleId: string, userId: string) {
  // Don't remove leader from their own circle.
  const { data: circle } = await supabaseAdmin
    .from("circles")
    .select("leader_id")
    .eq("id", circleId)
    .maybeSingle();
  if (circle?.leader_id === userId) return;

  const { error } = await supabaseAdmin
    .from("circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("user_id", userId);
  if (error) throw error;
  console.log("[payments-webhook] revoked access", { circleId, userId });
}
