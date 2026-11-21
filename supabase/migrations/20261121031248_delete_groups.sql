-- Deleting a group (Raj, 21 Nov 2026): whoever made a group can delete it. It goes from
-- everyone's Kitty, not just theirs. Anyone else can still only leave it.

create function private.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  delete from public.groups where id = p_group and profile_id = me;
  if not found then
    raise exception 'only the person who made a group can delete it' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function private.delete_group(uuid) from public, anon;
grant execute on function private.delete_group(uuid) to authenticated;

create function public.delete_group(p_group uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.delete_group(p_group);
end;
$$;
revoke execute on function public.delete_group(uuid) from public, anon;
grant execute on function public.delete_group(uuid) to authenticated;
