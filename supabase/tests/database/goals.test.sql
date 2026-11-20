-- Goal kitties (step 9): one payment, or monthly parts. Run with: npm run db:test
begin;
select plan(14);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Goa trip: ₹100.01 between Rohan and Aisha, in 3 monthly parts, the last two months from today.
create temp table due as select (current_date + interval '2 months')::date as d;
create temp table goa as
select * from public.create_kitty('goal', 'Goa trip', (select d from due), 20002, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10001}, {"name": "Aisha", "share_paise": 10001}]',
  'parts', 3);
select is((select goal_plan::text || ' ' || parts_count from goa), 'parts 3', 'a goal remembers its plan');

select throws_ok($$ select public.create_kitty('goal', 'Too soon', current_date + 20, 20000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Aisha", "share_paise": 10000}]', 'parts', 3) $$,
  '23514', 'the first part would be due before today: pick fewer parts or a later date', 'parts must all fall on or after today');
select throws_ok($$ select public.create_kitty('goal', 'One part', current_date + 60, 20000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Aisha", "share_paise": 10000}]', 'parts', 1) $$,
  '23514', 'pay in 2 to 24 parts', 'parts means at least two');
select throws_ok($$ select public.create_kitty('moment', 'Dinner', current_date + 2, 20000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Aisha", "share_paise": 10000}]', 'parts', 2) $$,
  '23514', 'only goals are paid in parts', 'moments are never in parts');
select throws_ok($$ select public.create_kitty('goal', 'No target', current_date + 60, 0, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 0}, {"name": "Aisha", "share_paise": 0}]') $$,
  '23514', 'give the goal a target', 'a goal needs a target');

select lives_ok($$ select public.share_kitty((select id from goa)) $$, 'a goal in parts can be shared');

create temp table aisha as
select p.* from public.payments p join public.members m on m.id = p.member_id
where m.kitty_id = (select id from goa) and m.name = 'Aisha';

select is((select count(*)::int from aisha), 3, 'each member gets one payment per part');
select is((select array_agg(amount_paise order by due_date) from aisha), array[3333, 3333, 3335]::bigint[],
  'equal parts, leftover paise on the last (as goalParts)');
select is((select array_agg(due_date order by due_date) from aisha),
  array[current_date, (current_date + interval '1 month')::date, (select d from due)],
  'one a month, the last on the pay by date');
select is((select bool_and(kind = 'part' and status = 'requested') from aisha), true, 'parts start as requested');
select is((
  select array_agg(distinct p.status::text) from public.payments p join public.members m on m.id = p.member_id
  where m.kitty_id = (select id from goa) and m.is_organiser
), array['confirmed'], 'the organiser''s own parts are confirmed');

-- A goal paid in one go works like a moment.
create temp table gift as
select * from public.create_kitty('goal', 'Gift', current_date + 30, 20000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 10000}, {"name": "Aisha", "share_paise": 10000}]', 'single');
select is((select goal_plan::text || coalesce(parts_count::text, '-') from gift), 'single-', 'a single-payment goal has no parts');
select public.share_kitty((select id from gift));
select is((
  select array_agg(p.kind::text || ' ' || p.amount_paise) from public.payments p join public.members m on m.id = p.member_id
  where m.kitty_id = (select id from gift) and not m.is_organiser
), array['share 10000'], 'one share payment each');

-- Parts are locked once someone has paid, like every amount.
update public.payments set status = 'marked' where id = (select id from aisha order by due_date limit 1);
select throws_ok($$ update public.kitties set parts_count = 2 where id = (select id from goa) $$,
  '23514', 'amounts are locked once someone has paid', 'the number of parts is locked once someone has paid');

select * from finish();
rollback;
