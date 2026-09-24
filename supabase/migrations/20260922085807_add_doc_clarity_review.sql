alter table clients
  add column if not exists passport_clarity text,
  add column if not exists address_clarity text,
  add column if not exists docs_verified_at timestamp with time zone;

-- Clarity values are either 'ok' or 'unclear' (null means "not reviewed yet").
