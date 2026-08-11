-- Jampo scheduling system — initial schema
-- Employees authenticate via Supabase Auth (auth.users), using a synthetic
-- email of the form "{username}@jampo.internal" so the product can expose a
-- username+password login UI without the app storing/hashing passwords itself.
-- employees.id === auth.users.id (1:1).

create extension if not exists "pgcrypto";

create type employee_role as enum ('manager', 'employee');

create type certification as enum ('כללי', 'באנג''י', 'טרקטורון');

create type period_status as enum ('draft', 'collecting', 'generated', 'published');

create type assigned_by_type as enum ('algorithm', 'manager');

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table employees (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  username text not null unique,
  role employee_role not null default 'employee',
  certifications certification[] not null default '{}',
  priority integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shift_presets — recurring weekly template, edited by the manager
-- ---------------------------------------------------------------------------
create table shift_presets (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  shift_name text not null,
  start_time time not null,
  end_time time not null,
  base_headcount integer not null check (base_headcount >= 0),
  required_certifications certification[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- schedule_periods — a one-week planning cycle
-- ---------------------------------------------------------------------------
create table schedule_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  status period_status not null default 'draft',
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);

-- ---------------------------------------------------------------------------
-- shift_instances — actual shifts for a specific period, generated from
-- shift_presets and adjusted by events / manual manager edits
-- ---------------------------------------------------------------------------
create table shift_instances (
  id uuid primary key default gen_random_uuid(),
  schedule_period_id uuid not null references schedule_periods (id) on delete cascade,
  date date not null,
  shift_name text not null,
  start_time time not null,
  end_time time not null,
  required_headcount integer not null check (required_headcount >= 0),
  required_certifications certification[] not null default '{}',
  is_event boolean not null default false,
  event_note text,
  created_at timestamptz not null default now()
);

create index idx_shift_instances_period on shift_instances (schedule_period_id);
create index idx_shift_instances_date on shift_instances (date);

-- Ad-hoc events (e.g. a birthday party needing extra staff at a specific,
-- possibly non-standard, time) are just shift_instances with is_event=true
-- and their own start_time/end_time/required_headcount/required_certifications
-- — no separate table needed.

-- ---------------------------------------------------------------------------
-- availability — employee's yes/no per shift_instance
-- ---------------------------------------------------------------------------
create table availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  shift_instance_id uuid not null references shift_instances (id) on delete cascade,
  is_available boolean not null,
  updated_at timestamptz not null default now(),
  unique (employee_id, shift_instance_id)
);

create index idx_availability_employee on availability (employee_id);
create index idx_availability_shift on availability (shift_instance_id);

-- ---------------------------------------------------------------------------
-- weekly_shift_requests — how many shifts an employee wants to work in a
-- given (one-week) period
-- ---------------------------------------------------------------------------
create table weekly_shift_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees (id) on delete cascade,
  schedule_period_id uuid not null references schedule_periods (id) on delete cascade,
  desired_shift_count integer not null check (desired_shift_count >= 0),
  updated_at timestamptz not null default now(),
  unique (employee_id, schedule_period_id)
);

create index idx_weekly_requests_employee on weekly_shift_requests (employee_id);
create index idx_weekly_requests_period on weekly_shift_requests (schedule_period_id);

-- ---------------------------------------------------------------------------
-- assignments — final output of the algorithm / manual manager edits
-- ---------------------------------------------------------------------------
create table assignments (
  id uuid primary key default gen_random_uuid(),
  shift_instance_id uuid not null references shift_instances (id) on delete cascade,
  employee_id uuid not null references employees (id) on delete cascade,
  assigned_by assigned_by_type not null default 'algorithm',
  created_at timestamptz not null default now(),
  unique (shift_instance_id, employee_id)
);

create index idx_assignments_shift on assignments (shift_instance_id);
create index idx_assignments_employee on assignments (employee_id);
