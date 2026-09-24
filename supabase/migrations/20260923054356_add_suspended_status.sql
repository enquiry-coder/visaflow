alter table clients drop constraint if exists clients_status_check;
alter table clients add constraint clients_status_check check (status in ('awaiting_input', 'appt_set', 'verified', 'suspended'));