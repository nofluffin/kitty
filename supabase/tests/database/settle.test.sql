-- settle_kitty and close_kitty (step 7), using screen 13's numbers. Run with: npm run db:test
begin;
select plan(16);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- Friday dinner again: ₹6,000 across six, ₹1,000 each.
create temp table k as
select * from public.create_kitty('moment', 'Settle test', current_date + 2, 600000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000},
    {"name": "Kabir", "share_paise": 100000}, {"name": "Dev", "share_paise": 100000},
    {"name": "Zoya", "share_paise": 100000}, {"name": "Aisha", "share_paise": 100000},
    {"name": "Meera", "share_paise": 100000}]');
select public.share_kitty((select id from k));
create temp table m as select name, id from public.members where kitty_id = (select id from k);

-- Kabir, Dev, Aisha and Meera paid and were confirmed. Zoya never paid. Dev's is still waiting.
update public.payments set status = 'confirmed'
where member_id in (select id from m where name in ('Kabir', 'Aisha', 'Meera'));
update public.payments set status = 'marked' where member_id = (select id from m where name = 'Dev');

create temp table final as
select jsonb_agg(jsonb_build_object('member_id', id, 'share_paise',
  case name when 'Zoya' then 85000 when 'Aisha' then 40000 when 'Meera' then 40000 else 125000 end)) as shares
from m;

select throws_ok(
  $$ select public.settle_kitty((select id from k), 540000, (select shares from final)) $$,
  '23514', 'confirm the 1 payment(s) people have marked as paid first',
  'settle up waits until marked payments are confirmed');

update public.payments set status = 'confirmed' where member_id = (select id from m where name = 'Dev');

select throws_ok(
  $$ select public.settle_kitty((select id from k), 550000, (select shares from final)) $$,
  '23514', 'new shares add up to 540000 paise but the final bill is 550000 paise',
  'new shares must add up to the final bill');

select throws_ok(
  $$ select public.settle_kitty((select id from k), 540000, (select shares - 0 from final)) $$,
  '23514', null, 'every person needs a new share');

select lives_ok(
  $$ select public.settle_kitty((select id from k), 540000, (select shares from final)) $$,
  'settle up with a ₹5,400 final bill');

select is((select status::text from public.kitties where id = (select id from k)), 'settling', 'the kitty is settling');
select is((select final_bill_paise from public.kitties where id = (select id from k)), 540000::bigint, 'the final bill is stored');
select is((select final_share_paise from public.members where id = (select id from m where name = 'Zoya')), 85000::bigint,
  'new shares are stored');

-- Screen 13's actions
select is((select amount_paise from public.payments where member_id = (select id from m where name = 'Zoya') and kind = 'topup'),
  85000::bigint, 'Zoya never paid, so she owes her whole new share');
select is((select status::text from public.payments where member_id = (select id from m where name = 'Zoya') and kind = 'share'),
  'written_off', 'her original request is written off, not deleted');
select is((select amount_paise from public.payments where member_id = (select id from m where name = 'Kabir') and kind = 'topup'),
  25000::bigint, 'Kabir tops up ₹250');
select is((select amount_paise || ' ' || direction from public.payments
           where member_id = (select id from m where name = 'Aisha') and kind = 'refund'),
  '60000 out', 'Aisha gets ₹600 back');
select is((select count(*)::int from public.payments where member_id = (select id from m where name = 'Rohan') and kind in ('topup', 'refund')),
  0, 'the organiser never tops up or refunds themselves');

-- Closing
select throws_ok(
  $$ select public.close_kitty((select id from k)) $$,
  '23514', '5 payment(s) still open: settle them or close and write them off',
  'cannot close while people still owe or are owed');

update public.payments set status = 'confirmed'
where kitty_id = (select id from k) and kind in ('topup', 'refund') and member_id <> (select id from m where name = 'Zoya');

select lives_ok($$ select public.close_kitty((select id from k), true) $$, 'close anyway and write off what is left');
select is((select status::text from public.payments where member_id = (select id from m where name = 'Zoya') and kind = 'topup'),
  'written_off', 'Zoya''s ₹850 is written off');
select isnt((select closed_at from public.kitties where id = (select id from k)), null, 'closing stamps closed_at');

select * from finish();
rollback;
