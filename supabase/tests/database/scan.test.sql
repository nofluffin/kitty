-- Scanning before sharing (step 8): a draft with no total, then apply_scanned_shares.
begin;
select plan(9);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- "Have the bill already? Scan it" saves the draft first, with no total yet.
create temp table k as
select * from public.create_kitty('moment', 'Scan first', current_date + 2, 0, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "diet": "nonveg", "drinks": true, "share_paise": 0},
    {"name": "Aisha", "share_paise": 0}]');
select is((select total_paise from k), 0::bigint, 'a draft can be saved with no total while the bill is scanned');

select throws_ok($$ select public.share_kitty((select id from k)) $$, '23514',
  'add a total or scan the bill before sharing', 'a kitty with no total cannot be shared');

-- A scanned bill: ₹400 veg, ₹600 non-veg, ₹100 extras.
insert into public.bills (id, kitty_id, status, total_paise, extras_paise)
values ('b1110000-0000-4000-8000-000000000001', (select id from k), 'needs_review', 110000, 10000);
insert into public.bill_lines (bill_id, label, amount_paise, category) values
  ('b1110000-0000-4000-8000-000000000001', 'Dal', 40000, 'veg'),
  ('b1110000-0000-4000-8000-000000000001', 'Kebab', 60000, 'unsure');

create temp table s as
select jsonb_agg(jsonb_build_object('member_id', id, 'share_paise', case when is_organiser then 88000 else 22000 end)) as shares
from public.members where kitty_id = (select id from k);

select throws_ok($$ select public.apply_scanned_shares((select id from k), 'b1110000-0000-4000-8000-000000000001', (select shares from s)) $$,
  '23514', 'sort the unsure lines first', 'unsure lines block the shares (screen 10)');

update public.bill_lines set category = 'nonveg' where label = 'Kebab';

select throws_ok($$ select public.apply_scanned_shares((select id from k), 'b1110000-0000-4000-8000-000000000001',
  (select jsonb_agg(jsonb_set(e, '{share_paise}', '1')) from jsonb_array_elements((select shares from s)) e)) $$,
  '23514', null, 'shares must add up to the bill');

select lives_ok($$ select public.apply_scanned_shares((select id from k), 'b1110000-0000-4000-8000-000000000001', (select shares from s)) $$,
  'scanned shares apply to the draft');
select is((select total_paise from public.kitties where id = (select id from k)), 110000::bigint, 'the total comes from the bill');
select is((select amount_source::text from public.kitties where id = (select id from k)), 'scanned', 'the kitty remembers it was scanned');
select is((select status::text from public.bills where id = 'b1110000-0000-4000-8000-000000000001'), 'confirmed', 'the bill is confirmed');
select lives_ok($$ select public.share_kitty((select id from k)) $$, 'and now it can be shared');

select * from finish();
rollback;
