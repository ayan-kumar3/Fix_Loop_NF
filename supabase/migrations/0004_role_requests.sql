-- Public signup remains resident-only. Elevated role selections are stored as
-- requests and only an authenticated administrator can approve them.
create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_role user_role not null check (requested_role in ('field_staff', 'administrator')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create unique index if not exists role_requests_one_pending_per_user
  on public.role_requests(user_id) where status = 'pending';

-- A requested role is only a request. The auth trigger always persists the
-- account as a resident and records eligible elevated-role requests for review.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role_value text;
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'resident'
  )
  on conflict (id) do nothing;

  requested_role_value := new.raw_user_meta_data->>'requested_role';
  if requested_role_value in ('field_staff', 'administrator') then
    insert into public.role_requests (user_id, requested_role)
    values (new.id, requested_role_value::user_role)
    on conflict (user_id) where status = 'pending' do nothing;
  end if;
  return new;
end;
$$;

alter table public.role_requests enable row level security;

grant select, insert, update on public.role_requests to authenticated;

drop policy if exists "role_requests_admin_select" on public.role_requests;
create policy "role_requests_admin_select" on public.role_requests
  for select to authenticated using (is_admin());

drop policy if exists "role_requests_insert_own" on public.role_requests;
create policy "role_requests_insert_own" on public.role_requests
  for insert to authenticated
  with check (user_id = auth.uid() and requested_role in ('field_staff', 'administrator'));

drop policy if exists "role_requests_admin_update" on public.role_requests;
create policy "role_requests_admin_update" on public.role_requests
  for update to authenticated using (is_admin()) with check (is_admin());

create or replace function public.review_role_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_approve boolean
)
returns public.role_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.role_requests;
begin
  if auth.uid() is distinct from p_reviewer_id or not exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'administrator' and is_active
  ) then
    raise exception 'Only an authenticated administrator can review role requests.';
  end if;

  select * into request_row
  from public.role_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Role request not found.';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'This role request has already been reviewed.';
  end if;

  if p_approve then
    update public.profiles
    set role = request_row.requested_role
    where id = request_row.user_id;
  end if;

  update public.role_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id
  where id = p_request_id
  returning * into request_row;

  return request_row;
end;
$$;

revoke all on function public.review_role_request(uuid, uuid, boolean) from public;
grant execute on function public.review_role_request(uuid, uuid, boolean) to authenticated;
