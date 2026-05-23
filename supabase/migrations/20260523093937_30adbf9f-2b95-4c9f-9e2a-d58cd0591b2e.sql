
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  country text,
  email_domain text unique,
  logo_url text,
  primary_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tenants enable row level security;
create policy "Tenants viewable by everyone" on public.tenants for select using (true);
create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

create type public.tenant_admin_role as enum ('owner','admin','moderator');

create table public.tenant_admins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role public.tenant_admin_role not null default 'admin',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
alter table public.tenant_admins enable row level security;
create policy "Admins viewable by authenticated" on public.tenant_admins for select to authenticated using (true);

create table public.tenant_join_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
alter table public.tenant_join_requests enable row level security;
create policy "Users view own join requests" on public.tenant_join_requests for select to authenticated
  using (auth.uid() = user_id);
create policy "Users create own join requests" on public.tenant_join_requests for insert to authenticated
  with check (auth.uid() = user_id);

alter table public.profiles add column tenant_id uuid references public.tenants(id);
create index profiles_tenant_id_idx on public.profiles(tenant_id);

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_tenant_admin(_tenant uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenant_admins where tenant_id = _tenant and user_id = _user)
$$;

create or replace function public.set_tenant_id_from_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then new.tenant_id := public.current_tenant_id(); end if;
  return new;
end $$;

create policy "Tenant admins view requests" on public.tenant_join_requests for select to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()));
create policy "Tenant admins update requests" on public.tenant_join_requests for update to authenticated
  using (public.is_tenant_admin(tenant_id, auth.uid()));

-- WIPE (cascade handles dependents like reactions -> posts)
truncate table
  public.messages, public.conversation_mutes, public.conversations,
  public.notifications, public.match_dismissals, public.friend_requests, public.follows,
  public.reactions, public.comments, public.posts,
  public.gig_reviews, public.gig_orders, public.gigs, public.bounties,
  public.resource_purchases, public.resources, public.study_requests,
  public.circle_post_comments, public.circle_posts, public.circle_resources, public.circle_sessions,
  public.circle_announcements, public.circle_invites, public.circle_subscriptions, public.circle_members, public.circles,
  public.project_activity, public.project_applications, public.project_comments, public.project_files,
  public.project_join_requests, public.project_tasks, public.project_workspaces, public.project_members, public.projects,
  public.hackathon_banners, public.ambassador_applications
restart identity cascade;

do $$
declare
  t text;
  tables text[] := array[
    'posts','comments','reactions','follows','friend_requests','conversations','messages',
    'conversation_mutes','notifications','match_dismissals',
    'circles','circle_members','circle_posts','circle_post_comments',
    'circle_resources','circle_sessions','circle_announcements','circle_invites','circle_subscriptions',
    'projects','project_members','project_tasks','project_files','project_activity',
    'project_comments','project_applications','project_join_requests','project_workspaces',
    'gigs','gig_orders','gig_reviews','bounties',
    'resources','resource_purchases','study_requests',
    'hackathon_banners','ambassador_applications'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I add column tenant_id uuid not null references public.tenants(id)', t);
    execute format('create index %I on public.%I(tenant_id)', t || '_tenant_id_idx', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_tenant_id_from_user()',
      'stamp_tenant_' || t, t
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (tenant_id = public.current_tenant_id() or public.is_tenant_admin(tenant_id, auth.uid()))',
      t || '_select_same_tenant', t
    );
  end loop;
end $$;

drop policy if exists "Posts viewable by authenticated" on public.posts;
drop policy if exists "Comments viewable by authenticated" on public.comments;
drop policy if exists "Follows viewable by authenticated" on public.follows;
drop policy if exists "Bounties viewable by authenticated" on public.bounties;
drop policy if exists "Gigs viewable by authenticated" on public.gigs;
drop policy if exists "Circles viewable by authenticated" on public.circles;
drop policy if exists "Circle members viewable by authenticated" on public.circle_members;
drop policy if exists "Circle posts viewable by authenticated" on public.circle_posts;
drop policy if exists "Circle post comments viewable by authenticated" on public.circle_post_comments;
drop policy if exists "Circle resources viewable by authenticated" on public.circle_resources;
drop policy if exists "Circle sessions viewable by authenticated" on public.circle_sessions;
drop policy if exists "Announcements viewable by authenticated" on public.circle_announcements;
drop policy if exists "Authenticated can view invites" on public.circle_invites;
drop policy if exists "Project members viewable by authenticated" on public.project_members;
drop policy if exists "Banners viewable by authenticated" on public.hackathon_banners;
drop policy if exists "Reviews viewable by authenticated" on public.gig_reviews;

drop policy if exists "Profiles viewable by authenticated users" on public.profiles;
create policy "Profiles same-tenant or self" on public.profiles for select to authenticated
  using (id = auth.uid() or tenant_id is null or tenant_id = public.current_tenant_id());

insert into public.tenants (slug, name, country, email_domain, primary_color) values
  ('mit',       'Massachusetts Institute of Technology','United States','mit.edu',  '#8A1538'),
  ('ur-kigali', 'University of Rwanda',                 'Rwanda',       'ur.ac.rw', '#00A1DE'),
  ('makerere',  'Makerere University',                  'Uganda',       'mak.ac.ug','#00843D'),
  ('uct',       'University of Cape Town',              'South Africa', 'uct.ac.za','#003F87'),
  ('nus',       'National University of Singapore',     'Singapore',    'u.nus.edu','#EF7C00');
