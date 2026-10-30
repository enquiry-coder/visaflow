-- Demo preview user — must exist before the owner-scoped rows below FK auth.users(id).
-- password: rapidnative-demo (editor preview only — real GoTrue cannot verify this hash)
-- role "admin" so the preview (always signed in as this user) sees ALL seeded
-- clients and the management screen, matching the live supervisor/admin view.
insert into auth.users (id, email, raw_user_meta_data, encrypted_password, email_confirmed_at)
values ('00000000-0000-0000-0000-000000000001', 'demo@rapidnative.com', '{"role":"admin","full_name":"Demo Admin"}', 'pbkdf2$100000$52617069644e61746976652044656d6f$ebd41bf86ab4f47040854a1e4968e2fdc414e15db6a4397f3271e1b1d56b2061', now())
on conflict (id) do update
  set email = excluded.email,
      raw_user_meta_data = excluded.raw_user_meta_data,
      encrypted_password = excluded.encrypted_password,
      email_confirmed_at = excluded.email_confirmed_at;

insert into clients (id, user_id, reg_no, salutation, first_name, last_name, phone, country_code, phone_number, nationality, handling_staff, introducer_name, introducer_phone, status, preferred_date, preferred_time, confirmed_time, confirmed_date, zoom_link, follow_up_due, completed_at, submitted_at, invited_at) values
  ('client-1', '00000000-0000-0000-0000-000000000001', 'REG-2026-0001', 'Mr', 'John', 'Carter', '+1 555-0142', '+1', '555-0142', 'United States', 'Sarah Mitchell', 'Alice Wong', '+852 9123 4567', 'awaiting_input', null, null, null, null, null, true, null, null, now() - interval '2 days'),
  ('client-2', '00000000-0000-0000-0000-000000000001', 'REG-2026-0002', 'Ms', 'Priya', 'Sharma', '+44 7700 900123', '+44', '7700 900123', 'India', 'Sarah Mitchell', 'Rahul Mehta', '+91 98100 12345', 'appt_set', '2026-10-03', '14:00', '14:30', '2026-10-03', 'https://zoom.us/j/8123456789', false, null, now() - interval '1 day', now() - interval '3 days'),
  ('client-3', '00000000-0000-0000-0000-000000000001', 'REG-2026-0003', 'Mr', 'Marcus', 'Okafor', '+234 803 555 0199', '+234', '803 555 0199', 'Nigeria', 'Daniel Reyes', 'Chidi Okafor', '+234 701 555 0101', 'verified', '2026-09-28', '11:30', '11:30', '2026-09-28', 'https://zoom.us/j/8323456789', false, now() - interval '2 days', now() - interval '4 days', now() - interval '6 days'),
  ('client-4', '00000000-0000-0000-0000-000000000001', 'REG-2026-0004', 'Ms', 'Elena', 'Rodriguez', '+34 612 345 678', '+34', '612 345 678', 'Spain', 'Daniel Reyes', 'Carmen Ruiz', '+34 699 000 123', 'appt_set', '2026-10-05', '16:00', null, null, null, true, null, now() - interval '6 hours', now() - interval '1 day'),
  ('client-5', '00000000-0000-0000-0000-000000000001', 'REG-2026-0005', 'Mr', 'Ahmed', 'Al-Farsi', '+971 50 555 1234', '+971', '50 555 1234', 'United Arab Emirates', 'Sarah Mitchell', 'Yousef Haddad', '+971 55 111 2222', 'verified', '2026-09-25', '10:30', '10:30', '2026-09-25', 'https://zoom.us/j/8423456789', false, now() - interval '5 days', now() - interval '7 days', now() - interval '9 days'),
  ('client-6', '00000000-0000-0000-0000-000000000001', 'REG-2026-0006', 'Ms', 'Mei', 'Chen', '+86 138 5555 8080', '+86', '138 5555 8080', 'China', 'Daniel Reyes', 'Wei Zhang', '+86 139 0000 8888', 'awaiting_input', null, null, null, null, null, false, null, null, null);
