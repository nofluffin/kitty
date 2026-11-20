-- Archiving and shared groups (20 Nov 2026). Run with: npm run db:test
begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-4555-8555-555555555555', 'kabir@kitty.test', '{"name": "Kabir"}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

create temp table fam as
select * from public.save_group('Family', '[{"name": "Rohan", "is_me": true, "diet": "nonveg", "drinks": true},
  {"name": "Kabir", "phone": "+919800000002", "diet": "nonveg", "drinks": true},
  {"name": "Aarav", "diet": "veg", "paid_by_index": 1}]');
grant select on fam to authenticated;
select is((select string_agg(name || ':' || coalesce(paid_by_index::text, '-') || ':' || (profile_id is not null)::text, ',' order by sort_order)
  from public.group_members where group_id = (select id from fam)),
  'Rohan:-:true,Kabir:-:false,Aarav:1:false', 'the group keeps everyone, with Rohan marked as himself');
select is((select created_by_name from fam), 'Rohan', 'it remembers who made it');
select throws_ok($$ insert into public.groups (profile_id, name) values ('11111111-1111-4111-8111-111111111111', 'Sneaky') $$,
  '42501', null, 'groups are only made through save_group');
select throws_ok($$ select public.save_group('Alone', '[{"name": "Rohan", "is_me": true}]') $$, '23514',
  'add at least one other person to the group', 'a group needs someone besides you');

-- Kabir can't see it until he opens the share link.
set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';
select is((select count(*)::int from public.groups), 0, 'a group is private until shared');
select lives_ok(format($$ select public.join_group(%L) $$, (select share_token from fam)), 'the share link adds it');
select is((select count(*)::int from public.group_members where group_id = (select id from fam)), 3, 'Kabir now sees the group');

-- Rohan changes Family: a new group for him; Kabir keeps the old one.
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
create temp table fam2 as
select * from public.save_group('family', '[{"name": "Rohan", "is_me": true}, {"name": "Kabir"}, {"name": "Meera"}]');
select is((select count(*)::int from public.groups where lower(name) = 'family'), 1, 'Rohan swaps to his new Family');
select isnt((select id from fam2), (select id from fam), 'and it is a new group');

set local request.jwt.claims = '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}';
select is((select id from public.groups), (select id from fam), 'Kabir keeps the Family he was given');

update public.group_holders set favourite = true, last_used_at = now() where group_id = (select id from fam);
select is((select favourite from public.group_holders where group_id = (select id from fam)), true, 'Kabir can star a group he has');
select throws_ok($$ update public.group_holders set profile_id = '11111111-1111-4111-8111-111111111111' where group_id = (select id from fam) $$,
  '42501', null, 'but not hand it to someone else');

-- Kabir leaves: nobody holds the old Family, so it's deleted.
delete from public.group_holders where group_id = (select id from fam);
reset role;
select is((select count(*)::int from public.groups where id = (select id from fam)), 0, 'a group nobody holds is deleted');

-- Archiving
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';
create temp table k as
select * from public.create_kitty('moment', 'Old lunch', (now() at time zone 'Asia/Kolkata')::date, 200000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000}, {"name": "Kabir", "share_paise": 100000}]');
select public.share_kitty((select id from k));
update public.kitties set remind_on_day = true, archived_at = now() where id = (select id from k);
select isnt((select archived_at from public.kitties where id = (select id from k)), null, 'an organiser can archive a shared kitty');
reset role;
select private.queue_reminders();
select is((select count(*)::int from public.notifications where kitty_id = (select id from k)), 0, 'archived kitties send no reminders');

select * from finish();
rollback;
