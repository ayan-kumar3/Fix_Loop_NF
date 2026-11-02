-- Allow a signed-in user to recover a missing profile without granting roles.
drop policy if exists "profiles_insert_own_resident" on public.profiles;
create policy "profiles_insert_own_resident" on public.profiles
  for insert to authenticated
  with check (
    id = auth.uid()
    and role = 'resident'
    and is_active = true
  );
