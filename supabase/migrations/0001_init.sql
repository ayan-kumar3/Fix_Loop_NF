-- ---------------------------------------------------------------------------
-- FixLoop — initial Supabase (PostgreSQL) schema
--
-- Targets: UUID primary keys, foreign keys, validated enums, timestamps,
-- indexes for the hot query paths, and Row Level Security on every table.
--
-- Run inside the Supabase SQL editor, or via the Supabase CLI:
--   supabase db push
-- ---------------------------------------------------------------------------

-- ---- Enums ---------------------------------------------------------------
do $$ begin
  create type user_role as enum ('resident','field_staff','administrator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_category as enum (
    'Sanitation','Water Leakage','Roads','Street Lighting','Drainage',
    'Footpath','Public Infrastructure','Waste Management'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_priority as enum ('Critical','High','Medium','Low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type issue_status as enum (
    'submitted','under_review','assigned','in_progress',
    'resolved_pending_verification','verified_resolved','reopened','rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_status as enum (
    'unassigned','acknowledged','in_progress','submitted_for_verification','completed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type confidence_band as enum ('High','Medium','Low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verification_verdict as enum ('confirm_resolved','still_not_fixed');
exception when duplicate_object then null; end $$;

-- ---- Tables --------------------------------------------------------------
create table if not exists public.teams (
  id text primary key,
  name text not null,
  specialty text,
  member_count int default 0,
  lead_name text
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'resident',
  avatar_color text,
  team_id text references public.teams(id),
  phone text,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

-- RLS helpers must be created after the profiles table they query.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'administrator' from public.profiles where id = auth.uid()),
    false
  )
$$;

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  title text not null,
  description text not null,
  category issue_category not null,
  priority issue_priority not null default 'Medium',
  status issue_status not null default 'submitted',
  address text not null,
  area text,
  lat double precision not null,
  lng double precision not null,
  reporter_id uuid references public.profiles(id),
  reporter_name text,
  assigned_to_id uuid references public.profiles(id),
  assigned_to_name text,
  team_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  assigned_at timestamptz,
  sla_hours int not null default 48,
  resolution_note text,
  resolved_at timestamptz,
  is_demo_data boolean not null default false
);

create index if not exists issues_status_idx on public.issues (status);
create index if not exists issues_category_idx on public.issues (category);
create index if not exists issues_priority_idx on public.issues (priority);
create index if not exists issues_created_at_idx on public.issues (created_at desc);
create index if not exists issues_assigned_to_idx on public.issues (assigned_to_id);
create index if not exists issues_coords_idx on public.issues (lat, lng);

create table if not exists public.issue_media (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  url text not null,
  storage_path text,
  caption text,
  is_evidence boolean not null default false,
  kind text not null default 'before',
  uploaded_at timestamptz not null default now()
);
create index if not exists issue_media_issue_idx on public.issue_media (issue_id);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  model text,
  suggested_category issue_category,
  summary text,
  suggested_priority issue_priority,
  reason text,
  confidence_band confidence_band,
  needs_review boolean not null default false,
  safety_note text,
  created_at timestamptz not null default now()
);
create index if not exists ai_analyses_issue_idx on public.ai_analyses (issue_id);

create table if not exists public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  type text not null,
  title text not null,
  description text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now(),
  meta jsonb
);
create index if not exists issue_events_issue_idx on public.issue_events (issue_id, created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  author_name text,
  author_role text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_issue_idx on public.comments (issue_id, created_at desc);

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  title text,
  assigned_to_id uuid references public.profiles(id),
  assigned_to_name text,
  team_name text,
  status work_status not null default 'unassigned',
  priority issue_priority not null default 'Medium',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  notes jsonb not null default '[]'::jsonb
);
create index if not exists work_orders_issue_idx on public.work_orders (issue_id);
create index if not exists work_orders_assignee_idx on public.work_orders (assigned_to_id);

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  verifier_id uuid references public.profiles(id),
  verifier_name text,
  verdict verification_verdict not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists verifications_issue_idx on public.verifications (issue_id);

create table if not exists public.issue_groups (
  id uuid primary key default gen_random_uuid(),
  title text,
  representative_issue_id uuid references public.issues(id) on delete set null,
  member_issue_ids jsonb not null default '[]'::jsonb,
  similarity double precision,
  distance_meters double precision,
  status text not null default 'suggested',
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  kind text not null default 'system',
  read boolean not null default false,
  link_href text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---- Row Level Security --------------------------------------------------
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.issues enable row level security;
alter table public.issue_media enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.issue_events enable row level security;
alter table public.comments enable row level security;
alter table public.work_orders enable row level security;
alter table public.verifications enable row level security;
alter table public.issue_groups enable row level security;
alter table public.notifications enable row level security;

-- Profiles: readable by any signed-in user; users update their own row; admins manage all.
create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));
create policy "profiles_admin_update" on public.profiles for update to authenticated using (is_admin());

-- Teams: readable by signed-in users.
create policy "teams_select_auth" on public.teams for select to authenticated using (true);
create policy "teams_admin_write" on public.teams for all to authenticated using (is_admin());

-- Issues: readable by signed-in users. Writes go through the service role from
-- route handlers (which enforce lifecycle + roles), so we only allow owners /
-- admins minimal direct writes here.
create policy "issues_select_auth" on public.issues for select to authenticated using (true);
create policy "issues_insert_auth" on public.issues for insert to authenticated with check (reporter_id = auth.uid());
create policy "issues_update_admin" on public.issues for update to authenticated using (is_admin());

-- Media / analyses / events / comments / verifications / groups: readable by
-- signed-in users; writes happen via the service role in route handlers.
create policy "media_select_auth" on public.issue_media for select to authenticated using (true);
create policy "analyses_select_auth" on public.ai_analyses for select to authenticated using (true);
create policy "events_select_auth" on public.issue_events for select to authenticated using (true);
create policy "comments_select_auth" on public.comments for select to authenticated using (true);
create policy "comments_insert_auth" on public.comments for insert to authenticated with check (true);
create policy "work_orders_select_auth" on public.work_orders for select to authenticated using (true);
create policy "verifications_select_auth" on public.verifications for select to authenticated using (true);
create policy "verifications_insert_auth" on public.verifications for insert to authenticated with check (verifier_id = auth.uid());
create policy "groups_select_auth" on public.issue_groups for select to authenticated using (true);

-- Notifications: users read their own (or broadcast where user_id is null).
create policy "notifications_select_own" on public.notifications for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy "notifications_update_own" on public.notifications for update to authenticated
  using (user_id = auth.uid());

-- ---- Trigger: keep profiles in sync with auth.users ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'resident')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- updated_at maintenance ---------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists issues_touch on public.issues;
create trigger issues_touch before update on public.issues
  for each row execute function public.touch_updated_at();
