-- The first administrator can be bootstrapped by the server using its private
-- service-role key. Public signup can never invoke this function directly.
create or replace function public.bootstrap_first_administrator(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted server can bootstrap the first administrator.';
  end if;

  perform pg_advisory_xact_lock(640018942, 1);

  if exists (
    select 1
    from public.profiles
    where role = 'administrator' and is_active = true
  ) then
    raise exception 'This workspace already has an active administrator.';
  end if;

  update public.profiles
  set role = 'administrator'
  where id = p_user_id
    and role = 'resident'
    and is_active = true;

  if not found then
    raise exception 'The new user profile could not be promoted.';
  end if;
end;
$$;

revoke all on function public.bootstrap_first_administrator(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_first_administrator(uuid) to service_role;
