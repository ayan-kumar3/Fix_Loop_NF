-- ---------------------------------------------------------------------------
-- FixLoop — optional demo seed for Supabase mode
--
-- Run AFTER supabase/migrations/0001_init.sql in the Supabase SQL editor.
--
-- What it creates:
--   • 4 field crews
--   • 9 demo sign-ins (1 admin, 4 field staff, 4 residents) — every password
--     is "demo1234"
--   • 12 issues across the full lifecycle (overdue, unassigned, breach,
--     pending verification, verified, reopened) with real timestamps
--   • work orders, issue events and notifications for those issues
--
-- All rows are flagged is_demo_data = true so the UI labels them.
-- The script aborts if profiles already exist, to avoid duplicate seeding.
-- ---------------------------------------------------------------------------

-- ---- Guard ---------------------------------------------------------------
-- pgcrypto provides crypt()/gen_salt() for the demo password hashes. Supabase
-- normally ships it, but make sure it's resolvable regardless.
create extension if not exists pgcrypto;

do $$
begin
  if exists (select 1 from public.profiles) then
    raise exception 'profiles table is not empty — skipping seed to avoid duplicates';
  end if;
end $$;

-- ---- Crews ---------------------------------------------------------------
insert into public.teams (id, name, specialty, member_count, lead_name) values
  ('t_san', 'Sanitation Crew',      'Waste collection & cleaning',   4, 'Mike Torres'),
  ('t_pub', 'Public Works',         'Roads, footpaths & structures', 6, 'Dana Liu'),
  ('t_wat', 'Water & Drainage',     'Supply lines & stormwater',     5, 'Omar Reyes'),
  ('t_lit', 'Electrical & Lighting','Streetlights & power',          3, 'Priya Nair')
on conflict (id) do nothing;

-- ---- Demo auth users -----------------------------------------------------
-- The handle_new_user trigger (installed by the migration) creates each
-- profiles row, picking up full_name/role from raw_user_meta_data.
do $$
declare
  pw text := crypt('demo1234', gen_salt('bf'));
  meta jsonb := '{"provider":"email","providers":["email"]}'::jsonb;
  users jsonb := '[
    {"email":"sarah.khan@fixloop.gov", "name":"Sarah Khan",   "role":"administrator"},
    {"email":"mike.torres@fixloop.gov","name":"Mike Torres",  "role":"field_staff", "team":"t_san"},
    {"email":"dana.liu@fixloop.gov",   "name":"Dana Liu",     "role":"field_staff", "team":"t_pub"},
    {"email":"omar.reyes@fixloop.gov", "name":"Omar Reyes",   "role":"field_staff", "team":"t_wat"},
    {"email":"priya.nair@fixloop.gov", "name":"Priya Nair",   "role":"field_staff", "team":"t_lit"},
    {"email":"aisha.patel@mail.com",   "name":"Aisha Patel",  "role":"resident"},
    {"email":"john.rivera@mail.com",   "name":"John Rivera",  "role":"resident"},
    {"email":"emily.chen@mail.com",    "name":"Emily Chen",   "role":"resident"},
    {"email":"david.okafor@mail.com",  "name":"David Okafor", "role":"resident"}
  ]'::jsonb;
  u jsonb;
  new_id uuid;
begin
  for u in select * from jsonb_array_elements(users) loop
    new_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      u->>'email', pw, now(), meta,
      jsonb_build_object('full_name', u->>'name', 'role', u->>'role'),
      now(), now()
    );

    -- Attach field staff to their crew.
    if u ? 'team' then
      update public.profiles set team_id = u->>'team' where id = new_id;
    end if;
  end loop;
end $$;

-- ---- Issues --------------------------------------------------------------
-- Timestamps are relative to now() so SLA states stay truthful:
--   • FX-1004 / FX-1005 are past SLA (overdue)
--   • FX-1006 is inside its last 25% of SLA (nearing breach)
--   • FX-1007..1009 are unassigned high-priority reports
do $$
declare
  adm uuid; mike uuid; dana uuid; omar uuid; priya uuid;
  aisha uuid; john uuid; emily uuid; david uuid;
  i_id uuid;
