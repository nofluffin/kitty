-- Decided with Raj, 20 Nov 2026: a kitty's total, people and shares stay editable
-- after sharing until anyone (other than the organiser) has marked or paid anything.
-- After that, changes go through settle up, so money already sent is never lost track of.
-- Scanning the bill on a kitty nobody has paid yet replaces its total and shares directly.

-- ---------------------------------------------------------------------------
-- Has anyone but the organiser started paying? (marked, confirmed, not received or written off)
-- ---------------------------------------------------------------------------
create function private.kitty_has_payments(p_kitty_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1
    from public.payments p
    join public.members m on m.id = p.member_id
    where p.kitty_id = p_kitty_id and not m.is_organiser and p.status <> 'requested'
  );
$$;

revoke execute on function private.kitty_has_payments(uuid) from public, anon;
grant execute on function private.kitty_has_payments(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The lock now starts at the first payment, not at sharing.
-- ---------------------------------------------------------------------------
create or replace function public.check_kitty_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('shared', 'cancelled'))
      or (old.status = 'shared' and new.status in ('settling', 'closed', 'cancelled'))
      or (old.status = 'settling' and new.status = 'closed')
    ) then
      raise exception 'kitty cannot move from % to %', old.status, new.status using errcode = 'check_violation';
    end if;
    if new.status = 'shared' then new.shared_at := coalesce(new.shared_at, now()); end if;
    if new.status = 'closed' then new.closed_at := coalesce(new.closed_at, now()); end if;
  end if;

  if (
    new.total_paise is distinct from old.total_paise
    or new.kind is distinct from old.kind
    or new.goal_plan is distinct from old.goal_plan
    or new.parts_count is distinct from old.parts_count
  ) and not (
    old.status = 'draft'
    or (old.status = 'shared' and new.status = 'shared' and not private.kitty_has_payments(old.id))
  ) then
    raise exception 'amounts are locked once someone has paid' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.check_member_lock() returns trigger
language plpgsql set search_path = '' as $$
declare
  k public.kitties;
begin
  select * into k from public.kitties where id = coalesce(new.kitty_id, old.kitty_id);

  -- The kitty itself is being deleted (cascade).
  if k.id is null then
    return coalesce(new, old);
  end if;

  if k.status = 'draft' or (k.status = 'shared' and not private.kitty_has_payments(k.id)) then
    return coalesce(new, old);
  end if;

  -- Diet and drinks stay editable: the organiser may fix them when splitting the final bill.
  if tg_op in ('INSERT', 'DELETE') then
    raise exception 'people are locked once someone has paid' using errcode = 'check_violation';
  end if;
  if new.share_paise is distinct from old.share_paise
     or new.share_fixed is distinct from old.share_fixed
     or new.kitty_id is distinct from old.kitty_id then
    raise exception 'shares are locked once someone has paid' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- One place for the rules create_kitty and update_kitty share.
-- Returns the goal plan and number of parts to store.
-- ---------------------------------------------------------------------------
create function private.check_kitty_input(
  p_kind public.kitty_kind,
  p_title text,
  p_due_date date,
  p_total_paise bigint,
  p_upi_id text,
  p_members jsonb,
  p_goal_plan public.goal_plan,
  p_parts_count integer,
  out plan public.goal_plan,
  out parts integer
)
language plpgsql stable security invoker set search_path = '' as $$
declare
  shares_total bigint;
  member_count int;
  organiser_count int;
begin
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
    if p_total_paise <= 0 then
      raise exception 'give the goal a target' using errcode = 'check_violation';
    end if;
    plan := coalesce(p_goal_plan, 'single');
    if plan = 'parts' then
      parts := p_parts_count;
      if parts is null or parts < 2 or parts > 24 then
        raise exception 'pay in 2 to 24 parts' using errcode = 'check_violation';
      end if;
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
  if exists (select 1 from jsonb_array_elements(p_members) m where (m ->> 'share_paise')::bigint < 0) then
    raise exception 'shares cannot be negative' using errcode = 'check_violation';
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
end;
$$;

