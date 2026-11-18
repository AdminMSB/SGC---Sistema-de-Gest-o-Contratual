-- Cadastro de usuários com mais campos, papéis só "gestor" e "admin", permissões do Gestor
-- configuráveis pelo administrador e visibilidade restrita: o Gestor só enxerga os contratos
-- em que é o "Gestor do contrato"; só o Administrador vê tudo e exclui contratos.
--
-- Idempotente (usa "if not exists"/"drop ... if exists"/"on conflict") para poder ser
-- executada novamente com segurança.

-- Papéis: remove "fiscal" (quem era fiscal passa a gestor) ---------------------------------

alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'gestor' where role = 'fiscal';
alter table profiles alter column role set default 'gestor';
alter table profiles add constraint profiles_role_check check (role in ('gestor', 'admin'));

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'gestor')
  );
  return new;
end;
$$;

-- Novos campos do cadastro --------------------------------------------------------------

alter table profiles add column if not exists job_title text;
alter table profiles add column if not exists department text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists active boolean not null default true;

-- Permissões por papel (o administrador sempre tem todas; só o gestor é configurável) --------

create table if not exists role_permissions (
  role text not null check (role in ('gestor', 'admin')),
  permission text not null,
  allowed boolean not null default false,
  primary key (role, permission)
);

alter table role_permissions enable row level security;

drop policy if exists role_permissions_select on role_permissions;
create policy role_permissions_select on role_permissions for select to authenticated using (true);
drop policy if exists role_permissions_insert on role_permissions;
create policy role_permissions_insert on role_permissions for insert to authenticated with check (auth_role() = 'admin');
drop policy if exists role_permissions_update on role_permissions;
create policy role_permissions_update on role_permissions for update to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
drop policy if exists role_permissions_delete on role_permissions;
create policy role_permissions_delete on role_permissions for delete to authenticated using (auth_role() = 'admin');

insert into role_permissions (role, permission, allowed) values
  ('gestor', 'create_edit_contract', true),
  ('gestor', 'close_contract', true),
  ('gestor', 'manage_documents', true),
  ('gestor', 'manage_amendments', true),
  ('gestor', 'send_signature', true)
on conflict (role, permission) do nothing;

-- Visibilidade: Administrador vê tudo; Gestor só os contratos em que é o gestor responsável ---

create or replace function can_access_contract(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth_role() = 'admin'
    or exists (select 1 from contracts where id = cid and internal_manager_id = auth.uid());
$$;

-- Arquivos: o primeiro trecho do caminho é o id do contrato ({contract_id}/...).
create or replace function can_access_contract_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  begin
    cid := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return auth_role() = 'admin';
  end;
  return can_access_contract(cid);
end;
$$;

drop policy if exists contracts_select on contracts;
create policy contracts_select on contracts for select to authenticated
  using (auth_role() = 'admin' or internal_manager_id = auth.uid());

drop policy if exists contracts_insert on contracts;
create policy contracts_insert on contracts for insert to authenticated
  with check (auth_role() = 'admin' or internal_manager_id = auth.uid());

drop policy if exists contracts_update on contracts;
create policy contracts_update on contracts for update to authenticated
  using (auth_role() = 'admin' or internal_manager_id = auth.uid())
  with check (auth_role() = 'admin' or internal_manager_id = auth.uid());

drop policy if exists contracts_delete on contracts;
create policy contracts_delete on contracts for delete to authenticated using (auth_role() = 'admin');

-- A view precisa respeitar as regras de quem consulta.
alter view contracts_expiring set (security_invoker = true);

drop policy if exists contract_amendments_select on contract_amendments;
create policy contract_amendments_select on contract_amendments for select to authenticated
  using (can_access_contract(contract_id));
drop policy if exists contract_amendments_insert on contract_amendments;
create policy contract_amendments_insert on contract_amendments for insert to authenticated
  with check (can_access_contract(contract_id));
drop policy if exists contract_amendments_update on contract_amendments;
create policy contract_amendments_update on contract_amendments for update to authenticated
  using (can_access_contract(contract_id)) with check (can_access_contract(contract_id));
drop policy if exists contract_amendments_delete on contract_amendments;
create policy contract_amendments_delete on contract_amendments for delete to authenticated
  using (can_access_contract(contract_id));

drop policy if exists contract_documents_select on contract_documents;
create policy contract_documents_select on contract_documents for select to authenticated
  using (can_access_contract(contract_id));
drop policy if exists contract_documents_insert on contract_documents;
create policy contract_documents_insert on contract_documents for insert to authenticated
  with check (can_access_contract(contract_id));
drop policy if exists contract_documents_update on contract_documents;
create policy contract_documents_update on contract_documents for update to authenticated
  using (can_access_contract(contract_id)) with check (can_access_contract(contract_id));
drop policy if exists contract_documents_delete on contract_documents;
create policy contract_documents_delete on contract_documents for delete to authenticated
  using (can_access_contract(contract_id));

drop policy if exists contract_status_history_select on contract_status_history;
create policy contract_status_history_select on contract_status_history for select to authenticated
  using (can_access_contract(contract_id));

drop policy if exists contract_alert_log_select on contract_alert_log;
create policy contract_alert_log_select on contract_alert_log for select to authenticated
  using (can_access_contract(contract_id));

drop policy if exists signature_requests_select on signature_requests;
create policy signature_requests_select on signature_requests for select to authenticated
  using (can_access_contract(contract_id));
drop policy if exists signature_requests_insert on signature_requests;
create policy signature_requests_insert on signature_requests for insert to authenticated
  with check (can_access_contract(contract_id));
drop policy if exists signature_requests_update on signature_requests;
create policy signature_requests_update on signature_requests for update to authenticated
  using (can_access_contract(contract_id)) with check (can_access_contract(contract_id));
drop policy if exists signature_requests_delete on signature_requests;
create policy signature_requests_delete on signature_requests for delete to authenticated
  using (can_access_contract(contract_id));

-- Signatários: visíveis quando a solicitação (já filtrada pela regra acima) é visível.
drop policy if exists signature_signers_select on signature_signers;
create policy signature_signers_select on signature_signers for select to authenticated
  using (exists (select 1 from signature_requests r where r.id = request_id));
drop policy if exists signature_signers_insert on signature_signers;
create policy signature_signers_insert on signature_signers for insert to authenticated
  with check (exists (select 1 from signature_requests r where r.id = request_id));
drop policy if exists signature_signers_update on signature_signers;
create policy signature_signers_update on signature_signers for update to authenticated
  using (exists (select 1 from signature_requests r where r.id = request_id))
  with check (exists (select 1 from signature_requests r where r.id = request_id));
drop policy if exists signature_signers_delete on signature_signers;
create policy signature_signers_delete on signature_signers for delete to authenticated
  using (exists (select 1 from signature_requests r where r.id = request_id));

drop policy if exists contracts_bucket_all on storage.objects;
create policy contracts_bucket_all on storage.objects for all to authenticated
  using (bucket_id = 'contracts' and can_access_contract_path(name))
  with check (bucket_id = 'contracts' and can_access_contract_path(name));
