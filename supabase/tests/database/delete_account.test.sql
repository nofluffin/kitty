-- Deleting your own account (step 10). Run with: npm run db:test
begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444444', 'leaving@kitty.test', '{"name": "Leaving"}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}';
create temp table k as
select * from public.create_kitty('moment', 'Last dinner', current_date + 2, 200000, 'leaving@okaxis',
  '[{"name": "Leaving", "is_organiser": true, "share_paise": 100000}, {"name": "Friend", "share_paise": 100000}]');
select public.share_kitty((select id from k));
select public.register_device_token('ExponentPushToken[leaving-phone]', 'ios');

select throws_ok($$ select private.delete_account('11111111-1111-4111-8111-111111111111') $$, '42501', null,
  'nobody can delete someone else''s account directly');
select lives_ok($$ select public.delete_my_account() $$, 'an organiser can delete their own account');

reset role;
select is((select count(*)::int from auth.users where id = '44444444-4444-4444-8444-444444444444'), 0, 'the login is gone');
select is((select count(*)::int from public.kitties where id = (select id from k)), 0, 'their kitties are gone');
select is((select count(*)::int from public.device_tokens where expo_push_token = 'ExponentPushToken[leaving-phone]'), 0, 'their phones are gone');
select is((select count(*)::int from auth.users where id = '11111111-1111-4111-8111-111111111111'), 1, 'other people are untouched');

select * from finish();
rollback;
