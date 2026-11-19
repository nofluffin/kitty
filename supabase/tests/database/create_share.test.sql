-- create_kitty and share_kitty (step 4). Run with: npm run db:test
begin;
select plan(15);

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

-- ₹1,000 across Rohan and two friends, with leftover paise on the first person.
create temp table made as
select * from public.create_kitty(
  'moment', '  Cab home ', current_date + 2, 100000, ' Rohan@OKICICI ',
  '[{"name": "Rohan", "is_organiser": true, "diet": "nonveg", "drinks": true, "share_paise": 33334},
    {"name": "Kabir", "phone": "+919800000002", "share_paise": 33333},
    {"name": "Zoya", "share_paise": 33333, "share_fixed": true}]'
);

select is((select status::text from made), 'draft', 'a new kitty is a draft');
select is((select title from made), 'Cab home', 'the name is trimmed');
select is((select upi_id from made), 'rohan@okicici', 'the UPI ID is trimmed and lower case');
select is(
  (select array_agg(name order by sort_order) from public.members where kitty_id = (select id from made)),
  array['Rohan', 'Kabir', 'Zoya'], 'people keep their order');
select is((select share_fixed from public.members where kitty_id = (select id from made) and name = 'Zoya'), true,
  'typed amounts stay marked as fixed');
select is((select upi_id from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'rohan@okicici',
  'the UPI ID is remembered for next time');

select throws_ok(
  $$ select public.create_kitty('moment', 'Bad', current_date + 2, 100000, 'rohan@okicici',
       '[{"name": "Rohan", "is_organiser": true, "share_paise": 50000}, {"name": "Kabir", "share_paise": 49999}]') $$,
  '23514', 'shares add up to 99999 paise but the total is 100000 paise', 'shares must add up to the total exactly');

select throws_ok(
  $$ select public.create_kitty('moment', 'Alone', current_date + 2, 100000, 'rohan@okicici',
       '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000}]') $$,
  '23514', 'add at least one other person', 'a kitty needs someone other than the organiser');

select throws_ok(
  $$ select public.create_kitty('moment', 'Old', current_date - 5, 100000, 'rohan@okicici',
       '[{"name": "Kabir", "share_paise": 100000}]') $$,
  '23514', 'the pay by date is in the past', 'the pay by date cannot be in the past');

select throws_ok(
  $$ select public.create_kitty('moment', 'Typo', current_date + 2, 100000, 'rohan',
       '[{"name": "Kabir", "share_paise": 100000}]') $$,
  '23514', 'that does not look like a UPI ID', 'the UPI ID is checked');

-- Sharing
select is(public.share_kitty((select id from made)), (select share_slug from made), 'sharing returns the link slug');
select is((select status::text from public.kitties where id = (select id from made)), 'shared', 'sharing locks the kitty');
select is(
  (select count(*)::int from public.payments where kitty_id = (select id from made) and kind = 'share' and status = 'requested'),
  2, 'everyone else is asked to pay');
select is(
  (select p.status::text from public.payments p join public.members m on m.id = p.member_id
   where m.kitty_id = (select id from made) and m.is_organiser), 'confirmed',
  'the organiser''s own share is confirmed automatically');
select is(public.share_kitty((select id from made)), (select share_slug from made),
  'sharing twice is safe and returns the same slug');

select * from finish();
rollback;
