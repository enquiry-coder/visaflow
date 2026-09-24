-- ============================================================
-- VisaFlow — LIVE Supabase setup (paste into Supabase SQL Editor)
-- Project: karvvfgndtvrljaudnln.supabase.co
-- This recreates the full schema + policies + bucket + seed data.
-- ============================================================

-- 1) clients table
create table if not exists public.clients (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reg_no text not null unique,
  salutation text,
  first_name text not null,
  last_name text not null,
  phone text not null,
  country_code text,
  phone_number text,
  nationality text,
  handling_staff text not null,
  status text not null default 'awaiting_input' check (status in ('awaiting_input', 'appt_set', 'verified', 'suspended')),
  passport_url text,
  address_proof_url text,
  preferred_date date,
  preferred_time text,
  zoom_link text,
  capture_url text,
  completed_at timestamptz,
  follow_up_due boolean not null default false,
  confirmed_time text,
  confirmed_date date,
  submitted_at timestamptz,
  invited_at timestamptz,
  passport_clarity text,
  address_clarity text,
  docs_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients (user_id);
create index if not exists clients_status_idx on public.clients (status);

-- Allow the 'suspended' status on tables created by an earlier run of this script.
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check check (status in ('awaiting_input', 'appt_set', 'verified', 'suspended'));

-- 2) row level security
alter table public.clients enable row level security;

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (auth.uid() = user_id or true);

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (auth.uid() = user_id);

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update using (true);

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete using (auth.uid() = user_id);

-- 3) updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- 4) storage bucket for client document uploads
insert into storage.buckets (id, name, public)
values ('client-docs', 'client-docs', true)
on conflict (id) do nothing;

drop policy if exists "client-docs public read" on storage.objects;
create policy "client-docs public read"
  on storage.objects for select
  using (bucket_id = 'client-docs');

drop policy if exists "client-docs public insert" on storage.objects;
create policy "client-docs public insert"
  on storage.objects for insert
  with check (bucket_id = 'client-docs');

-- ============================================================
-- 5) CREATE A STAFF USER  (do this section, then run the seed below)
--    This creates one staff account you can log in with.
--    Copy the "id" that prints, then paste it into the seed hook below.
-- ============================================================

-- Creates user:  staff@probizn.com  /  password: Spider33Man
-- (Supabase will send a confirmation email by default; you can also
--  "confirm" the user here so they can log in immediately.)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000aa',
  'staff@probizn.com',
  crypt('Spider33Man', gen_salt('bf')),
  now(),
  '{"role":"staff"}'
)
on conflict (id) do nothing;

-- Additional preliminary staff users:
--   Hazel  /  hazel@probizn.com  /  password: Spider33Man
--   Iris   /  iris@probizn.com   /  password: Spider33Man
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000ab',
   'hazel@probizn.com',
   crypt('Spider33Man', gen_salt('bf')),
   now(),
   '{"role":"staff","full_name":"Hazel"}'),
  ('00000000-0000-0000-0000-0000000000ac',
   'iris@probizn.com',
   crypt('Spider33Man', gen_salt('bf')),
   now(),
   '{"role":"staff","full_name":"Iris"}')
on conflict (id) do nothing;

-- Administrator:  Terence  /  terence@probizn.com  /  password: Spider33Man
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-0000000000ad',
  'terence@probizn.com',
  crypt('Spider33Man', gen_salt('bf')),
  now(),
  '{"role":"admin","full_name":"Terence"}'
)
on conflict (id) do nothing;

-- Reset passwords reliably (idempotent) — in case the users above already
-- exist with an older password, this forces the current one.
update auth.users
set encrypted_password = crypt('Spider33Man', gen_salt('bf'))
where email in ('staff@probizn.com', 'hazel@probizn.com', 'iris@probizn.com', 'terence@probizn.com');

-- Print the staff user ids so you can paste them in step 6:
select id, email from auth.users where email in ('staff@probizn.com', 'hazel@probizn.com', 'iris@probizn.com', 'terence@probizn.com');

-- ============================================================
-- 6) SEED DATA  (6 realistic clients across all stages)
--    Uses the literal staff UUID (00000000-0000-0000-0000-0000000000aa)
--    so this runs cleanly in the Supabase SQL Editor (no $ delimiters).
-- ============================================================

insert into public.clients (
  id, user_id, reg_no, salutation, first_name, last_name, phone, country_code,
  phone_number, nationality, handling_staff, status, preferred_date, preferred_time,
  confirmed_time, confirmed_date, zoom_link, follow_up_due, completed_at, submitted_at, invited_at,
  passport_clarity, address_clarity, docs_verified_at
) values
  ('client-1', '00000000-0000-0000-0000-0000000000aa', 'REG-2026-0001', 'Mr', 'John', 'Carter', '+1 555-0142', '+1', '555-0142', 'United States', 'Sarah Mitchell', 'awaiting_input', null, null, null, null, null, true, null, null, now() - interval '2 days', null, null, null),
  ('client-2', '00000000-0000-0000-0000-0000000000aa', 'REG-2026-0002', 'Ms', 'Priya', 'Sharma', '+44 7700 900123', '+44', '7700 900123', 'India', 'Sarah Mitchell', 'appt_set', '2026-10-03', '2:00 PM', '2:30 PM', '2026-10-03', 'https://zoom.us/j/8123456789', false, null, now() - interval '1 day', now() - interval '3 days', 'ok', 'ok', now() - interval '1 day'),
  ('client-3', '00000000-0000-0000-0000-0000000000aa', 'REG-2026-0003', 'Mr', 'Marcus', 'Okafor', '+234 803 555 0199', '+234', '803 555 0199', 'Nigeria', 'Daniel Reyes', 'verified', '2026-09-28', '11:30 AM', '11:30 AM', '2026-09-28', 'https://zoom.us/j/8323456789', false, now() - interval '2 days', now() - interval '4 days', now() - interval '6 days', 'ok', 'ok', now() - interval '4 days'),
  ('client-4', '00000000-0000-0000-0000-0000000000aa', 'REG-2026-0004', 'Ms', 'Elena', 'Rodriguez', '+34 612 345 678', '+34', '612 345 678', 'Spain', 'Daniel Reyes', 'appt_set', '2026-10-05', '4:00 PM', null, null, null, true, null, now() - interval '6 hours', now() - interval '1 day', 'unclear', null, null),
  ('client-5', '00000000-0000-0000-0000-0000000000aa', 'REG-2026-0005', 'Mr', 'Ahmed', 'Al-Farsi', '+971 50 555 1234', '+971', '50 555 1234', 'United Arab Emirates', 'Sarah Mitchell', 'verified', '2026-09-25', '10:30 AM', '10:30 AM', '2026-09-25', 'https://zoom.us/j/8423456789', false, now() - interval '5 days', now() - interval '7 days', now() - interval '9 days', 'ok', 'ok', now() - interval '7 days'),
  ('client-6', '00000000-0000-0000-0000-0000000000aa', 'REG-2026-0006', 'Ms', 'Mei', 'Chen', '+86 138 5555 8080', '+86', '138 5555 8080', 'China', 'Daniel Reyes', 'awaiting_input', null, null, null, null, null, false, null, null, null, null, null, null)
on conflict (id) do nothing;
