import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STRIPE_GATEWAY = "https://connector-gateway.lovable.dev/stripe/v1";

function gatewayHeaders() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const stripeKey = process.env.STRIPE_SANDBOX_API_KEY ?? process.env.STRIPE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!stripeKey) throw new Error("STRIPE_SANDBOX_API_KEY is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": stripeKey,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

/**
 * Create a Stripe Embedded Checkout session for a premium circle subscription.
 * Returns a client_secret for the EmbeddedCheckoutProvider.
 */
export const createCircleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { circleId: string }) => {
    if (!input?.circleId || typeof input.circleId !== "string" || input.circleId.length > 64) {
      throw new Error("Invalid circleId");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load the circle and verify it's premium
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
    if (existing) throw new Error("Already a member of this circle");

    const unitAmount = Math.round(Number(circle.price_monthly) * 100);

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("ui_mode", "embedded_page");
    params.set("return_url", "{ORIGIN}/circles/{CIRCLE_ID}?checkout_session_id={CHECKOUT_SESSION_ID}"
      .replace("{ORIGIN}", "")  // we'll rewrite below
      .replace("{CIRCLE_ID}", circle.id));
    // Compose a real return URL using request origin
    const requestUrl = new URL((globalThis as any).location?.href ?? "http://localhost");
    // Fallback: use a relative path; Stripe requires absolute, so use header-derived origin
    // Use process.env or x-forwarded headers via TanStack getRequestHost
    // Simpler: read from a header via getRequest()
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    params.set(
      "return_url",
      `${origin}/circles/${circle.id}?checkout_session_id={CHECKOUT_SESSION_ID}`
    );

    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", `Premium circle — ${circle.name}`);
    if (circle.description) {
      params.set("line_items[0][price_data][product_data][description]", circle.description.slice(0, 500));
    }
    params.set("line_items[0][price_data][unit_amount]", String(unitAmount));
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set("line_items[0][quantity]", "1");

    // Critical: metadata is what the webhook reads to grant access
    params.set("metadata[circle_id]", circle.id);
    params.set("metadata[user_id]", userId);
    params.set("subscription_data[metadata][circle_id]", circle.id);
    params.set("subscription_data[metadata][user_id]", userId);
    params.set("client_reference_id", `${userId}:${circle.id}`);

    const res = await fetch(`${STRIPE_GATEWAY}/checkout/sessions`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: params.toString(),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error("[stripe] create session failed", res.status, body);
      throw new Error(body?.error?.message ?? `Checkout failed (${res.status})`);
    }

    return {
      sessionId: body.id as string,
      clientSecret: body.client_secret as string,
    };
  });

/**
 * Verify a Stripe checkout session is complete and (idempotently) ensure
 * the user's circle membership exists. Used as a fast-path after the
 * embedded checkout returns, in case the webhook hasn't landed yet.
 */
export const verifyCircleCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input?.sessionId || !input.sessionId.startsWith("cs_")) {
      throw new Error("Invalid sessionId");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const res = await fetch(`${STRIPE_GATEWAY}/checkout/sessions/${data.sessionId}`, {
      method: "GET",
      headers: gatewayHeaders(),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message ?? `Session lookup failed (${res.status})`);
    }

    const paid = body.payment_status === "paid" || body.status === "complete";
    const circleId = body.metadata?.circle_id;
    const sessionUserId = body.metadata?.user_id;

    if (!paid) return { granted: false, reason: "not_paid" as const };
    if (!circleId || sessionUserId !== userId) {
      return { granted: false, reason: "mismatch" as const };
    }

    // Idempotently insert membership (safe if webhook already inserted)
    const { error } = await supabase
      .from("circle_members")
      .insert({ circle_id: circleId, user_id: userId, role: "member" });

    if (error && !/duplicate key|unique/i.test(error.message)) {
      console.error("[verifyCircleCheckout] insert failed", error);
      return { granted: false, reason: "insert_failed" as const };
    }

    return { granted: true, circleId };
  });