begin
  select id into adm    from public.profiles where email = 'sarah.khan@fixloop.gov';
  select id into mike   from public.profiles where email = 'mike.torres@fixloop.gov';
  select id into dana   from public.profiles where email = 'dana.liu@fixloop.gov';
  select id into omar   from public.profiles where email = 'omar.reyes@fixloop.gov';
  select id into priya  from public.profiles where email = 'priya.nair@fixloop.gov';
  select id into aisha  from public.profiles where email = 'aisha.patel@mail.com';
  select id into john   from public.profiles where email = 'john.rivera@mail.com';
  select id into emily  from public.profiles where email = 'emily.chen@mail.com';
  select id into david  from public.profiles where email = 'david.okafor@mail.com';

  insert into public.issues (
    public_id, title, description, category, priority, status,
    address, area, lat, lng, reporter_id, reporter_name,
    assigned_to_id, assigned_to_name, team_name,
    created_at, updated_at, assigned_at, sla_hours,
    resolution_note, resolved_at, is_demo_data
  ) values
  ('FX-1001','Garbage accumulation near Main Street market',
   'Large pile of uncollected garbage has built up beside the market entrance, blocking part of the walkway.',
   'Sanitation','Medium','submitted','Main St & 1st Ave','Market Quarter',28.6147,77.2094,
   aisha,'Aisha Patel',null,null,null, now() - interval '5 hours', now() - interval '5 hours', null, 48, null, null, true),

  ('FX-1002','Uncollected waste bags piling up — Main St',
   'Several black waste bags left uncollected near the corner shop since this morning.',
   'Sanitation','Medium','submitted','Main St & 2nd Ave','Market Quarter',28.6144,77.2091,
   john,'John Rivera',null,null,null, now() - interval '4 hours', now() - interval '4 hours', null, 48, null, null, true),

  ('FX-1003','Garbage bins overflowing on Main Street',
   'The public bins are overflowing and litter is scattering across the pavement.',
   'Sanitation','Medium','under_review','Main St & 1st Ave','Market Quarter',28.6148,77.2096,
   emily,'Emily Chen',null,null,null, now() - interval '3 hours', now() - interval '3 hours', null, 48, null, null, true),

  -- Overdue #1: Critical, 6h SLA, created 30h ago, still in progress.
  ('FX-1004','Blocked drainage culvert behind Block B',
   'Storm drain is completely blocked with silt and plastic. Water is backing up toward the residential entrance after every rain.',
   'Drainage','Critical','in_progress','Behind Residential Block B','North Block',28.6126,77.2076,
   david,'David Okafor',omar,'Omar Reyes','Water & Drainage',
   now() - interval '30 hours', now() - interval '28 hours', now() - interval '28 hours', 6, null, null, true),

  -- Overdue #2: High, 24h SLA, created 40h ago, still in progress.
  ('FX-1005','Damaged footpath slab — Market Quarter',
   'A raised and cracked slab creates a trip hazard right on the busy market footpath.',
   'Footpath','High','in_progress','Market Quarter footpath','Market Quarter',28.6152,77.2085,
   aisha,'Aisha Patel',dana,'Dana Liu','Public Works',
   now() - interval '40 hours', now() - interval '36 hours', now() - interval '36 hours', 24, null, null, true),

  -- Nearing breach: High, 24h SLA, created 20h ago (4h left = <25%).
  ('FX-1006','Water leakage at Block B tap line',
   'A joint has failed on the tap line and clean water is spraying out onto the path.',
   'Water Leakage','High','in_progress','Block B water tap line','North Block',28.6130,77.2080,
   aisha,'Aisha Patel',omar,'Omar Reyes','Water & Drainage',
   now() - interval '20 hours', now() - interval '18 hours', now() - interval '18 hours', 24, null, null, true),

  -- Three unassigned high-priority reports.
  ('FX-1007','Pothole near the main entrance gate',
   'Deep pothole formed where the tarmac has given way. Vehicles are swerving to avoid it.',
   'Roads','High','submitted','Main entrance gate','Central District',28.6156,77.2111,
   david,'David Okafor',null,null,null, now() - interval '6 hours', now() - interval '6 hours', null, 24, null, null, true),

  ('FX-1008','Broken streetlight near the parking area',
   'The lamp post has been hit and the light is out, leaving the corner dark at night.',
   'Street Lighting','High','submitted','Parking area, east corner','Parking Zone',28.6119,77.2116,
   aisha,'Aisha Patel',null,null,null, now() - interval '4 hours', now() - interval '4 hours', null, 24, null, null, true),

  ('FX-1009','Damaged public sign at crosswalk',
   'The pedestrian crossing sign has been bent flat and is no longer visible to drivers.',
   'Public Infrastructure','High','submitted','Crosswalk, Elm St','Central District',28.6149,77.2128,
   john,'John Rivera',null,null,null, now() - interval '8 hours', now() - interval '8 hours', null, 24, null, null, true),

  -- Awaiting community verification.
  ('FX-1010','Overflowing community dustbin — Riverside',
   'The bin by the riverside path was overflowing and litter was scattering onto the grass.',
   'Waste Management','Medium','resolved_pending_verification','Riverside path bin','Riverside',28.6140,77.2055,
   aisha,'Aisha Patel',mike,'Mike Torres','Sanitation Crew',
   now() - interval '40 hours', now() - interval '6 hours', now() - interval '30 hours', 48,
   'Bin emptied and an additional collection was scheduled for this spot. Area swept clean.',
   now() - interval '6 hours', true),

  -- Fully verified (closed loop).
  ('FX-1011','Pothole repaired on the service road',
   'A pothole had opened up on the service road near the north gate.',
   'Roads','Medium','verified_resolved','Service road, north gate','Central District',28.6154,77.2102,
   david,'David Okafor',dana,'Dana Liu','Public Works',
   now() - interval '70 hours', now() - interval '24 hours', now() - interval '60 hours', 48,
   'Pothole cleaned, filled and compacted. Road reopened.',
   now() - interval '30 hours', true),

  -- Disputed → reopened (flagged to admins).
  ('FX-1012','Garbage not cleared after claimed cleanup',
   'Residents report waste is still present after the cleanup was marked done.',
   'Sanitation','High','reopened','Main St side lane','Market Quarter',28.6146,77.2089,
   emily,'Emily Chen',mike,'Mike Torres','Sanitation Crew',
   now() - interval '12 hours', now() - interval '2 hours', now() - interval '10 hours', 24,
   'First pass completed.',
   null, true);

  -- ---- Work orders for assigned issues -----------------------------------
  insert into public.work_orders (issue_id, title, assigned_to_id, assigned_to_name, team_name, status, priority, due_at, created_at, acknowledged_at, notes)
  select i.id, i.title, i.assigned_to_id, i.assigned_to_name, i.team_name,
         case i.status
           when 'in_progress' then 'in_progress'::work_status
           when 'resolved_pending_verification' then 'submitted_for_verification'::work_status
           when 'verified_resolved' then 'completed'::work_status
           else 'acknowledged'::work_status
         end,
         i.priority, i.created_at + make_interval(hours => i.sla_hours), i.assigned_at, i.assigned_at,
         '[]'::jsonb
  from public.issues i
  where i.assigned_to_id is not null;

  -- ---- Issue events (timeline) -------------------------------------------
  insert into public.issue_events (issue_id, type, title, description, actor_id, actor_name, created_at)
  select id, 'created', 'Issue reported', 'Submitted through the resident reporting flow.',
         reporter_id, reporter_name, created_at
  from public.issues;

  insert into public.issue_events (issue_id, type, title, description, actor_id, actor_name, created_at)
  select id, 'assigned', 'Assigned to ' || assigned_to_name, 'Routed to ' || coalesce(team_name, 'field team'),
         adm, 'Sarah Khan', assigned_at
  from public.issues
  where assigned_to_id is not null and assigned_at is not null;

  insert into public.issue_events (issue_id, type, title, description, actor_id, actor_name, created_at)
  select id, 'status_changed', 'Status → ' || replace(status::text, '_', ' '), resolution_note,
         assigned_to_id, assigned_to_name, updated_at
  from public.issues
  where status in ('in_progress','resolved_pending_verification','verified_resolved','reopened');

  insert into public.issue_events (issue_id, type, title, description, actor_id, actor_name, created_at)
  select id, 'verification_submitted', 'Community confirmed resolved', 'Resolution confirmed by the community.',
         reporter_id, reporter_name, updated_at
  from public.issues
  where status = 'verified_resolved';

  insert into public.issue_events (issue_id, type, title, description, actor_id, actor_name, created_at)
  select id, 'reopened', 'Reopened — still not fixed', 'A resident disputed the reported fix.',
         reporter_id, reporter_name, updated_at
  from public.issues
  where status = 'reopened';

  -- ---- Notifications ------------------------------------------------------
  insert into public.notifications (user_id, title, body, kind, read, link_href, created_at)
  select assigned_to_id, 'New assignment',
         'You were assigned "' || title || '".', 'assignment', false, '/issues/' || id, assigned_at
  from public.issues
  where assigned_to_id is not null and assigned_at is not null;

  insert into public.notifications (user_id, title, body, kind, read, link_href, created_at)
  select null, 'Resolution awaiting verification',
         '"' || title || '" is ready for community confirmation.', 'verification', false, '/issues/' || id, updated_at
  from public.issues
  where status = 'resolved_pending_verification';

  insert into public.notifications (user_id, title, body, kind, read, link_href, created_at)
  select null, 'Resolution disputed',
         '"' || title || '" was reopened by the community.', 'alert', false, '/issues/' || id, updated_at
  from public.issues
  where status = 'reopened';
end $$;

-- ---- Confirmed duplicate group for the three Main Street reports ---------
insert into public.issue_groups (
  id, title, representative_issue_id, member_issue_ids,
  similarity, distance_meters, status, reason, created_at
)
select gen_random_uuid(),
       'Garbage accumulation — Main Street market',
       (select id from public.issues where public_id = 'FX-1001'),
       (select jsonb_agg(id) from public.issues where public_id in ('FX-1001','FX-1002','FX-1003')),
       0.72, 60, 'confirmed',
       'same category · similar wording · reported within ~2h of each other on the same block',
       now()
where not exists (select 1 from public.issue_groups);
