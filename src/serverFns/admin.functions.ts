import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns the list of tenants the current user moderates.
 * Empty array means the caller is not a tenant admin.
 */
export const getMyAdminTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("tenant_admins")
      .select("tenant_id, role, tenants:tenant_id(id, slug, name, logo_url, primary_color)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return {
      tenants: (data ?? []).map((r: any) => ({
        tenant_id: r.tenant_id,
        role: r.role,
        ...(r.tenants ?? {}),
      })),
    };
  });

async function assertAdmin(userId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_admins")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: you are not an admin for this tenant");
}

/** List pending tenant join requests for a tenant the caller moderates. */
export const listTenantJoinRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string; status?: "pending" | "approved" | "declined" }) => {
    if (!d?.tenantId) throw new Error("tenantId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, data.tenantId);
    const { data: rows, error } = await supabaseAdmin
      .from("tenant_join_requests")
      .select("id, user_id, status, note, created_at, updated_at, profiles:user_id(id, full_name, username, avatar_url)")
      .eq("tenant_id", data.tenantId)
      .eq("status", data.status ?? "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: rows ?? [] };
  });

/** Approve a tenant join request: sets profile.tenant_id and marks request approved. */
export const approveTenantJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => {
    if (!d?.requestId) throw new Error("requestId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: req, error } = await supabaseAdmin
      .from("tenant_join_requests")
      .select("id, tenant_id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Request not found");
    await assertAdmin(context.userId, req.tenant_id);
    if (req.status !== "pending") throw new Error("Request already resolved");

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ tenant_id: req.tenant_id })
      .eq("id", req.user_id);
    if (profErr) throw new Error(profErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("tenant_join_requests")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: req.user_id,
      tenant_id: req.tenant_id,
      type: "tenant_join_approved",
      content: "Your request to join your university was approved.",
      related_id: req.tenant_id,
    });

    return { ok: true };
  });

/** Decline a tenant join request. */
export const declineTenantJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => {
    if (!d?.requestId) throw new Error("requestId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: req, error } = await supabaseAdmin
      .from("tenant_join_requests")
      .select("id, tenant_id, user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("Request not found");
    await assertAdmin(context.userId, req.tenant_id);
    if (req.status !== "pending") throw new Error("Request already resolved");

    const { error: updErr } = await supabaseAdmin
      .from("tenant_join_requests")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", req.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: req.user_id,
      tenant_id: req.tenant_id,
      type: "tenant_join_declined",
      content: "Your request to join your university was declined.",
      related_id: req.tenant_id,
    });

    return { ok: true };
  });

/** List circles + members for a tenant the caller moderates. */
export const listTenantCircles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tenantId: string }) => {
    if (!d?.tenantId) throw new Error("tenantId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, data.tenantId);
    const { data: circles, error } = await supabaseAdmin
      .from("circles")
      .select("id, name, subject, kind, is_premium, member_count, leader_id, created_at, profiles:leader_id(full_name, username, avatar_url)")
      .eq("tenant_id", data.tenantId)
      .order("member_count", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { circles: circles ?? [] };
  });

/** List members of a specific circle (admin view). */
export const listCircleMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { circleId: string }) => {
    if (!d?.circleId) throw new Error("circleId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: circle, error: cErr } = await supabaseAdmin
      .from("circles")
      .select("id, tenant_id")
      .eq("id", data.circleId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!circle) throw new Error("Circle not found");
    await assertAdmin(context.userId, circle.tenant_id);

    const { data: members, error } = await supabaseAdmin
      .from("circle_members")
      .select("user_id, role, joined_at, profiles:user_id(full_name, username, avatar_url)")
      .eq("circle_id", data.circleId)
      .order("joined_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { members: members ?? [] };
  });

/** Remove a member from a circle (admin moderation). */
export const removeCircleMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { circleId: string; userId: string }) => {
    if (!d?.circleId || !d?.userId) throw new Error("circleId and userId required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: circle, error: cErr } = await supabaseAdmin
      .from("circles")
      .select("id, tenant_id, leader_id")
      .eq("id", data.circleId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!circle) throw new Error("Circle not found");
    await assertAdmin(context.userId, circle.tenant_id);
    if (data.userId === circle.leader_id) {
      throw new Error("Cannot remove the circle leader");
    }
    const { error } = await supabaseAdmin
      .from("circle_members")
      .delete()
      .eq("circle_id", data.circleId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Global Mode feed: cross-tenant posts. Admin-only because regular RLS scopes
 * reads to the user's home tenant. Uses the admin client to bypass RLS.
 */
export const globalFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; postType?: string; tenantId?: string } | undefined) => {
    const limit = Math.min(Math.max(d?.limit ?? 30, 1), 100);
    return { limit, postType: d?.postType, tenantId: d?.tenantId };
  })
  .handler(async ({ data, context }) => {
    const { data: admin } = await supabaseAdmin
      .from("tenant_admins")
      .select("tenant_id")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    if (!admin) throw new Error("Forbidden: tenant admin only");

    let q = supabaseAdmin
      .from("posts")
      .select("id, user_id, tenant_id, content, post_type, university, is_live_session, media_url, created_at, profiles:user_id(full_name, username, avatar_url), tenants:tenant_id(name, slug, logo_url)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.postType) q = q.eq("post_type", data.postType as any);
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);

    const { data: posts, error } = await q;
    if (error) throw new Error(error.message);
    return { posts: posts ?? [] };
  });
