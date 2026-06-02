#!/usr/bin/env node
/**
 * Seed a temporary E2E test user + minimum feed data so the smoke test can
 * load /feed against a real backend without depending on existing data.
 *
 * Required env:
 *   SUPABASE_URL                — project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS)
 *
 * Optional env:
 *   E2E_TEST_EMAIL              — defaults to e2e-smoke@uipair.test
 *   E2E_TEST_PASSWORD           — defaults to a stable strong string
 *   E2E_TENANT_ID               — defaults to MIT tenant
 *
 * Idempotent: re-running upserts the same user, profile, and seed post.
 * Writes the resolved credentials to stdout as JSON for CI to consume.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const EMAIL = process.env.E2E_TEST_EMAIL || "e2e-smoke@uipair.test";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "Smoke-Test-Pass-2026!";
const TENANT_ID =
  process.env.E2E_TENANT_ID || "35eb8149-03d3-43a5-8322-c231e32de9ca"; // MIT

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureUser() {
  // Try create first; if the user already exists, fall back to lookup + reset.
  const created = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "E2E Smoke", username: "e2e_smoke" },
  });

  if (!created.error) return created.data.user.id;

  const msg = (created.error.message || "").toLowerCase();
  const isDup =
    created.error.status === 422 ||
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists");
  if (!isDup) throw created.error;

  // User exists — find by email via the admin REST endpoint (supports ?email=).
  const url = new URL(`${SUPABASE_URL}/auth/v1/admin/users`);
  url.searchParams.set("email", EMAIL);
  const resp = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });
  if (!resp.ok) throw new Error(`admin/users lookup failed: ${resp.status} ${await resp.text()}`);
  const body = await resp.json();
  const user = Array.isArray(body?.users) ? body.users[0] : body?.id ? body : null;
  if (!user?.id) throw new Error(`could not locate existing user ${EMAIL}`);

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (updErr) throw updErr;
  return user.id;
}

async function ensureProfile(userId) {
  const dob = "2000-01-01"; // >= 18 years old; satisfies age trigger
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name: "E2E Smoke",
      username: "e2e_smoke",
      tenant_id: TENANT_ID,
      university: "Massachusetts Institute of Technology",
      date_of_birth: dob,
      terms_accepted_at: new Date().toISOString(),
      onboarding_completed: true,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

async function ensureSeedPost(userId) {
  const SEED_CONTENT = "[e2e-smoke-seed] Welcome to the feed — this post is used by automated smoke tests.";
  const { data: existing, error: selErr } = await admin
    .from("posts")
    .select("id")
    .eq("user_id", userId)
    .eq("content", SEED_CONTENT)
    .limit(1);
  if (selErr) throw selErr;
  if (existing && existing.length > 0) return existing[0].id;

  const { data, error } = await admin
    .from("posts")
    .insert({
      user_id: userId,
      tenant_id: TENANT_ID,
      content: SEED_CONTENT,
      post_type: "brainstorm",
      university: "Massachusetts Institute of Technology",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

(async () => {
  const userId = await ensureUser();
  await ensureProfile(userId);
  const postId = await ensureSeedPost(userId);
  // JSON-only output so CI can `jq` it.
  console.log(JSON.stringify({ userId, email: EMAIL, password: PASSWORD, postId, tenantId: TENANT_ID }));
})().catch((err) => {
  console.error("seed-e2e failed:", err);
  process.exit(1);
});
