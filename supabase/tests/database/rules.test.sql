-- Database rules: row level security, the share lock and status moves.
-- Run with: npm run db:test
begin;
select plan(22);

-- A second organiser, Priya, with a draft kitty of her own.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222',
        'authenticated', 'authenticated', 'priya@kitty.local', '{"name": "Priya"}', now(), now());

insert into public.kitties (id, organiser_id, kind, title, due_date, total_paise, upi_id)
values ('a2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
        'moment', 'Priya brunch', '2026-12-01', 200000, 'priya@ybl');

-- Profiles are created on sign up ----------------------------------------------
select is((select name from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'Priya',
  'sign up creates a profile with the name from metadata');

-- Share slugs --------------------------------------------------------------------
select ok((select char_length(share_slug) = 16 from public.kitties where id = 'a2000000-0000-4000-8000-000000000001'),
  'new kitties get a 16 character share slug');

-- Act as Rohan -------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select is((select count(*)::int from public.kitties), 4, 'Rohan sees only his 4 kitties');
select is((select count(*)::int from public.members where kitty_id = 'a2000000-0000-4000-8000-000000000001'), 0,
  'Rohan cannot see members of Priya''s kitty');
select is((select count(*)::int from public.profiles), 1, 'Rohan sees only his own profile');
select is((select count(*)::int from public.member_claims), 0, 'organisers cannot read member claims');

select throws_ok(
  $$ insert into public.kitties (organiser_id, kind, title, due_date, total_paise, upi_id)
     values ('22222222-2222-4222-8222-222222222222', 'moment', 'Fake', '2026-12-01', 100, 'x@ybl') $$,
  '42501', null, 'Rohan cannot create a kitty for Priya');

update public.kitties set title = 'Hijacked' where id = 'a2000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.kitties where title = 'Hijacked'), 0, 'Rohan cannot change Priya''s kitty');

-- The share lock (spec section 4) ---------------------------------------------------
select throws_ok(
  $$ update public.members set share_paise = 50000 where id = 'b0000000-0000-4000-8000-000000000004' $$,
  '23514', 'shares are locked once the kitty is shared', 'shares cannot change on a shared kitty');

select throws_ok(
  $$ insert into public.members (kitty_id, name) values ('a0000000-0000-4000-8000-000000000001', 'Late joiner') $$,
  '23514', 'people are locked once the kitty is shared', 'people cannot be added to a shared kitty');

select throws_ok(
  $$ update public.kitties set total_paise = 1 where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', 'amounts are locked once the kitty is shared', 'the total cannot change on a shared kitty');

select lives_ok(
  $$ update public.members set drinks = false where id = 'b0000000-0000-4000-8000-000000000003' $$,
  'drinks can still be fixed on a shared kitty, for the final bill split');

select lives_ok(
  $$ update public.members set share_paise = 50000, share_fixed = true
     where kitty_id = 'a0000000-0000-4000-8000-000000000004' and name = 'Kabir' $$,
  'shares can change on a draft kitty');

select lives_ok(
  $$ insert into public.members (kitty_id, name, sort_order) values ('a0000000-0000-4000-8000-000000000004', 'Meera', 3) $$,
  'people can be added to a draft kitty');

-- Kitty status moves ---------------------------------------------------------------
select throws_ok(
  $$ update public.kitties set status = 'draft' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', 'kitty cannot move from shared to draft', 'a shared kitty cannot go back to draft');

update public.kitties set status = 'shared' where id = 'a0000000-0000-4000-8000-000000000004';
select isnt((select shared_at from public.kitties where id = 'a0000000-0000-4000-8000-000000000004'), null,
  'sharing stamps shared_at');

-- Payment status moves -------------------------------------------------------------
update public.payments set status = 'not_received' where id = 'c0000000-0000-4000-8000-000000000003';
update public.payments set status = 'marked' where id = 'c0000000-0000-4000-8000-000000000003';
select isnt((select marked_at from public.payments where id = 'c0000000-0000-4000-8000-000000000003'), null,
  'a member can mark paid again after "not yet"');

update public.payments set status = 'confirmed' where id = 'c0000000-0000-4000-8000-000000000003';
select isnt((select confirmed_at from public.payments where id = 'c0000000-0000-4000-8000-000000000003'), null,
  'confirming stamps confirmed_at');

select throws_ok(
  $$ update public.payments set status = 'marked' where id = 'c0000000-0000-4000-8000-000000000003' $$,
  '23514', 'payment cannot move from confirmed to marked', 'a confirmed payment stays confirmed');

select throws_ok(
  $$ update public.payments set amount_paise = 1 where id = 'c0000000-0000-4000-8000-000000000004' $$,
  '23514', 'payment amounts cannot change', 'payment amounts cannot change');

-- Signed-out visitors see nothing ----------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select count(*)::int from public.kitties), 0, 'anonymous visitors see no kitties');

-- Deleting an account removes everything under it -----------------------------------
reset role;
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::int from public.kitties where organiser_id = '11111111-1111-4111-8111-111111111111'), 0,
  'deleting an organiser deletes their kitties, members and payments');

select * from finish();
rollback;
