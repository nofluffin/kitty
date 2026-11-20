-- Push notifications to the organiser (spec section 10) and the Activity screen.
-- The database queues each notification, then sends it straight to Expo's push
-- service with pg_net. Expo's endpoint needs no key, so no secret is stored here.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Notifications: what was pushed, and the "Recent" list on the Activity screen.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kitty_id uuid references public.kitties (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  kind text not null check (kind in ('payment_marked', 'all_paid', 'due_tomorrow', 'due_today', 'part_due')),
  title text not null,
  body text not null,
  -- Where tapping it goes in the organiser app, e.g. /kitty/<id>/confirm/<member id>.
  url text,
  -- Stops the same reminder or "everyone has paid" going out twice.
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);
create index notifications_kitty_idx on public.notifications (kitty_id);
create index notifications_member_idx on public.notifications (member_id);
create trigger set_updated_at before update on public.notifications for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;

create policy "read own notifications" on public.notifications for select
  to authenticated
  using (profile_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Only the database writes notifications; organisers can only mark them read.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- "₹1,000", "₹1,23,456.50", as packages/core formatRupees.
-- ---------------------------------------------------------------------------
create function private.format_rupees(p_paise bigint) returns text
language sql immutable set search_path = '' as $$
  select '₹'
    || case when length(r) > 3
         then regexp_replace(left(r, length(r) - 3), '(\d)(?=(\d\d)+$)', '\1,', 'g') || ',' || right(r, 3)
         else r end
    || case when p_paise % 100 = 0 then '' else '.' || lpad((p_paise % 100)::text, 2, '0') end
  from (select (p_paise / 100)::text as r) x;
$$;

-- ---------------------------------------------------------------------------
-- Send one notification to every phone the organiser is logged in on.
-- A failure here never blocks the payment change that caused it.
-- ---------------------------------------------------------------------------
create function private.send_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  messages jsonb;
begin
  select jsonb_agg(
           jsonb_build_object(
             'to', t.expo_push_token,
             'title', new.title,
             'body', new.body,
             'sound', 'default',
             'channelId', 'default',
             'data', jsonb_build_object('url', new.url, 'notificationId', new.id, 'kittyId', new.kitty_id, 'memberId', new.member_id)
           ) || case when new.kind = 'payment_marked' then jsonb_build_object('categoryId', 'payment_marked') else '{}'::jsonb end
         )
    into messages
  from public.device_tokens t
  where t.profile_id = new.profile_id;

  if messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := messages,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json')
    );
  end if;
  return null;
exception when others then
  raise warning 'push not sent for notification %: %', new.id, sqlerrm;
  return null;
end;
$$;

create trigger send_push after insert on public.notifications
for each row execute function private.send_push();

-- ---------------------------------------------------------------------------
-- A member said they paid, or the last payment was confirmed.
-- ---------------------------------------------------------------------------
create function private.queue_payment_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
  k public.kitties;
  collected bigint;
