-- Step 4: create a kitty and share it, each in one call so nothing is left half-saved.
-- Both run as the calling organiser (security invoker), so row level security still applies.

-- ---------------------------------------------------------------------------
-- create_kitty: a draft kitty with its people and their shares.
-- p_members is a JSON array in sort order:
--   [{ "name", "phone", "is_organiser", "diet", "drinks", "share_paise", "share_fixed" }]
-- ---------------------------------------------------------------------------
create function public.create_kitty(
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
  if p_total_paise is null or p_total_paise <= 0 then
    raise exception 'the total must be more than zero' using errcode = 'check_violation';
  end if;
  -- A day of slack so a phone a few hours ahead of the server (IST vs UTC) can pick today.
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

  -- Remember the UPI ID to fill in next time (spec section 3, profiles.upi_id).
  update public.profiles set upi_id = new_kitty.upi_id where id = organiser;

  return new_kitty;
end;
$$;

-- ---------------------------------------------------------------------------
-- share_kitty: locks amounts and asks everyone to pay (spec section 4, "Lock").
-- Safe to call twice: sharing an already shared kitty just returns its slug.
-- ---------------------------------------------------------------------------
create function public.share_kitty(p_kitty_id uuid) returns text
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

  -- The organiser's own share is already in their account (decided 17 Nov 2026).
  update public.payments p set status = 'confirmed'
  from public.members m
  where p.member_id = m.id and m.kitty_id = k.id and m.is_organiser and p.kind = 'share';

  return k.share_slug;
end;
$$;

revoke execute on function public.create_kitty(public.kitty_kind, text, date, bigint, text, jsonb) from public, anon;
revoke execute on function public.share_kitty(uuid) from public, anon;
grant execute on function public.create_kitty(public.kitty_kind, text, date, bigint, text, jsonb) to authenticated;
grant execute on function public.share_kitty(uuid) to authenticated;
