## Goal
Convert UiPair into a per-university multi-tenant app. Each university is an isolated tenant: its own students, feed, circles, gigs, projects, bounties. Users sign up *under* a university (tenant) and only see content from that tenant by default. Global Mode becomes opt-in cross-tenant discovery.

> ⚠️ **Fresh start**: all existing rows in tenant-scoped tables (`posts`, `circles`, `projects`, `gigs`, `bounties`, `friend_requests`, `conversations`, `messages`, `notifications`, `follows`, etc.) will be wiped. Auth users + their `profiles` rows are kept (they'll re-pick a tenant on next login).

---

## 1. Data model

### New tables
- **`tenants`** — one row per university
  - `id`, `slug` (e.g. `mit`, `ur-kigali`), `name`, `country`, `domain` (optional email-domain auto-assign, e.g. `mit.edu`), `logo_url`, `primary_color`, `is_active`, `created_at`
- **`tenant_admins`** — `(tenant_id, user_id, role)` where role ∈ `owner | admin | moderator`. Used for tenant-level moderation. Separate table (avoids RLS recursion).
- **`tenant_join_requests`** — for tenants where auto-assign isn't possible; admin approves.

### Changes to existing tables
Add nullable `tenant_id uuid references tenants(id)` to:
`posts, circles, projects, project_*, gigs, gig_orders, gig_reviews, bounties, hackathon_banners, circle_*, friend_requests, conversations, messages, notifications, follows, match_dismissals, ambassador_applications`.
Backfill = none (fresh start → `DELETE FROM` each, then `ALTER … SET NOT NULL`).

`profiles` gets:
- `tenant_id uuid references tenants(id)` (the user's *home* tenant — required after onboarding)
- existing `university` / `university_id` columns become derived/display-only.

### Helper
```sql
create function public.current_tenant_id() returns uuid
  language sql stable security definer set search_path=public
  as $$ select tenant_id from public.profiles where id = auth.uid() $$;

create function public.is_tenant_admin(_tenant uuid, _user uuid) returns boolean …
```

### RLS pattern (applied to every tenant-scoped table)
```sql
-- SELECT: same tenant only (Global Mode is a server-fn that bypasses)
using ( tenant_id = public.current_tenant_id() )
-- INSERT/UPDATE: must set tenant_id = caller's tenant
with check ( tenant_id = public.current_tenant_id() and user_id = auth.uid() )
```
Cross-tenant reads for Global Mode go through `createServerFn` + `supabaseAdmin` with explicit safe-column projection.

---

## 2. Auth & onboarding flow

1. **Signup** unchanged (email/password + Google).
2. **New onboarding step "Pick your university"**:
   - If user's email domain matches a `tenants.domain` → auto-assign + show "Confirmed as <University>".
   - Else: searchable list of tenants; if missing, "Request to add your university" (creates a pending tenant).
3. Onboarding completes only when `profiles.tenant_id` is set.
4. `_app` route guard: if `profile.tenant_id` is null → redirect to `/onboarding/tenant`.

---

## 3. UI changes

- **Header**: show current tenant logo + name where "Campus/Global" toggle lives. Campus = current tenant. Global = cross-tenant (server-fn powered).
- **Profile page**: show tenant badge under name. Settings button stays as-is.
- **Create flows** (post / circle / project / gig / bounty): `tenant_id` auto-stamped from `current_tenant_id()` — no UI field.
- **Search/Discover**: scoped to tenant by default; "Search all universities" toggle when in Global Mode.
- **New `/admin` route** (visible only to `tenant_admins`): tenant settings, member list, pending join requests, content moderation.

---

## 4. Server functions

- `getTenantBootstrap()` → `{ tenant, isAdmin, memberCount }` for header/sidebar.
- `requestTenantAccess(tenantId)` / `approveTenantJoin(requestId)`.
- `globalFeed({ cursor, filters })` → cross-tenant feed via `supabaseAdmin`, returns only public-safe columns.
- `createTenant({ name, country, domain })` → admin-only (platform super-admin via env-listed user IDs initially).

---

## 5. Migration steps (in order)

1. Migration A: create `tenants`, `tenant_admins`, `tenant_join_requests` + seed a few default universities.
2. Migration B: **wipe** all tenant-scoped tables; add `tenant_id` columns NOT NULL; recreate every RLS policy with the tenant predicate; add `current_tenant_id()` helper.
3. Migration C: add `profiles.tenant_id` (nullable for existing users → forces them through tenant-pick onboarding).
4. Code: new onboarding screen, header tenant badge, server fns, admin route, update every `.insert()` site to omit `tenant_id` (RLS + default trigger fills it).
5. Add trigger on each tenant-scoped table: `before insert` set `tenant_id = current_tenant_id()` if null.

---

## 6. Out of scope (for this first pass)
- Custom domains per tenant.
- Per-tenant theming beyond logo + accent color.
- Cross-tenant friendships/DMs (friend_requests stays same-tenant; we can open later).
- Stripe Connect per tenant (gig payouts stay platform-wide).

---

## Confirm before I start
This will **delete all existing posts, circles, projects, gigs, bounties, messages, notifications, friend requests, and follows**. User accounts and profile basics stay. Reply **"go"** to proceed, or tell me what to change.