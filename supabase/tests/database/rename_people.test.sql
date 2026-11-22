-- Renaming someone in a group (22 Nov 2026): the new name reaches your other groups and your
-- kitties where nobody has paid yet. Run with: npm run db:test
begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-4555-8555-555555555555', 'kabir@kitty.test', '{"name": "Kabir"}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Two groups of Rohan's with Kabir (with a number) and Aarav (without one).
create temp table office as select * from public.save_group('Office', '[{"name": "Rohan", "is_me": true},
  {"name": "Kabir", "phone": "+919800000002"}, {"name": "Aarav"}]');
create temp table gym as select * from public.save_group('Gym', '[{"name": "Rohan", "is_me": true},
  {"name": "Kabir", "phone": "+919800000002"}, {"name": "aarav "}]');
grant select on office, gym to authenticated;

-- Kitties: a draft, one shared that nobody has paid, and one Kabir has paid into.
create temp table lunch as select * from public.create_kitty('moment', 'Lunch', current_date + 3, 30000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Kabir", "phone": "+919800000002", "share_paise": 10000}, {"name": "Aarav", "share_paise": 10000}]');
create temp table movie as select * from public.create_kitty('moment', 'Movie', current_date + 3, 20000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Aarav", "share_paise": 10000}]');
create temp table dinner as select * from public.create_kitty('moment', 'Dinner', current_date + 3, 20000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Kabir", "phone": "+919800000002", "share_paise": 10000}]');
grant select on lunch, movie, dinner to authenticated;
select public.share_kitty((select id from movie));
select public.share_kitty((select id from dinner));
update public.payments set status = 'marked'
where member_id = (select id from public.members where kitty_id = (select id from dinner) and name = 'Kabir');

-- Kabir opens Gym's share link, so Gym is no longer Rohan's alone.
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';
select public.join_group((select share_token from gym));
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is(
  public.rename_people('[{"old_name": "Kabir", "phone": "+919800000002", "new_name": "Kabir Mehta"}, {"old_name": "Aarav", "new_name": " Aarav Rana "}]'),
  '{"group_people": 2, "kitty_people": 3}'::jsonb,
  'says how many copies changed');
select is((select string_agg(name, ',' order by sort_order) from public.group_members where group_id = (select id from office)),
  'Rohan,Kabir Mehta,Aarav Rana', 'Rohan''s own group gets both new names');
select is((select string_agg(name, ',' order by sort_order) from public.group_members where group_id = (select id from gym)),
  'Rohan,Kabir,aarav', 'a group someone else also holds is left alone');
select is((select string_agg(name, ',' order by sort_order) from public.members where kitty_id = (select id from lunch)),
  'Rohan,Kabir Mehta,Aarav Rana', 'a draft kitty gets the new names');
select is((select string_agg(name, ',' order by sort_order) from public.members where kitty_id = (select id from movie)),
  'Rohan,Aarav Rana', 'a shared kitty nobody has paid gets it, matched by name without a number');
select is((select string_agg(name, ',' order by sort_order) from public.members where kitty_id = (select id from dinner)),
  'Rohan,Kabir', 'a kitty someone has paid into keeps the old name');

select is(public.rename_people('[{"old_name": "Aarav Rana", "new_name": "Aarav Rana"}]'), '{"group_people": 0, "kitty_people": 0}'::jsonb,
  'the same name changes nothing');
select throws_ok($$ select public.rename_people(jsonb_build_array(jsonb_build_object('old_name', 'Kabir Mehta', 'phone', '+919800000002', 'new_name', repeat('x', 81)))) $$,
  '22023', 'names are 80 characters at most', 'names stay within 80 characters');

-- Someone else's kitties are never touched.
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';
select is(public.rename_people('[{"old_name": "Kabir Mehta", "phone": "+919800000002", "new_name": "Mr K"}]'), '{"group_people": 0, "kitty_people": 0}'::jsonb,
  'another organiser can''t rename people in Rohan''s kitties or groups');

reset role;
set local role anon;
select throws_ok($$ select public.rename_people('[]') $$, '42501', null, 'logged out, it can''t be called');

select * from finish();
rollback;
