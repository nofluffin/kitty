-- Step 8: bill scan (spec section 8).

-- "Log the cost of each scan call so we can see it per kitty."
alter table public.bills
  add column scan_model text,
  add column scan_input_tokens integer check (scan_input_tokens >= 0),
  add column scan_output_tokens integer check (scan_output_tokens >= 0),
  add column scan_cost_usd numeric(10, 6) check (scan_cost_usd >= 0),
  -- Printed lines plus extras minus the printed total, in paise. Over ₹1 either way
  -- means the scan missed or misread something (shown on screen 11).
  add column mismatch_paise bigint;

comment on column public.bills.scan_cost_usd is
  'Estimated cost of the Claude API call for this scan, from its token usage.';

-- Bills move: processing (scan running) -> needs_review (organiser checks lines,
-- screens 10 and 11) -> confirmed ("Looks right, work out shares"). failed: screen 25.
create index bills_kitty_status_idx on public.bills (kitty_id, status);

-- ---------------------------------------------------------------------------
-- Scanning before sharing (screen 2 -> 9 -> 5): the kitty is saved as a draft
-- first so its photos have a home, and the total can wait for the scan.
-- ---------------------------------------------------------------------------

-- create_kitty: a total of zero is allowed for a draft whose bill is about to be scanned.
create or replace function public.create_kitty(
  p_kind public.kitty_kind,
  p_title text,
  p_due_date date,
  p_total_paise bigint,
  p_upi_id text,
  p_members jsonb
) returns public.kitties
language plpgsql security invoker set search_path = '' as $$
declare
  organiser uuid := auth.uid();
  new_kitty public.kitties;
  shares_total bigint;
  member_count int;
  organiser_count int;
begin
  if organiser is null then
    raise exception 'log in to create a kitty' using errcode = '42501';
  end if;
  if p_kind <> 'moment' then
    raise exception 'goal kitties are not available yet' using errcode = 'check_violation';
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

  insert into public.kitties (organiser_id, kind, title, due_date, total_paise, upi_id, amount_source)
  values (organiser, p_kind, btrim(p_title), p_due_date, p_total_paise, lower(btrim(p_upi_id)), 'typed')
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

-- share_kitty: refuse a kitty that still has no total (a scan that never finished).
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

  update public.kitties set status = 'shared' where id = k.id;

  insert into public.payments (kitty_id, member_id, kind, direction, amount_paise)
  select k.id, m.id, 'share', 'in', m.share_paise
  from public.members m
  where m.kitty_id = k.id and m.share_paise > 0;

  update public.payments p set status = 'confirmed'
  from public.members m
  where p.member_id = m.id and m.kitty_id = k.id and m.is_organiser and p.kind = 'share';

  return k.share_slug;
end;
$$;

-- apply_scanned_shares: screen 5's "Done". Sets a draft's total and every share
-- from a checked bill. The shares come from packages/core billSplit; this checks
-- they add up to the bill's lines plus extras.
create function public.apply_scanned_shares(p_kitty_id uuid, p_bill_id uuid, p_shares jsonb)
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
  if k.status <> 'draft' then
    raise exception 'shares are locked once the kitty is shared' using errcode = 'check_violation';
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

  update public.members m set share_paise = (s ->> 'share_paise')::bigint, share_fixed = false
  from jsonb_array_elements(p_shares) s
  where m.id = (s ->> 'member_id')::uuid and m.kitty_id = k.id;

  update public.kitties set total_paise = bill_total, amount_source = 'scanned' where id = k.id;
  update public.bills set status = 'confirmed' where id = b.id;
end;
$$;

revoke execute on function public.apply_scanned_shares(uuid, uuid, jsonb) from public, anon;
grant execute on function public.apply_scanned_shares(uuid, uuid, jsonb) to authenticated;
