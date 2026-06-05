import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const Common = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  is_default: z.boolean().optional(),
});

const MobileMoney = Common.extend({
  method: z.literal("mobile_money"),
  mm_country: z.string().min(2).max(40),
  mm_provider: z.string().min(2).max(40),
  mm_phone: z.string().min(6).max(20).regex(/^[+0-9 ()-]+$/),
});

const Bank = Common.extend({
  method: z.literal("bank"),
  bank_name: z.string().min(2).max(100),
  bank_country: z.string().min(2).max(60),
  bank_account_number: z.string().min(4).max(40).regex(/^[A-Za-z0-9 -]+$/),
  bank_account_name: z.string().min(2).max(120),
  bank_swift: z.string().max(20).optional().nullable(),
});

const Wallet = Common.extend({
  method: z.literal("flutterwave_wallet"),
  wallet_email: z.string().email().max(200),
});

const PayoutInput = z.discriminatedUnion("method", [MobileMoney, Bank, Wallet]);

export const listMyPayoutAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("payout_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return { accounts: [], error: error.message };
    return { accounts: data ?? [] };
  });

export const addPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => PayoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // If marking default, clear other defaults first
    if (data.is_default) {
      await supabaseAdmin
        .from("payout_accounts")
        .update({ is_default: false })
        .eq("user_id", userId);
    }

    const insertRow: any = {
      user_id: userId,
      method: data.method,
      label: data.label ?? null,
      is_default: !!data.is_default,
    };
    if (data.method === "mobile_money") {
      Object.assign(insertRow, {
        mm_country: data.mm_country,
        mm_provider: data.mm_provider,
        mm_phone: data.mm_phone,
      });
    } else if (data.method === "bank") {
      Object.assign(insertRow, {
        bank_name: data.bank_name,
        bank_country: data.bank_country,
        bank_account_number: data.bank_account_number,
        bank_account_name: data.bank_account_name,
        bank_swift: data.bank_swift ?? null,
      });
    } else if (data.method === "flutterwave_wallet") {
      Object.assign(insertRow, { wallet_email: data.wallet_email });
    }

    const { error, data: created } = await supabaseAdmin
      .from("payout_accounts")
      .insert(insertRow)
      .select()
      .single();
    if (error) return { error: error.message };
    return { account: created };
  });

export const deletePayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("payout_accounts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) return { error: error.message };
    return { ok: true };
  });

export const setDefaultPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await supabaseAdmin.from("payout_accounts").update({ is_default: false }).eq("user_id", userId);
    const { error } = await supabaseAdmin
      .from("payout_accounts")
      .update({ is_default: true })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) return { error: error.message };
    return { ok: true };
  });
