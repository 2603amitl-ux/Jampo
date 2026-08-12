-- The coworkers/swap-candidates feature on my-schedule needs employee names,
-- but the original employees_select policy only let an employee see their
-- own row (id = auth.uid()) or let a manager see everyone. Widen it so an
-- employee's row also becomes visible to other staff once that employee has
-- an assignment in a published period — i.e. only once they'd actually show
-- up by name on a real printed schedule board, not before.
drop policy employees_select on employees;

create policy employees_select on employees
  for select using (
    id = auth.uid()
    or is_manager()
    or exists (
      select 1 from assignments a
      join shift_instances si on si.id = a.shift_instance_id
      join schedule_periods sp on sp.id = si.schedule_period_id
      where a.employee_id = employees.id and sp.status = 'published'
    )
  );
