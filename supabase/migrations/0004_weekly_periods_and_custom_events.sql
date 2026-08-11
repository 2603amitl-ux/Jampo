-- Periods are now one week (not two), and "events" are no longer limited to
-- bumping an existing shift_instance for the same date/shift_name — a
-- manager can add a fully custom ad-hoc shift (its own hours, headcount,
-- certifications) directly. shift_instances already had is_event/event_note
-- for exactly this, so the separate events table (and its "must match an
-- existing shift" constraint) is no longer needed.

alter table weekly_shift_requests drop column week_number cascade;
alter table weekly_shift_requests
  add constraint weekly_shift_requests_employee_period_key unique (employee_id, schedule_period_id);

drop table if exists events;
