-- Kitties without an amount or date (Raj, 22 Nov 2026).
-- * A kitty can be saved with no total (shares are 0) and no pay by date, as a draft.
-- * It can only be shared once it has both: share_kitty asks for them, and a shared
--   kitty can't lose its date (the check below) or its total (update_kitty already checks).
-- * Paying a goal in parts still needs a date, since the parts are worked back from it.

alter table public.kitties alter column due_date drop not null;
alter table public.kitties add constraint kitties_shared_have_a_date
  check (status = 'draft' or due_date is not null);

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
    -- A goal's target can wait until it's shared, like a moment's total.
    plan := coalesce(p_goal_plan, 'single');
    if plan = 'parts' then
      parts := p_parts_count;
      if p_due_date is null then
        raise exception 'pick a pay by date to pay in parts' using errcode = 'check_violation';
      end if;
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
  if k.due_date is null then
    raise exception 'pick a pay by date before sharing' using errcode = 'check_violation';
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
