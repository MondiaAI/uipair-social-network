import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { applySuccessfulFlwTransaction } from "@/lib/flutterwave.functions";

// Flutterwave sends webhooks with a "verif-hash" header set to the
// secret hash you configure in the dashboard. We compare against the
// FLUTTERWAVE_WEBHOOK_HASH secret.
function isValidSignature(provided: string | null): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  if (!expected || !provided) return false;
  // Plain equality — Flutterwave sends the raw hash string. Use a timing-
  // safe comparison via hash to avoid leaking length.
  const a = createHash("sha256").update(provided).digest("hex");
  const b = createHash("sha256").update(expected).digest("hex");
  return a === b;
}

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("verif-hash");
        if (!isValidSignature(provided)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event: string = payload?.event ?? "";
        const data = payload?.data ?? {};

        // We care about successful charges. Anything else we ack so
        // Flutterwave doesn't retry.
        if (event === "charge.completed" && data?.status === "successful") {
          const result = await applySuccessfulFlwTransaction({
            tx_ref: data.tx_ref,
            transaction_id: data.id,
          });
          if ("error" in result) {
            console.error("[flw-webhook] apply failed:", result.error);
            return new Response(result.error, { status: 500 });
          }
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
