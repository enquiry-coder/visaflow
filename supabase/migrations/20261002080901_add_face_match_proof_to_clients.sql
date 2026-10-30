alter table clients add column if not exists face_match text;
alter table clients add column if not exists face_match_at timestamptz;