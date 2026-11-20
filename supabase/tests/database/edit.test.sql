-- Editing until someone pays (decided 20 Nov 2026). Run with: npm run db:test
begin;
select plan(14);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Dinner: ₹3,000 for Rohan, Aisha and Kabir, shared.
create temp table k as
select * from public.create_kitty('moment', 'Dinner', current_date + 3, 300000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000},
    {"name": "Aisha", "share_paise": 100000}, {"name": "Kabir", "share_paise": 100000}]');
select public.share_kitty((select id from k));
create temp table ids as select id, name from public.members where kitty_id = (select id from k);

-- Raise to ₹4,000, drop Kabir, add Zoya. Aisha keeps her member row (and her claimed link).
create temp table edit as select jsonb_build_array(
  jsonb_build_object('id', (select id from ids where name = 'Rohan'), 'name', 'Rohan', 'is_organiser', true, 'share_paise', 150000),
  jsonb_build_object('id', (select id from ids where name = 'Aisha'), 'name', 'Aisha', 'share_paise', 150000),
  jsonb_build_object('name', 'Zoya', 'share_paise', 100000, 'share_fixed', true)
) as people;

select lives_ok($$ select public.update_kitty((select id from k), 'moment', 'Dinner out', current_date + 4, 400000, 'rohan@okicici', (select people from edit)) $$,
  'a shared kitty nobody has paid can be edited');
select is((select total_paise from public.kitties where id = (select id from k)), 400000::bigint, 'the new total is saved');
select is((select status::text from public.kitties where id = (select id from k)), 'shared', 'it stays shared, same link');
select is((select array_agg(name order by sort_order) from public.members where kitty_id = (select id from k)),
  array['Rohan', 'Aisha', 'Zoya'], 'people are updated, removed and added in order');
select is((select id from public.members where kitty_id = (select id from k) and name = 'Aisha'), (select id from ids where name = 'Aisha'),
  'people already in the kitty keep their row');
select is((
  select array_agg(m.name || ' ' || p.amount_paise || ' ' || p.status order by m.sort_order)
  from public.payments p join public.members m on m.id = p.member_id where p.kitty_id = (select id from k)
), array['Rohan 150000 confirmed', 'Aisha 150000 requested', 'Zoya 100000 requested'], 'payment requests are redone from the new shares');

select throws_ok($$ select public.update_kitty((select id from k), 'moment', 'Dinner', current_date + 4, 400000, 'rohan@okicici',
  (select people from edit) || '[{"id": "00000000-0000-4000-8000-000000000000", "name": "Ghost", "share_paise": 0}]') $$,
  '23514', 'someone in the list is not in this kitty', 'only people in this kitty can be updated');
select throws_ok($$ select public.update_kitty((select id from k), 'moment', 'Dinner', current_date + 4, 1, 'rohan@okicici', (select people from edit)) $$,
  '23514', null, 'the shares must still add up');

-- Scanning the bill while nobody has paid replaces the total and shares directly.
insert into public.bills (id, kitty_id, status, total_paise, extras_paise)
values ('b2220000-0000-4000-8000-000000000001', (select id from k), 'needs_review', 360000, 0);
insert into public.bill_lines (bill_id, label, amount_paise, category) values
  ('b2220000-0000-4000-8000-000000000001', 'Thali', 360000, 'veg');
select lives_ok($$ select public.apply_scanned_shares((select id from k), 'b2220000-0000-4000-8000-000000000001',
  (select jsonb_agg(jsonb_build_object('member_id', id, 'share_paise', 120000)) from public.members where kitty_id = (select id from k))) $$,
  'a scanned bill replaces the shares of a shared kitty nobody has paid');
select is((select total_paise || ' ' || amount_source from public.kitties where id = (select id from k)), '360000 scanned', 'the total comes from the bill');
select is((select count(*)::int from public.payments where kitty_id = (select id from k) and amount_paise = 120000), 3,
  'everyone is asked for their scanned share');

-- Once anyone pays, amounts lock.
update public.payments set status = 'marked'
where member_id = (select id from public.members where kitty_id = (select id from k) and name = 'Aisha');
select throws_ok($$ select public.update_kitty((select id from k), 'moment', 'Dinner', current_date + 4, 400000, 'rohan@okicici', (select people from edit)) $$,
  '23514', 'someone has already paid, so amounts are locked: use settle up', 'no edits once someone has paid');
select throws_ok($$ select public.apply_scanned_shares((select id from k), 'b2220000-0000-4000-8000-000000000001',
  (select jsonb_agg(jsonb_build_object('member_id', id, 'share_paise', 120000)) from public.members where kitty_id = (select id from k))) $$,
  '23514', 'someone has already paid, so use settle up for the bill', 'a scan goes through settle up once someone has paid');
select throws_ok($$ update public.members set share_paise = 1 where kitty_id = (select id from k) and name = 'Zoya' $$,
  '23514', 'shares are locked once someone has paid', 'the database lock still holds');

select * from finish();
rollback;
