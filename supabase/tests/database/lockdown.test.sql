-- Helper functions stay out of the public API (Supabase advisors, 19 Nov 2026).
begin;
select plan(5);
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'signed-out visitors cannot call handle_new_user');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'signed-in users cannot call handle_new_user');
select hasnt_function('public', 'owns_kitty', array['uuid'], 'owns_kitty is not in the public API');
select has_function('private', 'owns_kitty', array['uuid'], 'owns_kitty lives in the private schema');
select ok(not has_function_privilege('anon', 'private.owns_kitty(uuid)', 'execute'), 'signed-out visitors cannot call owns_kitty');
select * from finish();
rollback;
