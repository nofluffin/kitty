-- Paying for someone else (decided 20 Nov 2026). Run with: npm run db:test
begin;
select plan(12);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Dinner ₹3,500: Kabir pays for his son Aarav (place 2 in the list pays for place 3).
create temp table k as
select * from public.create_kitty('moment', 'Family dinner', current_date + 3, 350000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000},
    {"name": "Kabir", "share_paise": 100000},
    {"name": "Aarav", "diet": "veg", "drinks": false, "share_paise": 50000, "paid_by_index": 1},
    {"name": "Zoya", "share_paise": 100000}]');
create temp table ids as select id, name from public.members where kitty_id = (select id from k);

select is((select paid_by_member_id from public.members where id = (select id from ids where name = 'Aarav')),
  (select id from ids where name = 'Kabir'), 'Aarav is paid for by Kabir');

select throws_ok($$ select public.create_kitty('moment', 'Chain', current_date + 3, 300000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000},
    {"name": "Kabir", "share_paise": 100000, "paid_by_index": 2},
    {"name": "Aarav", "share_paise": 100000, "paid_by_index": 1}]') $$,
  '23514', 'someone who pays for others must pay for themselves', 'no chains of paying for each other');
select throws_ok($$ select public.create_kitty('moment', 'Organiser', current_date + 3, 200000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000, "paid_by_index": 1}, {"name": "Kabir", "share_paise": 100000}]') $$,
  '23514', 'someone who pays for others must pay for themselves', 'nobody pays for the organiser');
select throws_ok($$ update public.members set paid_by_member_id = (select id from ids where name = 'Aarav')
  where id = (select id from ids where name = 'Zoya') $$,
  '23514', 'someone who pays for others must pay for themselves', 'the database refuses a chain too');

select public.share_kitty((select id from k));
select is((
  select array_agg(m.name || ' ' || p.amount_paise order by m.sort_order)
  from public.payments p join public.members m on m.id = p.member_id where p.kitty_id = (select id from k)
), array['Rohan 100000', 'Kabir 150000', 'Zoya 100000'], 'Kabir is asked for his share and Aarav''s; Aarav for nothing');

-- Edit: Aarav pays for himself after all.
select lives_ok($$ select public.update_kitty((select id from k), 'moment', 'Family dinner', current_date + 3, 350000, 'rohan@okicici',
  (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'is_organiser', name = 'Rohan',
     'share_paise', case name when 'Aarav' then 50000 else 100000 end) order by name = 'Aarav', name) from ids)) $$,
  'who pays for whom can be edited until someone pays');
select is((select count(*)::int from public.payments where kitty_id = (select id from k)), 4, 'now everyone is asked for their own share');

-- And back to Kabir paying, keeping the order Rohan, Kabir, Aarav, Zoya.
select public.update_kitty((select id from k), 'moment', 'Family dinner', current_date + 3, 350000, 'rohan@okicici',
  jsonb_build_array(
    jsonb_build_object('id', (select id from ids where name = 'Rohan'), 'name', 'Rohan', 'is_organiser', true, 'share_paise', 100000),
    jsonb_build_object('id', (select id from ids where name = 'Kabir'), 'name', 'Kabir', 'share_paise', 100000),
    jsonb_build_object('id', (select id from ids where name = 'Aarav'), 'name', 'Aarav', 'share_paise', 50000, 'paid_by_index', 1),
    jsonb_build_object('id', (select id from ids where name = 'Zoya'), 'name', 'Zoya', 'share_paise', 100000)));
select is((select amount_paise from public.payments where member_id = (select id from ids where name = 'Kabir')), 150000::bigint,
  'Kabir pays for Aarav again');

-- Kabir pays; now who pays for whom is locked.
update public.payments set status = 'confirmed' where member_id = (select id from ids where name = 'Kabir');
select throws_ok($$ update public.members set paid_by_member_id = null where id = (select id from ids where name = 'Aarav') $$,
  '23514', 'shares are locked once someone has paid', 'who pays for whom locks once someone has paid');

-- Settle up at ₹3,500 with new shares: Kabir and Aarav come to ₹1,800, Kabir paid ₹1,500.
select lives_ok($$ select public.settle_kitty((select id from k), 350000, jsonb_build_array(
  jsonb_build_object('member_id', (select id from ids where name = 'Rohan'), 'share_paise', 100000),
  jsonb_build_object('member_id', (select id from ids where name = 'Kabir'), 'share_paise', 120000),
  jsonb_build_object('member_id', (select id from ids where name = 'Aarav'), 'share_paise', 60000),
  jsonb_build_object('member_id', (select id from ids where name = 'Zoya'), 'share_paise', 70000))) $$, 'settle up works');
select is((
  select array_agg(m.name || ' ' || p.kind || ' ' || p.amount_paise order by m.sort_order)
  from public.payments p join public.members m on m.id = p.member_id
  where p.kitty_id = (select id from k) and p.kind in ('topup', 'refund')
), array['Kabir topup 30000', 'Zoya topup 70000'], 'Kabir tops up for himself and Aarav together');
select is((select count(*)::int from public.payments where member_id = (select id from ids where name = 'Aarav')), 0,
  'Aarav is never asked for money');

select * from finish();
rollback;
