-- Step 9: goal kitties, paid in one go or in monthly parts (spec section 4, screen 22).

-- ---------------------------------------------------------------------------
-- create_kitty gains the goal plan. The old six-argument version is dropped so
-- calls by name are never ambiguous.
-- ---------------------------------------------------------------------------
drop function public.create_kitty(public.kitty_kind, text, date, bigint, text, jsonb);

create function public.create_kitty(
  p_kind public.kitty_kind,
  p_title text,
  p_due_date date,
  p_total_paise bigint,
  p_upi_id text,
  p_members jsonb,
  p_goal_plan public.goal_plan default null,
  p_parts_count integer default null
) returns public.kitties
language plpgsql security invoker set search_path = '' as $$
declare
  organiser uuid := auth.uid();
  new_kitty public.kitties;
  shares_total bigint;
  member_count int;
  organiser_count int;
  plan public.goal_plan;
  parts int;
begin
  if organiser is null then
    raise exception 'log in to create a kitty' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'give the kitty a name' using errcode = 'check_violation';
  end if;
  if p_total_paise is null or p_total_paise < 0 then
    raise exception 'the total cannot be negative' using errcode = 'check_violation';
  end if;
  if p_due_date < current_date - 1 then
    raise exception 'the pay by date is in the past' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_upi_id), '') !~ '^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$' then
    raise exception 'that does not look like a UPI ID' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_members) <> 'array' then
    raise exception 'people must be a list' using errcode = 'check_violation';
  end if;

  if p_kind = 'goal' then
    -- A goal has a target from the start: there's no bill to scan.
    if p_total_paise <= 0 then
      raise exception 'give the goal a target' using errcode = 'check_violation';
    end if;
    plan := coalesce(p_goal_plan, 'single');
    if plan = 'parts' then
      parts := p_parts_count;
      if parts is null or parts < 2 or parts > 24 then
        raise exception 'pay in 2 to 24 parts' using errcode = 'check_violation';
      end if;
      -- The last part falls on the pay by date, one a month before it.
      if (p_due_date - make_interval(months => parts - 1))::date < current_date then
        raise exception 'the first part would be due before today: pick fewer parts or a later date'
          using errcode = 'check_violation';
      end if;
    end if;
  elsif p_goal_plan is not null or p_parts_count is not null then
    raise exception 'only goals are paid in parts' using errcode = 'check_violation';
  end if;

  select count(*),
         count(*) filter (where coalesce((m ->> 'is_organiser')::boolean, false)),
         coalesce(sum((m ->> 'share_paise')::bigint), 0)
    into member_count, organiser_count, shares_total
  from jsonb_array_elements(p_members) as m;

  if member_count - organiser_count < 1 then
    raise exception 'add at least one other person' using errcode = 'check_violation';
  end if;
  if organiser_count > 1 then
    raise exception 'only one organiser per kitty' using errcode = 'check_violation';
  end if;
  if shares_total <> p_total_paise then
    raise exception 'shares add up to % paise but the total is % paise', shares_total, p_total_paise
      using errcode = 'check_violation';
  end if;
  if parts is not null and exists (
    select 1 from jsonb_array_elements(p_members) m
    where (m ->> 'share_paise')::bigint between 1 and parts - 1
  ) then
    raise exception 'a share is too small to split into % parts', parts using errcode = 'check_violation';
  end if;

  insert into public.kitties (organiser_id, kind, title, due_date, total_paise, upi_id, amount_source, goal_plan, parts_count)
  values (organiser, p_kind, btrim(p_title), p_due_date, p_total_paise, lower(btrim(p_upi_id)), 'typed', plan, parts)
  returning * into new_kitty;

  insert into public.members (kitty_id, name, phone, is_organiser, diet, drinks, share_paise, share_fixed, sort_order)
  select new_kitty.id,
         btrim(m ->> 'name'),
         nullif(btrim(coalesce(m ->> 'phone', '')), ''),
         coalesce((m ->> 'is_organiser')::boolean, false),
         coalesce((m ->> 'diet')::public.diet, 'veg'),
         coalesce((m ->> 'drinks')::boolean, false),
         (m ->> 'share_paise')::bigint,
         coalesce((m ->> 'share_fixed')::boolean, false),
         (ord - 1)::int
  from jsonb_array_elements(p_members) with ordinality as t(m, ord);

  update public.profiles set upi_id = new_kitty.upi_id where id = organiser;

  return new_kitty;
end;
$$;

revoke execute on function public.create_kitty(public.kitty_kind, text, date, bigint, text, jsonb, public.goal_plan, integer) from public, anon;
grant execute on function public.create_kitty(public.kitty_kind, text, date, bigint, text, jsonb, public.goal_plan, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- share_kitty: a goal in parts asks each member for parts_count monthly payments
-- (kind 'part', each with its due date) instead of one share. Mirrors goalParts
-- in packages/core: equal parts, leftover paise on the last, the last on the due date.
-- ---------------------------------------------------------------------------
create or replace function public.share_kitty(p_kitty_id uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  k public.kitties;
  shares_total bigint;
begin
  select * into k from public.kitties where id = p_kitty_id for update;
  if not found then
    raise exception 'kitty not found' using errcode = 'no_data_found';
  end if;
  if k.status = 'shared' then
    return k.share_slug;
  end if;
  if k.status <> 'draft' then
    raise exception 'this kitty is % and cannot be shared', k.status using errcode = 'check_violation';
  end if;
  if k.total_paise <= 0 then
    raise exception 'add a total or scan the bill before sharing' using errcode = 'check_violation';
  end if;

  select coalesce(sum(share_paise), 0) into shares_total from public.members where kitty_id = k.id;
  if shares_total <> k.total_paise then
    raise exception 'shares add up to % paise but the total is % paise', shares_total, k.total_paise
      using errcode = 'check_violation';
  end if;

  if k.goal_plan = 'parts' then
    if (k.due_date - make_interval(months => k.parts_count - 1))::date < current_date then
      raise exception 'the first part would be due before today: pick fewer parts or a later date'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from public.members where kitty_id = k.id and share_paise between 1 and k.parts_count - 1) then
      raise exception 'a share is too small to split into % parts', k.parts_count using errcode = 'check_violation';
    end if;
  end if;

  update public.kitties set status = 'shared' where id = k.id;

  if k.goal_plan = 'parts' then
    insert into public.payments (kitty_id, member_id, kind, direction, amount_paise, due_date)
    select k.id, m.id, 'part', 'in',
           case when i = k.parts_count
                then m.share_paise - (m.share_paise / k.parts_count) * (k.parts_count - 1)
                else m.share_paise / k.parts_count end,
           (k.due_date - make_interval(months => k.parts_count - i))::date
    from public.members m
    cross join generate_series(1, k.parts_count) as i
    where m.kitty_id = k.id and m.share_paise > 0;
  else
    insert into public.payments (kitty_id, member_id, kind, direction, amount_paise)
    select k.id, m.id, 'share', 'in', m.share_paise
    from public.members m
    where m.kitty_id = k.id and m.share_paise > 0;
  end if;

  -- The organiser's own share (or parts) is their own money: confirmed straight away.
  update public.payments p set status = 'confirmed'
  from public.members m
  where p.member_id = m.id and m.kitty_id = k.id and m.is_organiser and p.kind in ('share', 'part');

  return k.share_slug;
end;
$$;

-- Parts are looked up by member and due date (next part to pay, part due soon).
create index payments_due_idx on public.payments (kitty_id, due_date) where due_date is not null;
