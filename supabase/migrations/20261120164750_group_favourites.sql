-- The groups screen (Raj, 20 Nov 2026): favourites and recently used, per organiser.
alter table public.group_holders
  add column favourite boolean not null default false,
  add column last_used_at timestamptz;

create policy "star and use your groups" on public.group_holders for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke update on public.group_holders from authenticated;
grant update (favourite, last_used_at) on public.group_holders to authenticated;
