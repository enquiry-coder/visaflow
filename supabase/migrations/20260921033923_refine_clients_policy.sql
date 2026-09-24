drop policy if exists clients_update on clients;
create policy clients_update on clients for update using (true);