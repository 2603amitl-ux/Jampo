-- Availability is now a single "I want this shift" toggle rather than an
-- explicit available/unavailable pair, so unselecting a shift means
-- deleting the row — the employee needs delete rights on their own rows
-- (previously only the manager had them), still gated to the collecting
-- window like insert/update.
drop policy if exists availability_delete on availability;

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
