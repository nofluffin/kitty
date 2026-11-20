-- Push notifications and reminders (spec section 10). Run with: npm run db:test
begin;
select plan(13);

create temp table today as select (now() at time zone 'Asia/Kolkata')::date as d;
grant select on today to authenticated;
-- A second organiser, for the phone that changes hands.
insert into auth.users (id, email, raw_user_meta_data) values ('33333333-3333-4333-8333-333333333333', 'other@kitty.test', '{"name": "Other"}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}';

select throws_ok($$ select public.register_device_token('not-a-token', 'ios') $$, '23514', 'that is not an Expo push token',
  'only Expo push tokens are stored');
select lives_ok($$ select public.register_device_token('ExponentPushToken[test-rohan-phone]', 'ios') $$, 'a phone registers for push');

create temp table k as
select * from public.create_kitty('moment', 'Cab', (select d from today), 200000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000}, {"name": "Kabir", "share_paise": 100000}]');
select public.share_kitty((select id from k));
create temp table kabir as select id from public.members where kitty_id = (select id from k) and name = 'Kabir';

update public.payments set status = 'marked' where member_id = (select id from kabir);
select is((select title || ' | ' || body || ' | ' || url from public.notifications where kitty_id = (select id from k) and kind = 'payment_marked'),
  'Kabir marked ₹1,000 as paid | Cab. Check it arrived, then confirm. | /kitty/' || (select id from k) || '/confirm/' || (select id from kabir),
  'marking paid tells the organiser, with a link to confirm');

select throws_ok($$ insert into public.notifications (profile_id, kind, title, body) values ('11111111-1111-4111-8111-111111111111', 'all_paid', 'x', 'y') $$,
  '42501', null, 'organisers cannot write notifications themselves');

update public.payments set status = 'confirmed' where member_id = (select id from kabir);
select is((select title || ' | ' || body from public.notifications where kitty_id = (select id from k) and kind = 'all_paid'),
  'Everyone has paid for Cab | ₹2,000 collected. Time to pay the bill.', 'the last confirmation says everyone has paid');
select is((select count(*)::int from public.notifications where kitty_id = (select id from k)), 2, 'nothing else was queued');

update public.notifications set read_at = now() where kitty_id = (select id from k);
select is((select count(*)::int from public.notifications where kitty_id = (select id from k) and read_at is not null), 2, 'organisers can mark them read');

-- Reminders, as the scheduled job runs them.
create temp table late as
select * from public.create_kitty('moment', 'Lunch', (select d from today), 300000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000}, {"name": "Aisha", "share_paise": 100000}, {"name": "Dev", "share_paise": 100000}]');
select public.share_kitty((select id from late));
update public.kitties set remind_on_day = true where id = (select id from late);
update public.payments set status = 'marked'
where member_id = (select id from public.members where kitty_id = (select id from late) and name = 'Dev');

create temp table goa as
select * from public.create_kitty('goal', 'Goa', ((select d from today) + 3 + interval '1 month')::date, 200000, 'rohan@okicici',
  '[{"name": "Rohan", "is_organiser": true, "share_paise": 100000}, {"name": "Zoya", "share_paise": 100000}]', 'parts', 2);
select public.share_kitty((select id from goa));

reset role;
select private.queue_reminders();
select private.queue_reminders();

select is((select title || ' | ' || body from public.notifications where kitty_id = (select id from late) and kind = 'due_today'),
  'Lunch is due today | Still to pay: Aisha', 'the on-the-day reminder lists who still has to pay');
select is((select count(*)::int from public.notifications where kitty_id = (select id from late) and kind = 'due_today'), 1,
  'each reminder goes out once');
select is((select title || ' | ' || body from public.notifications where kitty_id = (select id from goa) and kind = 'part_due'),
  'Part 1 of 2 for Goa is due in 3 days | Still to pay: Zoya', 'goal parts get a reminder 3 days before');
select is((select count(*)::int from public.notifications where kitty_id = (select id from k) and kind like 'due%'), 0,
  'no reminder when the switch is off');

select ok((select count(*) from net.http_request_queue where url = 'https://exp.host/--/api/v2/push/send') >= 5,
  'each notification is sent to Expo');

-- A phone that changes hands moves to the new organiser.
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';
select public.register_device_token('ExponentPushToken[test-rohan-phone]', 'ios');
reset role;
select is((select profile_id::text from public.device_tokens where expo_push_token = 'ExponentPushToken[test-rohan-phone]'),
  '33333333-3333-4333-8333-333333333333', 'a phone belongs to whoever logged in last');

select * from finish();
rollback;
