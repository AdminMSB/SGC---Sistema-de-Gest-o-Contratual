-- Catálogo próprio de "Gestor do contrato" (independente dos usuários do sistema em
-- `profiles`), gerenciado em Configurações → Gestores.
--
-- Idempotente (usa "if exists"/"if not exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

create table if not exists contract_managers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  created_at timestamptz not null default now()
);

alter table contract_managers enable row level security;

drop policy if exists contract_managers_select on contract_managers;
create policy contract_managers_select on contract_managers for select to authenticated using (true);

drop policy if exists contract_managers_insert on contract_managers;
create policy contract_managers_insert on contract_managers for insert to authenticated
  with check (auth_role() = 'admin');

drop policy if exists contract_managers_delete on contract_managers;
create policy contract_managers_delete on contract_managers for delete to authenticated
  using (auth_role() = 'admin');

-- "Gestor do contrato" passa a apontar para contract_managers em vez de profiles.
update contracts set internal_manager_id = null;
alter table contracts drop constraint if exists contracts_internal_manager_id_fkey;
alter table contracts add constraint contracts_internal_manager_id_fkey
  foreign key (internal_manager_id) references contract_managers (id) on delete set null;
