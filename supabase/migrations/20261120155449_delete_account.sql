-- Deleting your account from inside the app (App Store rule, step 10).
-- Deleting the auth user cascades to the profile, their kitties (with members,
-- payments, bills and lines), notifications and phones. Bill photos are removed
-- from storage by the app first, through the storage API.
--
-- Functions that need more rights than the caller live in the private schema,
-- which the API doesn't expose; the public functions are thin wrappers.

create function private.delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user;
end;
$$;

revoke execute on function private.delete_account(uuid) from public, anon, authenticated;

-- Only ever deletes the caller: the id comes from their login, not from input.
create function public.delete_my_account() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.delete_account_for_caller();
end;
$$;

create function private.delete_account_for_caller() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.delete_account(auth.uid());
end;
$$;

revoke execute on function private.delete_account_for_caller() from public, anon;
grant execute on function private.delete_account_for_caller() to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- register_device_token, same shape: the elevated part moves to private.
-- ---------------------------------------------------------------------------
create function private.register_device_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'log in first' using errcode = '42501';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'that is not an Expo push token' using errcode = 'check_violation';
  end if;
  delete from public.device_tokens where expo_push_token = p_token and profile_id <> me;
  insert into public.device_tokens (profile_id, expo_push_token, platform)
  values (me, p_token, p_platform)
  on conflict (expo_push_token) do update set platform = excluded.platform, updated_at = now();
end;
$$;

revoke execute on function private.register_device_token(text, text) from public, anon;
grant execute on function private.register_device_token(text, text) to authenticated;

create or replace function public.register_device_token(p_token text, p_platform text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform private.register_device_token(p_token, p_platform);
end;
$$;
