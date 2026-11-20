-- Paying for someone else (decided with Raj, 20 Nov 2026): a parent pays a child's
-- share, for example. The child stays a person in the kitty with their own food and
-- drink settings, so the split is right, but their share is asked of whoever pays for them.

alter table public.members
  add column paid_by_member_id uuid references public.members (id) on delete set null,
  add constraint not_paid_by_self check (paid_by_member_id is distinct from id);

create index members_paid_by_idx on public.members (paid_by_member_id);

comment on column public.members.paid_by_member_id is
  'Who pays this person''s share. Null: they pay it themselves.';

-- Payers pay for themselves, in the same kitty. No chains.
create function private.check_paid_by() returns trigger
language plpgsql set search_path = '' as $$
declare
  payer public.members;
begin
  if new.paid_by_member_id is null then
    return new;
  end if;
  select * into payer from public.members where id = new.paid_by_member_id;
  if payer.kitty_id is distinct from new.kitty_id or payer.paid_by_member_id is not null
     or exists (select 1 from public.members where paid_by_member_id = new.id) then
    raise exception 'someone who pays for others must pay for themselves' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_paid_by before insert or update of paid_by_member_id on public.members
for each row execute function private.check_paid_by();

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
     or new.paid_by_member_id is distinct from old.paid_by_member_id
     or new.kitty_id is distinct from old.kitty_id then
    raise exception 'shares are locked once someone has paid' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function private.check_kitty_input(
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
  -- Paying for someone else: "paid_by_index" points at the payer's place in the list.
  -- Payers pay for themselves (no chains), and nobody pays for the organiser.
  if exists (
    select 1 from jsonb_array_elements(p_members) with ordinality as t(m, ord)
    where m ->> 'paid_by_index' is not null and (
      (m ->> 'paid_by_index')::int not between 0 and member_count - 1
      or (m ->> 'paid_by_index')::int = ord - 1
      or coalesce((m ->> 'is_organiser')::boolean, false)
      or (p_members -> ((m ->> 'paid_by_index')::int)) ->> 'paid_by_index' is not null
    )
  ) then
    raise exception 'someone who pays for others must pay for themselves' using errcode = 'check_violation';
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
    where m ->> 'paid_by_index' is null and (m ->> 'share_paise')::bigint between 1 and parts - 1
  ) then
    raise exception 'a share is too small to split into % parts', parts using errcode = 'check_violation';
  end if;
end;
$$;

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


  -- Who pays for whom, now every row exists (sort_order is the place in the list).
  update public.members x set paid_by_member_id = p.id
  from jsonb_array_elements(p_members) with ordinality as t(m, ord)
  join public.members p on p.kitty_id = new_kitty.id and p.sort_order = (m ->> 'paid_by_index')::int
  where x.kitty_id = new_kitty.id and x.sort_order = (ord - 1)::int and m ->> 'paid_by_index' is not null;

  update public.profiles set upi_id = new_kitty.upi_id where id = organiser;
  return new_kitty;
end;
$$;