revoke execute on function private.check_kitty_input(public.kitty_kind, text, date, bigint, text, jsonb, public.goal_plan, integer) from public, anon;
grant execute on function private.check_kitty_input(public.kitty_kind, text, date, bigint, text, jsonb, public.goal_plan, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Ask everyone for their share (or parts). Used when sharing, and again when a
-- shared kitty nobody has paid is edited or scanned.
-- ---------------------------------------------------------------------------
create function private.request_payments(p_kitty_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  k public.kitties;
begin
  select * into k from public.kitties where id = p_kitty_id;

  if k.goal_plan = 'parts' then
    if (k.due_date - make_interval(months => k.parts_count - 1))::date < current_date then
      raise exception 'the first part would be due before today: pick fewer parts or a later date'
        using errcode = 'check_violation';
    end if;
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

  -- The organiser's own share is their own money: confirmed straight away.
  update public.payments p set status = 'confirmed'
  from public.members m
  where p.member_id = m.id and m.kitty_id = k.id and m.is_organiser and p.kind in ('share', 'part');
end;
$$;

revoke execute on function private.request_payments(uuid) from public, anon;
grant execute on function private.request_payments(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_kitty and share_kitty, now using the shared rules above.
-- ---------------------------------------------------------------------------
create or replace function public.create_kitty(
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
  checked record;
begin
  if organiser is null then
    raise exception 'log in to create a kitty' using errcode = '42501';
  end if;
  checked := private.check_kitty_input(p_kind, p_title, p_due_date, p_total_paise, p_upi_id, p_members, p_goal_plan, p_parts_count);

  insert into public.kitties (organiser_id, kind, title, due_date, total_paise, upi_id, amount_source, goal_plan, parts_count)
  values (organiser, p_kind, btrim(p_title), p_due_date, p_total_paise, lower(btrim(p_upi_id)), 'typed', checked.plan, checked.parts)
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
  if k.goal_plan = 'parts' and exists (
    select 1 from public.members where kitty_id = k.id and share_paise between 1 and k.parts_count - 1
  ) then
    raise exception 'a share is too small to split into % parts', k.parts_count using errcode = 'check_violation';
  end if;

  update public.kitties set status = 'shared' where id = k.id;
  perform private.request_payments(k.id);
  return k.share_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_kitty: edit a draft, or a shared kitty nobody has paid yet.
-- p_members: like create_kitty, plus "id" for people already in the kitty.
-- People left out are removed. A shared kitty's payment requests are redone.
-- ---------------------------------------------------------------------------
create function public.update_kitty(
  p_kitty_id uuid,
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
  k public.kitties;
  checked record;
  unknown int;
begin
  select * into k from public.kitties where id = p_kitty_id for update;
  if not found then
    raise exception 'kitty not found' using errcode = 'no_data_found';
  end if;
  if k.status not in ('draft', 'shared') then
    raise exception 'this kitty is % and can no longer be edited', k.status using errcode = 'check_violation';
  end if;
  if k.status = 'shared' and private.kitty_has_payments(k.id) then
    raise exception 'someone has already paid, so amounts are locked: use settle up' using errcode = 'check_violation';
  end if;
  if k.status = 'shared' and p_total_paise <= 0 then
    raise exception 'a shared kitty needs a total' using errcode = 'check_violation';
  end if;
  checked := private.check_kitty_input(p_kind, p_title, p_due_date, p_total_paise, p_upi_id, p_members, p_goal_plan, p_parts_count);

  select count(*) into unknown
  from jsonb_array_elements(p_members) m
  where m ? 'id' and not exists (
    select 1 from public.members x where x.id = (m ->> 'id')::uuid and x.kitty_id = k.id
  );
  if unknown > 0 then
    raise exception 'someone in the list is not in this kitty' using errcode = 'check_violation';
  end if;

  -- Old requests go first: they are redone below from the new shares.
  delete from public.payments where kitty_id = k.id;

  delete from public.members x
  where x.kitty_id = k.id
    and not exists (select 1 from jsonb_array_elements(p_members) m where (m ->> 'id')::uuid = x.id);

  update public.members x set
    name = btrim(m ->> 'name'),
    phone = nullif(btrim(coalesce(m ->> 'phone', '')), ''),
    is_organiser = coalesce((m ->> 'is_organiser')::boolean, false),
    diet = coalesce((m ->> 'diet')::public.diet, 'veg'),
    drinks = coalesce((m ->> 'drinks')::boolean, false),
    share_paise = (m ->> 'share_paise')::bigint,
    share_fixed = coalesce((m ->> 'share_fixed')::boolean, false),
    sort_order = (ord - 1)::int
  from jsonb_array_elements(p_members) with ordinality as t(m, ord)
  where m ? 'id' and x.id = (m ->> 'id')::uuid;

  insert into public.members (kitty_id, name, phone, is_organiser, diet, drinks, share_paise, share_fixed, sort_order)
  select k.id,
         btrim(m ->> 'name'),
         nullif(btrim(coalesce(m ->> 'phone', '')), ''),
         coalesce((m ->> 'is_organiser')::boolean, false),
         coalesce((m ->> 'diet')::public.diet, 'veg'),
         coalesce((m ->> 'drinks')::boolean, false),
         (m ->> 'share_paise')::bigint,
         coalesce((m ->> 'share_fixed')::boolean, false),
         (ord - 1)::int
  from jsonb_array_elements(p_members) with ordinality as t(m, ord)
  where not m ? 'id';

  update public.kitties set
    kind = p_kind,
    title = btrim(p_title),
    due_date = p_due_date,
    total_paise = p_total_paise,
    upi_id = lower(btrim(p_upi_id)),
    amount_source = 'typed',
    goal_plan = checked.plan,
    parts_count = checked.parts
  where id = k.id
  returning * into k;

  if k.status = 'shared' then
    perform private.request_payments(k.id);
  end if;

  update public.profiles set upi_id = k.upi_id where id = auth.uid();
  return k;
end;
$$;

revoke execute on function public.update_kitty(uuid, public.kitty_kind, text, date, bigint, text, jsonb, public.goal_plan, integer) from public, anon;
grant execute on function public.update_kitty(uuid, public.kitty_kind, text, date, bigint, text, jsonb, public.goal_plan, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- apply_scanned_shares: also for a shared kitty nobody has paid yet, so scanning
-- the bill just replaces its total and shares (no settle up needed).
-- ---------------------------------------------------------------------------
create or replace function public.apply_scanned_shares(p_kitty_id uuid, p_bill_id uuid, p_shares jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  k public.kitties;
  b public.bills;
  bill_total bigint;
  given int;
  matched int;
  member_total int;
  shares_total bigint;
begin
  select * into k from public.kitties where id = p_kitty_id for update;
  if not found then
    raise exception 'kitty not found' using errcode = 'no_data_found';
  end if;
  if not (k.status = 'draft' or (k.status = 'shared' and not private.kitty_has_payments(k.id))) then
    raise exception 'someone has already paid, so use settle up for the bill' using errcode = 'check_violation';
  end if;
  select * into b from public.bills where id = p_bill_id and kitty_id = k.id;
  if not found then
    raise exception 'bill not found for this kitty' using errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.bill_lines where bill_id = b.id and category = 'unsure') then
    raise exception 'sort the unsure lines first' using errcode = 'check_violation';
  end if;

  select coalesce(sum(amount_paise), 0) + b.extras_paise into bill_total from public.bill_lines where bill_id = b.id;

  select count(*), coalesce(sum((s ->> 'share_paise')::bigint), 0) into given, shares_total
  from jsonb_array_elements(p_shares) s;
  select count(*) into member_total from public.members where kitty_id = k.id;
  select count(distinct m.id) into matched
  from jsonb_array_elements(p_shares) s
  join public.members m on m.id = (s ->> 'member_id')::uuid and m.kitty_id = k.id;
  if given <> member_total or matched <> member_total then
    raise exception 'give a share for every person in the kitty, once each' using errcode = 'check_violation';
  end if;
  if shares_total <> bill_total then
    raise exception 'shares add up to % paise but the bill is % paise', shares_total, bill_total
      using errcode = 'check_violation';
  end if;

  delete from public.payments where kitty_id = k.id;

  update public.members m set share_paise = (s ->> 'share_paise')::bigint, share_fixed = false
  from jsonb_array_elements(p_shares) s
  where m.id = (s ->> 'member_id')::uuid and m.kitty_id = k.id;

  update public.kitties set total_paise = bill_total, amount_source = 'scanned' where id = k.id;
  update public.bills set status = 'confirmed' where id = b.id;

  if k.status = 'shared' then
    perform private.request_payments(k.id);
  end if;
end;
$$;