begin
  if new.direction <> 'in' or new.status is not distinct from old.status then
    return null;
  end if;
  select * into m from public.members where id = new.member_id;
  select * into k from public.kitties where id = new.kitty_id;
  if m.is_organiser then
    return null;
  end if;

  if new.status = 'marked' then
    insert into public.notifications (profile_id, kitty_id, member_id, kind, title, body, url)
    values (
      k.organiser_id, k.id, m.id, 'payment_marked',
      m.name || ' marked ' || private.format_rupees(new.amount_paise) || ' as paid',
      k.title || '. Check it arrived, then confirm.',
      '/kitty/' || k.id || '/confirm/' || m.id
    );
  elsif new.status = 'confirmed' and k.status = 'shared' and not exists (
    select 1 from public.payments p
    where p.kitty_id = k.id and p.direction = 'in' and p.kind in ('share', 'part')
      and p.status not in ('confirmed', 'written_off')
  ) then
    select coalesce(sum(amount_paise), 0) into collected
    from public.payments where kitty_id = k.id and direction = 'in' and status = 'confirmed';
    insert into public.notifications (profile_id, kitty_id, kind, title, body, url, dedupe_key)
    values (
      k.organiser_id, k.id, 'all_paid',
      'Everyone has paid for ' || k.title,
      private.format_rupees(collected) || ' collected.' || case when k.kind = 'moment' then ' Time to pay the bill.' else '' end,
      '/kitty/' || k.id,
      'all_paid:' || k.id
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end;
$$;

create trigger queue_payment_notification after update of status on public.payments
for each row execute function private.queue_payment_notification();

-- ---------------------------------------------------------------------------
-- Daily reminders at 9 am India time: the day before and on the pay by date
-- (if switched on, screen 23), and 3 days before each goal part (spec section 10).
-- "Still to pay" leaves out people who said they've paid and are waiting.
-- ---------------------------------------------------------------------------
create function private.queue_reminders() returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  insert into public.notifications (profile_id, kitty_id, kind, title, body, url, dedupe_key)
  select k.organiser_id, k.id,
         case when k.due_date = today then 'due_today' else 'due_tomorrow' end,
         k.title || case when k.due_date = today then ' is due today' else ' is due tomorrow' end,
         'Still to pay: ' || string_agg(distinct m.name, ', '),
         '/kitty/' || k.id,
         case when k.due_date = today then 'due_today:' else 'due_tomorrow:' end || k.id || ':' || k.due_date
  from public.kitties k
  join public.members m on m.kitty_id = k.id and not m.is_organiser
  join public.payments p on p.member_id = m.id and p.direction = 'in' and p.kind = 'share'
                         and p.status in ('requested', 'not_received')
  where k.status = 'shared' and coalesce(k.goal_plan::text, '') <> 'parts'
    and ((k.remind_day_before and k.due_date = today + 1) or (k.remind_on_day and k.due_date = today))
  group by k.id, k.organiser_id, k.title, k.due_date
  on conflict (dedupe_key) do nothing;

  insert into public.notifications (profile_id, kitty_id, kind, title, body, url, dedupe_key)
  select k.organiser_id, k.id, 'part_due',
         'Part ' || (select count(distinct p2.due_date) from public.payments p2
                     where p2.kitty_id = k.id and p2.kind = 'part' and p2.due_date <= today + 3)
           || ' of ' || k.parts_count || ' for ' || k.title || ' is due in 3 days',
         'Still to pay: ' || string_agg(distinct m.name, ', '),
         '/kitty/' || k.id,
         'part_due:' || k.id || ':' || (today + 3)
  from public.kitties k
  join public.payments p on p.kitty_id = k.id and p.kind = 'part' and p.due_date = today + 3
                         and p.status in ('requested', 'not_received')
  join public.members m on m.id = p.member_id and not m.is_organiser
  where k.status = 'shared'
  group by k.id, k.organiser_id, k.title, k.parts_count
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function private.queue_reminders() from public, anon, authenticated;
revoke execute on function private.send_push() from public, anon, authenticated;
revoke execute on function private.queue_payment_notification() from public, anon, authenticated;

select cron.schedule('kitty-reminders', '30 3 * * *', 'select private.queue_reminders()');

-- ---------------------------------------------------------------------------
-- register_device_token: this phone now belongs to the logged-in organiser.
-- security definer because a phone that changes hands must leave the previous
-- organiser's list, which row level security would otherwise hide.
-- ---------------------------------------------------------------------------
create function public.register_device_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'that is not an Expo push token' using errcode = 'check_violation';
  end if;
  delete from public.device_tokens where expo_push_token = p_token and profile_id <> me;
  insert into public.device_tokens (profile_id, expo_push_token, platform)
  values (me, p_token, p_platform)
  on conflict (expo_push_token) do update set platform = excluded.platform, updated_at = now();
end;
$$;

revoke execute on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
