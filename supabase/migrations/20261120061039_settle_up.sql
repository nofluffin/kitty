-- Step 7: settle up (spec section 4, screens 12, 13, 17, 18).
-- Both functions run as the calling organiser (security invoker), so row level
-- security still applies: an organiser can only settle their own kitties.

-- ---------------------------------------------------------------------------
-- settle_kitty: record the final bill and each person's new share, then ask for
-- top-ups and send refunds. The app works the shares out with packages/core
-- (typed amounts stay fixed, the rest split equally, decided 20 Nov 2026);
-- this function checks they add up to the bill to the paisa.
-- p_shares: [{ "member_id": uuid, "share_paise": number }, ...] covering every member.
-- ---------------------------------------------------------------------------
create function public.settle_kitty(p_kitty_id uuid, p_final_bill_paise bigint, p_shares jsonb)
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
  select k.id, d.member_id,
         case when d.diff > 0 then 'topup'::public.payment_kind else 'refund'::public.payment_kind end,
         case when d.diff > 0 then 'in'::public.payment_direction else 'out'::public.payment_direction end,
         abs(d.diff)
  from (
    select m.id as member_id,
           m.final_share_paise - coalesce((
             select sum(case when p.direction = 'in' then p.amount_paise else -p.amount_paise end)
             from public.payments p where p.member_id = m.id and p.status = 'confirmed'
           ), 0) as diff
    from public.members m
    where m.kitty_id = k.id and not m.is_organiser
  ) d
  where d.diff <> 0;

  update public.kitties
  set final_bill_paise = p_final_bill_paise, status = 'settling'
  where id = k.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- close_kitty: close when everyone is square. With p_write_off, close anyway and
-- record whatever is still outstanding as written off (screen 13).
-- ---------------------------------------------------------------------------
create function public.close_kitty(p_kitty_id uuid, p_write_off boolean default false)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  k public.kitties;
  outstanding int;
begin
  select * into k from public.kitties where id = p_kitty_id for update;
  if not found then
    raise exception 'kitty not found' using errcode = 'no_data_found';
  end if;
  if k.status not in ('shared', 'settling') then
    raise exception 'this kitty is % and cannot be closed', k.status using errcode = 'check_violation';
  end if;

  select count(*) into outstanding from public.payments
  where kitty_id = k.id and status in ('requested', 'marked', 'not_received');
  if outstanding > 0 and not p_write_off then
    raise exception '% payment(s) still open: settle them or close and write them off', outstanding
      using errcode = 'check_violation';
  end if;

  update public.payments set status = 'written_off'
  where kitty_id = k.id and status in ('requested', 'marked', 'not_received');

  update public.kitties set status = 'closed' where id = k.id;
end;
$$;

revoke execute on function public.settle_kitty(uuid, bigint, jsonb) from public, anon;
revoke execute on function public.close_kitty(uuid, boolean) from public, anon;
grant execute on function public.settle_kitty(uuid, bigint, jsonb) to authenticated;
grant execute on function public.close_kitty(uuid, boolean) to authenticated;
