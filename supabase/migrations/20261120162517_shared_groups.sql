-- Shared groups (decided with Raj, 20 Nov 2026).
-- * A group, once made, never changes. Saving people under a name makes a new group;
--   if you already had one with that name, you swap to the new one. Others keep theirs.
-- * A group can be in several organisers' logins. Anyone can leave; it's deleted when
--   the last person leaves.
-- * For now groups are shared on purpose, with a link. Automatic matching by verified
--   mobile number comes with SMS login.
-- * Groups include the organiser who saved them, so a friend who adds the group gets
--   them too (and is left out themselves).

-- Replace the single-owner model from 20261120161414_archive_and_groups.
drop policy "own groups" on public.groups;
drop policy "people in own groups" on public.group_members;
drop index public.groups_profile_name_idx;
drop function public.save_group(text, jsonb);

comment on column public.groups.profile_id is 'Who made the group.';
alter table public.groups
  add column created_by_name text not null default '',
  add column share_token text not null unique default public.generate_share_slug() check (char_length(share_token) >= 12);

-- The organiser's own row in their group, so it can be left out when they use it.
alter table public.group_members add column profile_id uuid references public.profiles (id) on delete set null;
create index group_members_profile_idx on public.group_members (profile_id);

-- Whose login each group is in.
create table public.group_holders (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index group_holders_profile_idx on public.group_holders (profile_id);
alter table public.group_holders enable row level security;
revoke all on public.group_holders from anon;

insert into public.group_holders (group_id, profile_id) select id, profile_id from public.groups;

-- Visible to whoever holds the group. Writes go through the functions below.
create function private.holds_group(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_holders h where h.group_id = p_group and h.profile_id = (select auth.uid()));
$$;
revoke execute on function private.holds_group(uuid) from public, anon;
grant execute on function private.holds_group(uuid) to authenticated;

create policy "groups you hold" on public.groups for select
  to authenticated using (private.holds_group(id));
create policy "people in groups you hold" on public.group_members for select
  to authenticated using (private.holds_group(group_id));
create policy "your own holdings" on public.group_holders for select
  to authenticated using (profile_id = (select auth.uid()));
create policy "leave a group" on public.group_holders for delete
  to authenticated using (profile_id = (select auth.uid()));

revoke insert, update, delete on public.groups, public.group_members from authenticated;

-- A group nobody holds any more is deleted.
create function private.drop_unheld_group() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.group_holders where group_id = old.group_id) then
    delete from public.groups where id = old.group_id;
  end if;
  return null;
end;
$$;
revoke execute on function private.drop_unheld_group() from public, anon, authenticated;
create trigger drop_unheld_group after delete on public.group_holders
for each row execute function private.drop_unheld_group();

-- ---------------------------------------------------------------------------
-- save_group: make a new group from a kitty's people (the organiser included,
-- marked "is_me"). Any group of yours with the same name is swapped for it.
-- ---------------------------------------------------------------------------
create function private.save_group(p_name text, p_people jsonb) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_name text;
  g public.groups;
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'give the group a name' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_people) <> 'array'
     or (select count(*) from jsonb_array_elements(p_people) p where not coalesce((p ->> 'is_me')::boolean, false)) = 0 then
    raise exception 'add at least one other person to the group' using errcode = 'check_violation';
  end if;

  delete from public.group_holders h
  using public.groups x
  where h.group_id = x.id and h.profile_id = me and lower(btrim(x.name)) = lower(btrim(p_name));

  select name into my_name from public.profiles where id = me;
  insert into public.groups (profile_id, name, created_by_name) values (me, btrim(p_name), coalesce(my_name, ''))
  returning * into g;
  insert into public.group_holders (group_id, profile_id) values (g.id, me);

  insert into public.group_members (group_id, name, phone, diet, drinks, paid_by_index, sort_order, profile_id)
  select g.id,
         btrim(p ->> 'name'),
         nullif(btrim(coalesce(p ->> 'phone', '')), ''),
         coalesce((p ->> 'diet')::public.diet, 'veg'),
         coalesce((p ->> 'drinks')::boolean, false),
         (p ->> 'paid_by_index')::int,
         (ord - 1)::int,
         case when coalesce((p ->> 'is_me')::boolean, false) then me end
  from jsonb_array_elements(p_people) with ordinality as t(p, ord);

  return g;
end;
$$;
revoke execute on function private.save_group(text, jsonb) from public, anon;
grant execute on function private.save_group(text, jsonb) to authenticated;

create function public.save_group(p_name text, p_people jsonb) returns public.groups
language plpgsql security invoker set search_path = '' as $$
begin
  return private.save_group(p_name, p_people);
end;
$$;
revoke execute on function public.save_group(text, jsonb) from public, anon;
grant execute on function public.save_group(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- join_group: "Share group" link. Adds the group to your login.
-- ---------------------------------------------------------------------------
create function private.join_group(p_token text) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.groups;
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  select * into g from public.groups where share_token = p_token;
  if not found then
    raise exception 'that group link has expired or was mistyped' using errcode = 'no_data_found';
  end if;
  insert into public.group_holders (group_id, profile_id) values (g.id, me) on conflict do nothing;
  return g;
end;
$$;
revoke execute on function private.join_group(text) from public, anon;
grant execute on function private.join_group(text) to authenticated;

create function public.join_group(p_token text) returns public.groups
language plpgsql security invoker set search_path = '' as $$
begin
  return private.join_group(p_token);
end;
$$;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;
