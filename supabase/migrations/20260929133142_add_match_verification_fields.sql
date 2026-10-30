alter table clients add column if not exists matched_at timestamptz;
alter table clients add column if not exists matched_by text;