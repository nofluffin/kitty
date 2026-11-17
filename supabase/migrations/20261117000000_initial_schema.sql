-- Kitty v1 initial schema (spec section 3).
-- Money is always bigint paise. Enum values match packages/core/src/types.ts.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.kitty_kind as enum ('moment', 'goal');
create type public.amount_source as enum ('typed', 'scanned');
create type public.goal_plan as enum ('single', 'parts');
create type public.kitty_status as enum ('draft', 'shared', 'settling', 'closed', 'cancelled');
create type public.diet as enum ('veg', 'nonveg');
create type public.payment_kind as enum ('share', 'topup', 'refund', 'part');
create type public.payment_direction as enum ('in', 'out');
create type public.payment_status as enum ('requested', 'marked', 'confirmed', 'not_received', 'written_off');
create type public.bill_status as enum ('processing', 'needs_review', 'confirmed', 'failed');
create type public.bill_category as enum ('veg', 'nonveg', 'alcohol', 'unsure');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 16 characters from a 57-letter alphabet with look-alikes (0/O, 1/l/I) removed: about 93 bits.
create function public.generate_share_slug() returns text
language sql volatile set search_path = '' as $$
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789', (get_byte(b, i) % 57) + 1, 1),
    ''
  )
  from extensions.gen_random_bytes(16) as b, generate_series(0, 15) as i
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One per organiser. id is the auth user id.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  phone text,
  upi_id text check (char_length(upi_id) <= 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.kitties (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.profiles (id) on delete cascade,
  kind public.kitty_kind not null,
  title text not null check (char_length(title) between 1 and 80),
  due_date date not null,
  total_paise bigint not null check (total_paise >= 0),
  upi_id text not null check (char_length(upi_id) <= 320),
  amount_source public.amount_source not null default 'typed',
  goal_plan public.goal_plan,
  parts_count integer,
  status public.kitty_status not null default 'draft',
  share_slug text not null unique default public.generate_share_slug() check (char_length(share_slug) >= 12),
  shared_at timestamptz,
  closed_at timestamptz,
  final_bill_paise bigint check (final_bill_paise >= 0),
  remind_day_before boolean not null default false,
  remind_on_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Goals have a plan, moments don't. Parts plans have at least two parts.
  constraint goal_plan_matches_kind check (
    (kind = 'moment' and goal_plan is null and parts_count is null)
    or (kind = 'goal' and goal_plan = 'single' and parts_count is null)
    or (kind = 'goal' and goal_plan = 'parts' and parts_count between 2 and 24)
  )
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  kitty_id uuid not null references public.kitties (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text,
  is_organiser boolean not null default false,
  diet public.diet not null default 'veg',
  drinks boolean not null default false,
  share_paise bigint not null default 0 check (share_paise >= 0),
  share_fixed boolean not null default false,
  -- Not in spec section 3: the member's share after settle up, so screens 17 and 18
  -- can show "Your share" next to what they already paid.
  final_share_paise bigint check (final_share_paise >= 0),
  refund_upi_id text check (char_length(refund_upi_id) <= 320),
  last_opened_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  kitty_id uuid not null references public.kitties (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  kind public.payment_kind not null,
  direction public.payment_direction not null,
  amount_paise bigint not null check (amount_paise > 0),
  due_date date,
  status public.payment_status not null default 'requested',
  marked_at timestamptz,
  confirmed_at timestamptz,
  upi_ref text check (char_length(upi_ref) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Refunds go out from the organiser. Everything else comes in.
  constraint direction_matches_kind check ((kind = 'refund') = (direction = 'out'))
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  kitty_id uuid not null references public.kitties (id) on delete cascade,
  image_paths text[] not null default '{}',
  status public.bill_status not null default 'processing',
  total_paise bigint check (total_paise >= 0),
  -- Tax and service charge minus discounts, so it can be negative.
  extras_paise bigint not null default 0,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bill_lines (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  raw_text text not null default '',
  label text not null default '',
  amount_paise bigint not null check (amount_paise >= 0),
  category public.bill_category not null default 'unsure',
  confidence numeric(3, 2) check (confidence between 0 and 1),
  added_by_hand boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Members have no login. Picking a name sets a cookie holding claim_token (spec section 7).
-- Only server routes read this table, with the service role.
create table public.member_claims (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  claim_token text not null unique check (char_length(claim_token) >= 32),
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (every foreign key, plus the lookups the app makes)
-- ---------------------------------------------------------------------------

create index kitties_organiser_idx on public.kitties (organiser_id, status);
create index members_kitty_idx on public.members (kitty_id, sort_order);
create unique index members_one_organiser_idx on public.members (kitty_id) where is_organiser;
create index payments_kitty_idx on public.payments (kitty_id, status);
create index payments_member_idx on public.payments (member_id);
create index bills_kitty_idx on public.bills (kitty_id);
create index bill_lines_bill_idx on public.bill_lines (bill_id);
create index member_claims_member_idx on public.member_claims (member_id);
create index device_tokens_profile_idx on public.device_tokens (profile_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.kitties for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.members for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bills for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bill_lines for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.member_claims for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.device_tokens for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Business rules the database enforces (mirrors packages/core/src/status.ts)
-- ---------------------------------------------------------------------------

-- Kitty status only moves forward. Sharing and closing stamp their times.
-- Total and kind are locked once the kitty leaves draft.
create function public.check_kitty_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('shared', 'cancelled'))
      or (old.status = 'shared' and new.status in ('settling', 'closed', 'cancelled'))
      or (old.status = 'settling' and new.status = 'closed')
    ) then
      raise exception 'kitty cannot move from % to %', old.status, new.status using errcode = 'check_violation';
    end if;
    if new.status = 'shared' then new.shared_at := coalesce(new.shared_at, now()); end if;
    if new.status = 'closed' then new.closed_at := coalesce(new.closed_at, now()); end if;
  end if;

  if old.status <> 'draft' and (
    new.total_paise is distinct from old.total_paise
    or new.kind is distinct from old.kind
    or new.goal_plan is distinct from old.goal_plan
    or new.parts_count is distinct from old.parts_count
  ) then
    raise exception 'amounts are locked once the kitty is shared' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_kitty_update before update on public.kitties
for each row execute function public.check_kitty_update();

-- Members and their asked-for shares can change only while the kitty is a draft (spec section 4, "Lock").
-- Diet and drinks stay editable: the organiser may fix them when splitting the final bill.
create function public.check_member_lock() returns trigger
language plpgsql set search_path = '' as $$
declare
  kitty_status public.kitty_status;
begin
  select k.status into kitty_status
  from public.kitties k
  where k.id = coalesce(new.kitty_id, old.kitty_id);

  -- The kitty itself is being deleted (cascade).
  if kitty_status is null then
    return coalesce(new, old);
  end if;

  if kitty_status <> 'draft' then
    if tg_op in ('INSERT', 'DELETE') then
      raise exception 'people are locked once the kitty is shared' using errcode = 'check_violation';
    end if;
    if new.share_paise is distinct from old.share_paise
       or new.share_fixed is distinct from old.share_fixed
       or new.kitty_id is distinct from old.kitty_id then
      raise exception 'shares are locked once the kitty is shared' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger check_member_lock before insert or update or delete on public.members
for each row execute function public.check_member_lock();

-- Payment status rules, with times stamped automatically.
create function public.check_payment_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'requested' and new.status in ('marked', 'confirmed', 'written_off'))
      or (old.status = 'marked' and new.status in ('confirmed', 'not_received', 'written_off'))
      or (old.status = 'not_received' and new.status in ('marked', 'confirmed', 'written_off'))
    ) then
      raise exception 'payment cannot move from % to %', old.status, new.status using errcode = 'check_violation';
    end if;
    if new.status = 'marked' then new.marked_at := now(); end if;
    if new.status = 'confirmed' then new.confirmed_at := now(); end if;
  end if;
  if new.amount_paise is distinct from old.amount_paise then
    raise exception 'payment amounts cannot change' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger check_payment_update before update on public.payments
for each row execute function public.check_payment_update();

-- Create a profile when an organiser signs up. Name and mobile number come from
-- sign-up metadata. With SMS login the verified auth phone wins.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 80),
    coalesce(
      case when new.phone is not null and new.phone <> '' then '+' || ltrim(new.phone, '+') end,
      new.raw_user_meta_data ->> 'phone'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security (spec section 12)
-- An organiser can read and change only their own kitties and everything under them.
-- The member web page never touches tables directly: it goes through Next.js server
-- routes using the service role, which bypasses RLS.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.kitties enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.bills enable row level security;
alter table public.bill_lines enable row level security;
alter table public.member_claims enable row level security;
alter table public.device_tokens enable row level security;

-- security definer so policies on child tables don't re-run the kitties policy for every row.
create function public.owns_kitty(target_kitty_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.kitties k
    where k.id = target_kitty_id and k.organiser_id = (select auth.uid())
  )
$$;

revoke execute on function public.owns_kitty(uuid) from public, anon;
grant execute on function public.owns_kitty(uuid) to authenticated;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "own kitties" on public.kitties
  for all to authenticated
  using (organiser_id = (select auth.uid()))
  with check (organiser_id = (select auth.uid()));

create policy "members of own kitties" on public.members
  for all to authenticated
  using (public.owns_kitty(kitty_id))
  with check (public.owns_kitty(kitty_id));

create policy "payments of own kitties" on public.payments
  for all to authenticated
  using (public.owns_kitty(kitty_id))
  with check (public.owns_kitty(kitty_id));

create policy "bills of own kitties" on public.bills
  for all to authenticated
  using (public.owns_kitty(kitty_id))
  with check (public.owns_kitty(kitty_id));

create policy "lines of own bills" on public.bill_lines
  for all to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_id and public.owns_kitty(b.kitty_id)))
  with check (exists (select 1 from public.bills b where b.id = bill_id and public.owns_kitty(b.kitty_id)));

create policy "own device tokens" on public.device_tokens
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- member_claims: no policies on purpose. Only the service role can read or write it.

-- ---------------------------------------------------------------------------
-- Storage: private bucket for bill photos, one folder per kitty: bills/<kitty_id>/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bills', 'bills', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']);

create policy "organisers manage their bill photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'bills'
    and public.owns_kitty(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'bills'
    and public.owns_kitty(((storage.foldername(name))[1])::uuid)
  );
