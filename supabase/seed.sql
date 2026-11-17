-- Local sample data, matching the wireframes. Runs on `npm run db:reset`.
-- Log in to the local app as rohan@kitty.local (email code: see Mailpit at http://127.0.0.1:55324).

-- ---------------------------------------------------------------------------
-- Organiser: Rohan
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'rohan@kitty.local',
  extensions.crypt('kitty-local-only', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Rohan"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub": "11111111-1111-4111-8111-111111111111", "email": "rohan@kitty.local"}',
  'email', now(), now(), now()
);

-- The profile row is created by the on_auth_user_created trigger.
update public.profiles
set phone = '+919800000001', upi_id = 'rohan@okicici'
where id = '11111111-1111-4111-8111-111111111111';

-- ---------------------------------------------------------------------------
-- Friday dinner: moment, ₹6,000, 6 people, ₹1,000 each (screens 7 and 14)
-- Kitties start as drafts so members can be added, then move to shared.
-- ---------------------------------------------------------------------------

insert into public.kitties (id, organiser_id, kind, title, due_date, total_paise, upi_id, share_slug, remind_day_before)
values (
  'a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
  'moment', 'Friday dinner', '2026-11-20', 600000, 'rohan@okicici', 'FridayDinnerDemo', true
);

insert into public.members (id, kitty_id, name, phone, is_organiser, diet, drinks, share_paise, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Rohan', '+919800000001', true,  'nonveg', true,  100000, 0),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Kabir', '+919800000002', false, 'nonveg', true,  100000, 1),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Dev',   '+919800000003', false, 'nonveg', true,  100000, 2),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Zoya',  '+919800000004', false, 'nonveg', false, 100000, 3),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Aisha', null,            false, 'veg',    false, 100000, 4),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Meera', '+919800000006', false, 'veg',    false, 100000, 5);

update public.kitties set status = 'shared' where id = 'a0000000-0000-4000-8000-000000000001';

-- Zoya opened the link but hasn't paid.
update public.members set last_opened_at = now() - interval '1 day' where id = 'b0000000-0000-4000-8000-000000000004';

insert into public.payments (id, kitty_id, member_id, kind, direction, amount_paise) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'share', 'in', 100000),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'share', 'in', 100000),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'share', 'in', 100000),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'share', 'in', 100000),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005', 'share', 'in', 100000),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'share', 'in', 100000);

-- Rohan's own share is confirmed automatically. Kabir, Aisha and Meera are confirmed.
update public.payments set status = 'confirmed'
where id in (
  'c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006'
);
-- Dev says he paid and is waiting for Rohan to confirm (screen 8).
update public.payments set status = 'marked' where id = 'c0000000-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Goa trip: goal, ₹50,000, 5 people, one payment each (screen 1)
-- ---------------------------------------------------------------------------

insert into public.kitties (id, organiser_id, kind, title, due_date, total_paise, upi_id, goal_plan, share_slug)
values (
  'a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
  'goal', 'Goa trip', '2027-01-12', 5000000, 'rohan@okicici', 'single', 'GoaTripDemo00001'
);

insert into public.members (id, kitty_id, name, is_organiser, share_paise, sort_order) values
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000002', 'Rohan', true,  1000000, 0),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000002', 'Aisha', false, 1000000, 1),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000002', 'Kabir', false, 1000000, 2),
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000002', 'Meera', false, 1000000, 3),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000002', 'Dev',   false, 1000000, 4);

update public.kitties set status = 'shared' where id = 'a0000000-0000-4000-8000-000000000002';

insert into public.payments (kitty_id, member_id, kind, direction, amount_paise, due_date)
select kitty_id, id, 'share', 'in', share_paise, '2027-01-12'
from public.members where kitty_id = 'a0000000-0000-4000-8000-000000000002';

update public.payments set status = 'confirmed'
where member_id in ('b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000012');

-- ---------------------------------------------------------------------------
-- Meera's birthday gift: closed. Rohan organised but didn't pay in.
-- ---------------------------------------------------------------------------

insert into public.kitties (id, organiser_id, kind, title, due_date, total_paise, upi_id, share_slug)
values (
  'a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
  'moment', 'Meera''s birthday gift', '2026-11-02', 300000, 'rohan@okicici', 'MeeraGiftDemo001'
);

insert into public.members (id, kitty_id, name, share_paise, sort_order) values
  ('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000003', 'Aisha', 100000, 0),
  ('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000003', 'Kabir', 100000, 1),
  ('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000003', 'Dev',   100000, 2);

update public.kitties set status = 'shared' where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.payments (kitty_id, member_id, kind, direction, amount_paise)
select kitty_id, id, 'share', 'in', share_paise
from public.members where kitty_id = 'a0000000-0000-4000-8000-000000000003';

update public.payments set status = 'confirmed' where kitty_id = 'a0000000-0000-4000-8000-000000000003';
update public.kitties set status = 'closed' where id = 'a0000000-0000-4000-8000-000000000003';

-- ---------------------------------------------------------------------------
-- Saturday cab: a draft, not shared yet. ₹1,000 across 3 shows leftover paise.
-- ---------------------------------------------------------------------------

insert into public.kitties (id, organiser_id, kind, title, due_date, total_paise, upi_id, share_slug)
values (
  'a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
  'moment', 'Saturday cab', '2026-11-21', 100000, 'rohan@okicici', 'SaturdayCabDemo1'
);

insert into public.members (kitty_id, name, is_organiser, share_paise, sort_order) values
  ('a0000000-0000-4000-8000-000000000004', 'Rohan', true,  33334, 0),
  ('a0000000-0000-4000-8000-000000000004', 'Kabir', false, 33333, 1),
  ('a0000000-0000-4000-8000-000000000004', 'Zoya',  false, 33333, 2);
