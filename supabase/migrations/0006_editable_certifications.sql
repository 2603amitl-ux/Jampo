-- Certifications become a manager-editable list instead of a fixed enum,
-- so they can be added/renamed/deleted from the presets screen.

create table certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table certifications enable row level security;

create policy certifications_select on certifications
  for select using (auth.uid() is not null);
create policy certifications_insert on certifications
  for insert with check (is_manager());
create policy certifications_update on certifications
  for update using (is_manager()) with check (is_manager());
create policy certifications_delete on certifications
  for delete using (is_manager());

insert into certifications (name) values ('כללי'), ('באנג''י'), ('טרקטורון');

-- Columns that used to hold `certification[]` (a fixed enum) now hold plain
-- text[] — the certifications table is the source of truth for which names
-- are valid, enforced at the application layer rather than by the DB type,
-- so a manager can add/rename/delete without a schema migration each time.
alter table employees alter column certifications drop default;
alter table employees alter column certifications type text[] using certifications::text[];
alter table employees alter column certifications set default '{}';

alter table shift_presets alter column required_certifications drop default;
alter table shift_presets alter column required_certifications type text[] using required_certifications::text[];
alter table shift_presets alter column required_certifications set default '{}';

alter table shift_instances alter column required_certifications drop default;
alter table shift_instances alter column required_certifications type text[] using required_certifications::text[];
alter table shift_instances alter column required_certifications set default '{}';

drop type certification;

-- Renaming/deleting a certification has to cascade into every text[]
-- column that might reference it by name. array_replace/array_remove do
-- that in one statement per table; wrapping it in a SECURITY DEFINER
-- function keeps the cascade atomic and re-checks is_manager() itself
-- (the RPC could otherwise be called by any authenticated user).
create or replace function rename_certification(old_name text, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager() then
    raise exception 'permission denied';
  end if;

  update employees
    set certifications = array_replace(certifications, old_name, new_name)
    where old_name = any(certifications);
  update shift_presets
    set required_certifications = array_replace(required_certifications, old_name, new_name)
    where old_name = any(required_certifications);
  update shift_instances
    set required_certifications = array_replace(required_certifications, old_name, new_name)
    where old_name = any(required_certifications);
  update certifications set name = new_name where name = old_name;
end;
$$;

create or replace function delete_certification(cert_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_manager() then
    raise exception 'permission denied';
  end if;

  update employees
    set certifications = array_remove(certifications, cert_name)
    where cert_name = any(certifications);
  update shift_presets
    set required_certifications = array_remove(required_certifications, cert_name)
    where cert_name = any(required_certifications);
  update shift_instances
    set required_certifications = array_remove(required_certifications, cert_name)
    where cert_name = any(required_certifications);
  delete from certifications where name = cert_name;
end;
$$;
