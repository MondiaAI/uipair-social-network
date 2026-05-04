import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const STRIPE_GATEWAY = "https://connector-gateway.lovable.dev/stripe/v1";

/**
 * Lovable Payments webhook (Stripe via gateway).
 *
 * The gateway delivers normalized events. For our flow we care about:
 *   - checkout.session.completed   → grant access on first payment
 *   - subscription.created          → grant access (idempotent)
 *   - subscription.updated          → keep access in sync (status: active vs canceled)
 *   - subscription.canceled         → revoke access
 *   - transaction.payment_failed    → log only (Stripe retries via dunning)
 *
 * The webhook URL is configured to receive ?env=sandbox (test) or ?env=live.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Note: signature verification is handled by the Lovable gateway before
        // forwarding the event to this endpoint. We still validate that the
        // payload looks like a Stripe event with metadata we control.

        const eventType: string =
          payload?.type ?? payload?.event_type ?? payload?.event?.type ?? "unknown";
        const data = payload?.data?.object ?? payload?.data ?? payload?.object ?? payload;

        try {
          if (
            eventType === "checkout.session.completed" ||
            eventType === "transaction.completed"
          ) {
            await handleCheckoutCompleted(data);
          } else if (
            eventType === "customer.subscription.created" ||
            eventType === "subscription.created" ||
            eventType === "customer.subscription.updated" ||
            eventType === "subscription.updated"
          ) {
            await handleSubscriptionUpsert(data);
          } else if (
            eventType === "customer.subscription.deleted" ||
            eventType === "subscription.canceled" ||
            eventType === "subscription.deleted"
          ) {
            await handleSubscriptionCanceled(data);
          } else {
            console.log("[payments-webhook] ignored event:", eventType);
          }
        } catch (err) {
          console.error("[payments-webhook] handler error", eventType, err);
          // Return 200 so the gateway doesn't retry endlessly on logical issues.
          return Response.json({ received: true, handled: false });
        }

        return Response.json({ received: true, handled: true });
      },
    },
  },
});

async function handleCheckoutCompleted(session: any) {
  // For embedded subscriptions, line items / customer info aren't expanded by default.
  // Trust the metadata we set when creating the session.
  const circleId = session?.metadata?.circle_id;
  const userId = session?.metadata?.user_id;
  const paid = session?.payment_status === "paid" || session?.status === "complete";

  if (!circleId || !userId) {
    console.log("[payments-webhook] checkout.session.completed missing metadata");
    return;
  }
  if (!paid) {
    console.log("[payments-webhook] checkout not paid yet, skipping");
    return;
  }

  await grantMembership(circleId, userId);
}

async function handleSubscriptionUpsert(sub: any) {
  const circleId = sub?.metadata?.circle_id;
  const userId = sub?.metadata?.user_id;
  const status = sub?.status;

  if (!circleId || !userId) {
    // Some subscription.updated events come without metadata if it wasn't
    // attached at creation; try fetching the subscription.
    const subId = sub?.id;
    if (subId) {
      const fetched = await fetchSubscription(subId);
      if (fetched) return handleSubscriptionUpsert(fetched);
    }
    console.log("[payments-webhook] subscription event missing metadata");
    return;
  }

  if (status === "active" || status === "trialing") {
    await grantMembership(circleId, userId);
  } else if (
    status === "canceled" ||
    status === "incomplete_expired" ||
    status === "unpaid"
  ) {
    await revokeMembership(circleId, userId);
  }
}

async function handleSubscriptionCanceled(sub: any) {
  const circleId = sub?.metadata?.circle_id;
  const userId = sub?.metadata?.user_id;
  if (!circleId || !userId) return;
  await revokeMembership(circleId, userId);
}

async function grantMembership(circleId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from("circle_members")
    .insert({ circle_id: circleId, user_id: userId, role: "member" });
  if (error && !/duplicate key|unique/i.test(error.message)) {
    throw error;
  }
  console.log("[payments-webhook] granted access", { circleId, userId });
}

async function revokeMembership(circleId: string, userId: string) {
  // Don't remove the leader from their own circle.
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

async function fetchSubscription(subId: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const stripeKey = process.env.STRIPE_SANDBOX_API_KEY ?? process.env.STRIPE_API_KEY;
  if (!lovableKey || !stripeKey) return null;
  const res = await fetch(`${STRIPE_GATEWAY}/subscriptions/${subId}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": stripeKey,
    },
  });
  if (!res.ok) return null;
  return res.json();
}
