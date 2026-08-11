-- Row Level Security for the Jampo scheduling system.
-- Every table is scoped so an employee can only see/edit their own rows;
-- the manager role has full access everywhere.

-- ---------------------------------------------------------------------------
-- helper: is_manager() — SECURITY DEFINER so it can read `employees` without
-- being blocked by that table's own RLS policy (avoids recursive lookups).
-- ---------------------------------------------------------------------------
create or replace function is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from employees
    where id = auth.uid() and role = 'manager'
  );
$$;

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
alter table employees enable row level security;

create policy employees_select on employees
  for select using (id = auth.uid() or is_manager());

create policy employees_insert on employees
  for insert with check (is_manager());

create policy employees_update on employees
  for update using (is_manager()) with check (is_manager());

-- ---------------------------------------------------------------------------
-- shift_presets — manager only (template not exposed to employees)
-- ---------------------------------------------------------------------------
alter table shift_presets enable row level security;

create policy shift_presets_select on shift_presets
  for select using (is_manager());
create policy shift_presets_insert on shift_presets
  for insert with check (is_manager());
create policy shift_presets_update on shift_presets
  for update using (is_manager()) with check (is_manager());
create policy shift_presets_delete on shift_presets
  for delete using (is_manager());

-- ---------------------------------------------------------------------------
-- schedule_periods — every logged-in user can read (needed to know the
-- current period's dates/status); only the manager can write
-- ---------------------------------------------------------------------------
alter table schedule_periods enable row level security;

create policy schedule_periods_select on schedule_periods
  for select using (auth.uid() is not null);
create policy schedule_periods_insert on schedule_periods
  for insert with check (is_manager());
create policy schedule_periods_update on schedule_periods
  for update using (is_manager()) with check (is_manager());
create policy schedule_periods_delete on schedule_periods
  for delete using (is_manager());

-- ---------------------------------------------------------------------------
-- shift_instances — every logged-in user can read (needed to submit
-- availability); only the manager can write
-- ---------------------------------------------------------------------------
alter table shift_instances enable row level security;

create policy shift_instances_select on shift_instances
  for select using (auth.uid() is not null);
create policy shift_instances_insert on shift_instances
  for insert with check (is_manager());
create policy shift_instances_update on shift_instances
  for update using (is_manager()) with check (is_manager());
create policy shift_instances_delete on shift_instances
  for delete using (is_manager());

-- ---------------------------------------------------------------------------
-- availability — employees manage only their own rows, and only while the
-- period is in 'collecting' status; the manager can see/edit everything
-- ---------------------------------------------------------------------------
alter table availability enable row level security;

create policy availability_select on availability
  for select using (employee_id = auth.uid() or is_manager());

create policy availability_insert on availability
  for insert with check (
    is_manager()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from shift_instances si
        join schedule_periods sp on sp.id = si.schedule_period_id
        where si.id = shift_instance_id and sp.status = 'collecting'
      )
    )
  );

create policy availability_update on availability
  for update using (
    is_manager()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from shift_instances si
        join schedule_periods sp on sp.id = si.schedule_period_id
        where si.id = shift_instance_id and sp.status = 'collecting'
      )
    )
  ) with check (
    is_manager() or employee_id = auth.uid()
  );

create policy availability_delete on availability
  for delete using (
    is_manager()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from shift_instances si
        join schedule_periods sp on sp.id = si.schedule_period_id
        where si.id = shift_instance_id and sp.status = 'collecting'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- weekly_shift_requests — same rules as availability
-- ---------------------------------------------------------------------------
alter table weekly_shift_requests enable row level security;

create policy weekly_requests_select on weekly_shift_requests
  for select using (employee_id = auth.uid() or is_manager());

create policy weekly_requests_insert on weekly_shift_requests
  for insert with check (
    is_manager()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from schedule_periods sp
        where sp.id = schedule_period_id and sp.status = 'collecting'
      )
    )
  );

create policy weekly_requests_update on weekly_shift_requests
  for update using (
    is_manager()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from schedule_periods sp
        where sp.id = schedule_period_id and sp.status = 'collecting'
      )
    )
  ) with check (
    is_manager() or employee_id = auth.uid()
  );

create policy weekly_requests_delete on weekly_shift_requests
  for delete using (is_manager());

-- ---------------------------------------------------------------------------
-- assignments — employees see only their own rows, and only once the period
-- is 'published'; only the manager (or the server-side algorithm, which
-- runs with the service role key and bypasses RLS) can write
-- ---------------------------------------------------------------------------
alter table assignments enable row level security;

create policy assignments_select on assignments
  for select using (
    is_manager()
    or (
      employee_id = auth.uid()
      and exists (
        select 1 from shift_instances si
        join schedule_periods sp on sp.id = si.schedule_period_id
        where si.id = shift_instance_id and sp.status = 'published'
      )
    )
  );

create policy assignments_insert on assignments
  for insert with check (is_manager());
create policy assignments_update on assignments
  for update using (is_manager()) with check (is_manager());
create policy assignments_delete on assignments
  for delete using (is_manager());
