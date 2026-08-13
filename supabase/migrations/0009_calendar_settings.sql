-- Stores the manager's Google Calendar "secret address in iCal format",
-- used to auto-import events into a new period's date range. A dedicated
-- single-row table (matching shift_presets/certifications), not a generic
-- key-value settings table — there's exactly one setting today.

create table calendar_settings (
  id uuid primary key default gen_random_uuid(),
  ical_url text,
  updated_at timestamptz not null default now()
);

alter table calendar_settings enable row level security;

create policy calendar_settings_select on calendar_settings
  for select using (is_manager());
create policy calendar_settings_update on calendar_settings
  for update using (is_manager()) with check (is_manager());

-- Seed exactly one row (runs as table owner, bypassing RLS) so the app only
-- ever UPDATEs this row and never has to distinguish "first save" from
-- "edit", and can't accidentally create a second row.
insert into calendar_settings (ical_url) values (null);
