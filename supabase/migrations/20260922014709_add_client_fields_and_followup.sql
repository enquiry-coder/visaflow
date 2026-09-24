alter table clients add column if not exists salutation text;
alter table clients add column if not exists nationality text;
alter table clients add column if not exists completed_at timestamptz;
alter table clients add column if not exists follow_up_due boolean not null default false;

-- Back-fill completed_at for already-verified rows so the "completed" list has a sort key.
update clients set completed_at = updated_at where status = 'verified' and completed_at is null;
