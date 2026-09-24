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