create or replace function public.update_kitty(
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
  update public.members set paid_by_member_id = null where kitty_id = k.id and paid_by_member_id is not null;

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


  -- Who pays for whom, now every row exists (sort_order is the place in the list).
  update public.members x set paid_by_member_id = p.id
  from jsonb_array_elements(p_members) with ordinality as t(m, ord)
  join public.members p on p.kitty_id = k.id and p.sort_order = (m ->> 'paid_by_index')::int
  where x.kitty_id = k.id and x.sort_order = (ord - 1)::int and m ->> 'paid_by_index' is not null;

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

create or replace function private.request_payments(p_kitty_id uuid) returns void
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
    select k.id, g.payer_id, 'part', 'in',
           case when i = k.parts_count
                then g.total - (g.total / k.parts_count) * (k.parts_count - 1)
                else g.total / k.parts_count end,
           (k.due_date - make_interval(months => k.parts_count - i))::date
    from (
      select coalesce(m.paid_by_member_id, m.id) as payer_id, sum(m.share_paise)::bigint as total
      from public.members m where m.kitty_id = k.id group by 1
    ) g
    cross join generate_series(1, k.parts_count) as i
    where g.total > 0;
  else
    insert into public.payments (kitty_id, member_id, kind, direction, amount_paise)
    select k.id, g.payer_id, 'share', 'in', g.total
    from (
      select coalesce(m.paid_by_member_id, m.id) as payer_id, sum(m.share_paise)::bigint as total
      from public.members m where m.kitty_id = k.id group by 1
    ) g
    where g.total > 0;
  end if;

  -- The organiser's own share is their own money: confirmed straight away.
  update public.payments p set status = 'confirmed'
  from public.members m
  where p.member_id = m.id and m.kitty_id = k.id and m.is_organiser and p.kind in ('share', 'part');
end;
$$;

create or replace function public.settle_kitty(p_kitty_id uuid, p_final_bill_paise bigint, p_shares jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  k public.kitties;
  given int;
  matched int;
  member_total int;
  shares_total bigint;
  waiting int;
begin
  select * into k from public.kitties where id = p_kitty_id for update;
  if not found then
    raise exception 'kitty not found' using errcode = 'no_data_found';
  end if;
  if k.status <> 'shared' then
    raise exception 'only a shared kitty can be settled, this one is %', k.status using errcode = 'check_violation';
  end if;
  if p_final_bill_paise is null or p_final_bill_paise <= 0 then
    raise exception 'the final bill must be more than zero' using errcode = 'check_violation';
  end if;

  -- Decided 20 Nov 2026: payments people say they've made are confirmed (or not) first,
  -- so top-ups and refunds are worked out from money that really arrived.
  select count(*) into waiting from public.payments
  where kitty_id = k.id and direction = 'in' and kind in ('share', 'part') and status = 'marked';
  if waiting > 0 then
    raise exception 'confirm the % payment(s) people have marked as paid first', waiting using errcode = 'check_violation';
  end if;

  select count(*), coalesce(sum((s ->> 'share_paise')::bigint), 0)
    into given, shares_total
  from jsonb_array_elements(p_shares) s;
  select count(*) into member_total from public.members where kitty_id = k.id;
  select count(distinct m.id) into matched
  from jsonb_array_elements(p_shares) s
  join public.members m on m.id = (s ->> 'member_id')::uuid and m.kitty_id = k.id;
  if given <> member_total or matched <> member_total then
    raise exception 'give a new share for every person in the kitty, once each' using errcode = 'check_violation';
  end if;
  if exists (select 1 from jsonb_array_elements(p_shares) s where (s ->> 'share_paise')::bigint < 0) then
    raise exception 'shares cannot be negative' using errcode = 'check_violation';
  end if;
  if shares_total <> p_final_bill_paise then
    raise exception 'new shares add up to % paise but the final bill is % paise', shares_total, p_final_bill_paise
      using errcode = 'check_violation';
  end if;

  update public.members m set final_share_paise = (s ->> 'share_paise')::bigint
  from jsonb_array_elements(p_shares) s
  where m.id = (s ->> 'member_id')::uuid and m.kitty_id = k.id;

  -- Whatever is still owed on the original shares is replaced by the new difference.
  -- Written-off amounts are stored, not deleted (spec section 4).
  update public.payments set status = 'written_off'
  where kitty_id = k.id and direction = 'in' and kind in ('share', 'part') and status in ('requested', 'not_received');

  -- difference = new share - confirmed amount paid. Positive: top-up. Negative: refund.
  -- The organiser's own share needs no payment: it's their own money.
  insert into public.payments (kitty_id, member_id, kind, direction, amount_paise)
  select k.id, d.payer_id,
         case when d.diff > 0 then 'topup'::public.payment_kind else 'refund'::public.payment_kind end,
         case when d.diff > 0 then 'in'::public.payment_direction else 'out'::public.payment_direction end,
         abs(d.diff)
  from (
    -- Per payer: their new share plus those of anyone they pay for, minus what they've paid.
    select g.payer_id, g.final_total - coalesce(paid.net, 0) as diff
    from (
      select coalesce(m.paid_by_member_id, m.id) as payer_id, sum(m.final_share_paise)::bigint as final_total
      from public.members m where m.kitty_id = k.id group by 1
    ) g
    join public.members pm on pm.id = g.payer_id and not pm.is_organiser
    left join lateral (
      select sum(case when p.direction = 'in' then p.amount_paise else -p.amount_paise end) as net
      from public.payments p where p.member_id = g.payer_id and p.status = 'confirmed'
    ) paid on true
  ) d
  where d.diff <> 0;

  update public.kitties
  set final_bill_paise = p_final_bill_paise, status = 'settling'
  where id = k.id;
end;
$$;
