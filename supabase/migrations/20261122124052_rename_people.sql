-- Renaming someone in a group (Raj, 22 Nov 2026): the new name also shows in your other
-- groups and in your kitties where nobody has paid yet. Kitties someone has paid into keep
-- the old name, as a record.
--
-- People are copied into each group and kitty, so the same person is found by mobile number,
-- or by their old name when neither copy has a number.
-- Groups someone else also holds aren't changed: a group never changes for anyone else.

create function private.rename_people(p_renames jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r jsonb;
  v_old text;
  v_new text;
  v_phone text;
  n integer;
  groups_changed integer := 0;
  kitties_changed integer := 0;
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  if jsonb_typeof(p_renames) is distinct from 'array' then
    raise exception 'renames must be a list' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_renames) loop
    v_old := btrim(r ->> 'old_name');
    v_new := btrim(r ->> 'new_name');
    v_phone := nullif(btrim(coalesce(r ->> 'phone', '')), '');
    if v_old is null or v_new is null or v_old = '' or v_new = '' or v_old = v_new then
      continue;
    end if;
    if char_length(v_new) > 80 then
      raise exception 'names are 80 characters at most' using errcode = '22023';
    end if;

    -- Your other groups, if only you hold them. Your own row is never renamed.
    update public.group_members gm
    set name = v_new
    where gm.profile_id is distinct from me
      and gm.name <> v_new
      and (case when v_phone is not null then gm.phone = v_phone
                else gm.phone is null and lower(btrim(gm.name)) = lower(v_old) end)
      and exists (select 1 from public.group_holders h where h.group_id = gm.group_id and h.profile_id = me)
      and not exists (select 1 from public.group_holders h where h.group_id = gm.group_id and h.profile_id <> me);
    get diagnostics n = row_count;
    groups_changed := groups_changed + n;

    -- Your kitties where nobody has paid yet.
    update public.members m
    set name = v_new
    from public.kitties k
    where k.id = m.kitty_id
      and k.organiser_id = me
      and not m.is_organiser
      and m.name <> v_new
      and (k.status = 'draft' or (k.status = 'shared' and not private.kitty_has_payments(k.id)))
      and (case when v_phone is not null then m.phone = v_phone
                else m.phone is null and lower(btrim(m.name)) = lower(v_old) end);
    get diagnostics n = row_count;
    kitties_changed := kitties_changed + n;
  end loop;

  return jsonb_build_object('group_people', groups_changed, 'kitty_people', kitties_changed);
end;
$$;
revoke execute on function private.rename_people(jsonb) from public, anon;
grant execute on function private.rename_people(jsonb) to authenticated;

create function public.rename_people(p_renames jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  return private.rename_people(p_renames);
end;
$$;
revoke execute on function public.rename_people(jsonb) from public, anon;
grant execute on function public.rename_people(jsonb) to authenticated;
