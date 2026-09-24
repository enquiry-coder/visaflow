create table if not exists clients (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reg_no text not null unique,
  first_name text not null,
  last_name text not null,
  phone text not null,
  handling_staff text not null,
  status text not null default 'awaiting_input' check (status in ('awaiting_input', 'appt_set', 'verified')),
  passport_url text,
  address_proof_url text,
  preferred_date date,
  preferred_time text,
  zoom_link text,
  capture_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_user_id_idx on clients(user_id);
create index if not exists clients_status_idx on clients(status);

alter table clients enable row level security;
drop policy if exists clients_select on clients;
create policy clients_select on clients for select using (auth.uid() = user_id or true);
drop policy if exists clients_insert on clients;
create policy clients_insert on clients for insert with check (auth.uid() = user_id);
drop policy if exists clients_update on clients;
create policy clients_update on clients for update using (true);
drop policy if exists clients_delete on clients;
create policy clients_delete on clients for delete using (auth.uid() = user_id);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_updated_at on clients;
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();