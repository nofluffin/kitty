-- Archiving kitties, and saved groups of people (decided with Raj, 20 Nov 2026).

-- ---------------------------------------------------------------------------
-- Archive: the organiser files a kitty away from their list. Friends' links keep
-- working; archived kitties stop sending reminders.
-- ---------------------------------------------------------------------------
alter table public.kitties add column archived_at timestamptz;
comment on column public.kitties.archived_at is 'When the organiser archived it. Null: on their kitty list.';

create or replace function private.queue_reminders() returns void
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
  where k.status = 'shared' and k.archived_at is null and coalesce(k.goal_plan::text, '') <> 'parts'
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
  where k.status = 'shared' and k.archived_at is null
  group by k.id, k.organiser_id, k.title, k.parts_count
  on conflict (dedupe_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saved groups: people an organiser often splits with, added to a new kitty in
-- one tap. The organiser isn't stored: they're always in their own kitty.
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index groups_profile_name_idx on public.groups (profile_id, lower(btrim(name)));

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text,
  diet public.diet not null default 'veg',
  drinks boolean not null default false,
  -- Who pays for this person, as a place in the group's list (e.g. a parent for a child).
  paid_by_index integer check (paid_by_index >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index group_members_group_idx on public.group_members (group_id, sort_order);
create trigger set_updated_at before update on public.groups for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.group_members for each row execute function public.set_updated_at();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

create policy "own groups" on public.groups for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "people in own groups" on public.group_members for all
  to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.profile_id = (select auth.uid())))
  with check (exists (select 1 from public.groups g where g.id = group_id and g.profile_id = (select auth.uid())));

revoke all on public.groups, public.group_members from anon;

-- save_group: save (or replace, by name) a group in one go.
-- p_people: [{ "name", "phone", "diet", "drinks", "paid_by_index" }, ...]
create function public.save_group(p_name text, p_people jsonb) returns public.groups
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.groups;
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'give the group a name' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) = 0 then
    raise exception 'add at least one person to the group' using errcode = 'check_violation';
  end if;

  delete from public.groups where profile_id = me and lower(btrim(name)) = lower(btrim(p_name));
  insert into public.groups (profile_id, name) values (me, btrim(p_name)) returning * into g;

  insert into public.group_members (group_id, name, phone, diet, drinks, paid_by_index, sort_order)
  select g.id,
         btrim(p ->> 'name'),
         nullif(btrim(coalesce(p ->> 'phone', '')), ''),
         coalesce((p ->> 'diet')::public.diet, 'veg'),
         coalesce((p ->> 'drinks')::boolean, false),
         (p ->> 'paid_by_index')::int,
         (ord - 1)::int
  from jsonb_array_elements(p_people) with ordinality as t(p, ord);

  return g;
end;
$$;

revoke execute on function public.save_group(text, jsonb) from public, anon;
grant execute on function public.save_group(text, jsonb) to authenticated;
