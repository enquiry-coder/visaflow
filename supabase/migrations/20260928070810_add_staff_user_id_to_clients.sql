alter table clients add column if not exists staff_user_id uuid references auth.users(id) on delete set null;
create index if not exists clients_staff_user_id_idx on clients(staff_user_id);
