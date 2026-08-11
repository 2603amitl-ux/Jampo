-- Email reminders (availability reminder, schedule publish) need a real
-- address to send to — the employees.username/synthetic-email pair used for
-- login is not a deliverable inbox. Optional: a manager can add it later.
alter table employees add column email text;
