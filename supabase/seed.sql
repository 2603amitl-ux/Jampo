-- Demo seed data: 1 manager + 3 employees + a starter weekly preset.
-- Run only against a local/dev Supabase project (`supabase db reset` runs
-- this automatically). Every seeded user's password is: Jampo1234!
--
-- Employees log in with a username; the app maps that username to the
-- synthetic email "{username}@jampo.internal" before calling Supabase Auth.

do $$
declare
  manager_id uuid := gen_random_uuid();
  emp1_id uuid := gen_random_uuid();
  emp2_id uuid := gen_random_uuid();
  emp3_id uuid := gen_random_uuid();
  demo_password text := 'Jampo1234!';
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values
    (manager_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@jampo.internal', crypt(demo_password, gen_salt('bf')), now(), now(), now(),
     '{"provider":"username","providers":["username"],"role":"manager"}', '{}'),
    (emp1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'dana@jampo.internal', crypt(demo_password, gen_salt('bf')), now(), now(), now(),
     '{"provider":"username","providers":["username"],"role":"employee"}', '{}'),
    (emp2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'yossi@jampo.internal', crypt(demo_password, gen_salt('bf')), now(), now(), now(),
     '{"provider":"username","providers":["username"],"role":"employee"}', '{}'),
    (emp3_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'maya@jampo.internal', crypt(demo_password, gen_salt('bf')), now(), now(), now(),
     '{"provider":"username","providers":["username"],"role":"employee"}', '{}');

  -- Supabase Auth requires a matching auth.identities row per login
  -- provider, or password sign-in fails with "Database error querying
  -- schema" — the Admin API creates this automatically; a raw SQL insert
  -- into auth.users does not.
  insert into auth.identities (user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
  from auth.users
  where id in (manager_id, emp1_id, emp2_id, emp3_id);

  insert into employees (id, full_name, username, role, certifications, priority, active) values
    (manager_id, 'מנהל המקום', 'admin', 'manager', '{}', 0, true),
    (emp1_id, 'דנה כהן', 'dana', 'employee', ARRAY['כללי','באנג''י']::certification[], 10, true),
    (emp2_id, 'יוסי לוי', 'yossi', 'employee', ARRAY['כללי','טרקטורון']::certification[], 7, true),
    (emp3_id, 'מאיה ישראלי', 'maya', 'employee', ARRAY['כללי']::certification[], 5, true);
end $$;

-- Starter weekly preset: 3 shifts a day, every day of the week.
insert into shift_presets (day_of_week, shift_name, start_time, end_time, base_headcount, required_certifications)
select d.day, s.shift_name, s.start_time, s.end_time, s.base_headcount, s.required_certifications
from generate_series(0, 6) as d (day)
cross join (
  values
    ('בוקר', time '09:00', time '13:00', 2, ARRAY['כללי']::certification[]),
    ('צהריים', time '13:00', time '17:00', 3, ARRAY['כללי']::certification[]),
    ('ערב', time '17:00', time '21:00', 2, ARRAY['כללי', 'באנג''י']::certification[])
) as s (shift_name, start_time, end_time, base_headcount, required_certifications);
