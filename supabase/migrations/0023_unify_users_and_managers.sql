-- Unifica o cadastro de "Gestor do contrato" com o de usuários do sistema: gestores
-- passam a ser usuários de verdade (com login), com o papel "Gestor" escolhido ao
-- convidar, em vez de uma lista solta e independente em contract_managers.
--
-- Idempotente (usa "if exists") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('membro', 'gestor', 'admin'));

-- "Gestor do contrato" passa a apontar para profiles em vez de contract_managers —
-- não há como mapear os nomes soltos antigos para usuários reais, então zera e cada
-- contrato precisa ter o gestor reatribuído manualmente.
update contracts set internal_manager_id = null;
alter table contracts drop constraint if exists contracts_internal_manager_id_fkey;
alter table contracts add constraint contracts_internal_manager_id_fkey
  foreign key (internal_manager_id) references profiles (id) on delete set null;

drop table if exists contract_managers;
