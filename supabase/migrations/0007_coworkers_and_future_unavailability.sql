-- Two additions:
-- 1. Once a period is published, its assignments/availability become
--    "public" among staff (like a printed schedule board) so employees can
--    see who they're working with and who wanted a shift but didn't get it.
-- 2. employee_unavailability — a period-independent way for employees to
--    flag future dates they can't work (vacation/medical/etc.), visible only
--    to themselves and the manager.

-- ---------------------------------------------------------------------------
-- assignments — widen select so any authenticated employee can see everyone's
-- assignments once the period is published (previously employee_id = auth.uid()
-- only). Manager and insert/update/delete rules are unchanged.
-- ---------------------------------------------------------------------------
drop policy assignments_select on assignments;

create policy assignments_select on assignments
  for select using (
    is_manager()
    or exists (
      select 1 from shift_instances si
      join schedule_periods sp on sp.id = si.schedule_period_id
      where si.id = shift_instance_id and sp.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- availability — same widening, needed so an employee can see who else
-- wanted a shift (to know who to ask about swapping). Only exposed once the
-- period is published, so picks stay private while still being decided.
-- ---------------------------------------------------------------------------
drop policy availability_select on availability;

create policy availability_select on availability
  for select using (
    employee_id = auth.uid()
    or is_manager()
    or exists (
      select 1 from shift_instances si
      join schedule_periods sp on sp.id = si.schedule_period_id
      where si.id = shift_instance_id and sp.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- employee_unavailability — "I can't work these dates" heads-up, independent
-- of any specific schedule_period
-- ---------------------------------------------------------------------------
create table employee_unavailability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_unavailability_employee on employee_unavailability (employee_id);
create index idx_unavailability_dates on employee_unavailability (start_date, end_date);

alter table employee_unavailability enable row level security;

create policy unavailability_select on employee_unavailability
  for select using (employee_id = auth.uid() or is_manager());

create policy unavailability_insert on employee_unavailability
  for insert with check (employee_id = auth.uid() or is_manager());

create policy unavailability_delete on employee_unavailability
  for delete using (employee_id = auth.uid() or is_manager());
