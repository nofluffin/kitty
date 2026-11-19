-- Supabase advisors (first production push, 19 Nov 2026) flagged two SECURITY DEFINER
-- helpers that could be called directly through the public API. Neither is meant to be.

-- 1. handle_new_user only runs as the sign-up trigger. Triggers don't need EXECUTE
--    for the signing-up user, so nobody needs to call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2. owns_kitty is a helper for row level security. Move it out of the exposed
--    public schema into a private one. Policies refer to functions by their internal
--    id, so every existing policy keeps working after the move.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.owns_kitty(uuid) set schema private;

revoke execute on function private.owns_kitty(uuid) from public, anon;
grant execute on function private.owns_kitty(uuid) to authenticated;
