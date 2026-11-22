-- Kitties without an amount or date (22 Nov 2026). Run with: npm run db:test
begin;
select plan(9);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

create temp table k as
select * from public.create_kitty('moment', 'Saturday dinner', null, 0, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 0}, {"name": "Kabir", "share_paise": 0}]');
grant select on k to authenticated;
select is((select status::text from k), 'draft', 'a kitty saves with no amount and no date, as a draft');
select is((select due_date from k), null, 'with no date');

select throws_ok($$ select public.share_kitty((select id from k)) $$, '23514',
  'add a total or scan the bill before sharing', 'it can''t be shared without an amount');

select lives_ok($$ select public.update_kitty((select id from k), 'moment', 'Saturday dinner', null, 300000, 'rohan@okicici',
  (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_organiser', is_organiser, 'share_paise', 150000)) from public.members where kitty_id = (select id from k))) $$,
  'the amount can be added later');
select throws_ok($$ select public.share_kitty((select id from k)) $$, '23514',
  'pick a pay by date before sharing', 'or without a date');

select lives_ok($$ select public.update_kitty((select id from k), 'moment', 'Saturday dinner', current_date + 3, 300000, 'rohan@okicici',
  (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_organiser', is_organiser, 'share_paise', 150000)) from public.members where kitty_id = (select id from k))) $$,
  'and the date');
select lives_ok($$ select public.share_kitty((select id from k)) $$, 'then it shares');

select throws_ok($$ select public.update_kitty((select id from k), 'moment', 'Saturday dinner', null, 300000, 'rohan@okicici',
  (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_organiser', is_organiser, 'share_paise', 150000)) from public.members where kitty_id = (select id from k))) $$,
  '23514', null, 'a shared kitty keeps its date');

select throws_ok($$ select public.create_kitty('goal', 'Goa', null, 0, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 0}, {"name": "Kabir", "share_paise": 0}]', 'parts', 3) $$,
  '23514', 'pick a pay by date to pay in parts', 'paying in parts needs a date');

select * from finish();
rollback;
