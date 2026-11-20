-- Archiving and saved groups (20 Nov 2026). Run with: npm run db:test
begin;
select plan(7);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select lives_ok($$ select public.save_group('Family', '[{"name": "Kabir", "phone": "+919800000002", "diet": "nonveg", "drinks": true},
  {"name": "Aarav", "diet": "veg", "paid_by_index": 0}]') $$, 'a group saves');
select is((select string_agg(name || ':' || coalesce(paid_by_index::text, '-'), ',' order by sort_order) from public.group_members),
  'Kabir:-,Aarav:0', 'people keep their order and who pays for whom');
select public.save_group(' family ', '[{"name": "Kabir"}]');
select is((select count(*)::int from public.groups where lower(name) = 'family'), 1, 'saving with the same name replaces the group');
select is((select count(*)::int from public.group_members), 1, 'and its people');

-- Another organiser sees nothing.
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select is((select count(*)::int from public.groups), 0, 'groups are private to their organiser');

-- Archiving
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
