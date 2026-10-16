-- Assinatura eletrônica própria: o sistema envia um link único por e-mail a cada signatário,
-- que confere o documento e confirma com nome e aceite. Registra data/hora, IP e o hash
-- SHA-256 do PDF. A página pública de assinatura usa a service role (sem login), então as
-- policies abaixo valem só para os usuários autenticados do sistema.
--
-- Idempotente (usa "if not exists"/"drop policy if exists") para poder ser executada
-- novamente com segurança.

create table if not exists signature_requests (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'concluida', 'cancelada')),
  document_path text not null,
  document_hash text not null,
  signed_document_path text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists signature_requests_contract_id_idx on signature_requests (contract_id);

create table if not exists signature_signers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references signature_requests (id) on delete cascade,
  name text not null,
  email text not null,
  token text not null unique,
  signed_at timestamptz,
  signed_name text,
  signed_ip text,
  signed_user_agent text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists signature_signers_request_id_idx on signature_signers (request_id);

alter table signature_requests enable row level security;
alter table signature_signers enable row level security;

drop policy if exists signature_requests_select on signature_requests;
create policy signature_requests_select on signature_requests for select to authenticated using (true);
drop policy if exists signature_requests_insert on signature_requests;
create policy signature_requests_insert on signature_requests for insert to authenticated with check (true);
drop policy if exists signature_requests_update on signature_requests;
create policy signature_requests_update on signature_requests for update to authenticated using (true) with check (true);
drop policy if exists signature_requests_delete on signature_requests;
create policy signature_requests_delete on signature_requests for delete to authenticated using (true);

drop policy if exists signature_signers_select on signature_signers;
create policy signature_signers_select on signature_signers for select to authenticated using (true);
drop policy if exists signature_signers_insert on signature_signers;
create policy signature_signers_insert on signature_signers for insert to authenticated with check (true);
drop policy if exists signature_signers_update on signature_signers;
create policy signature_signers_update on signature_signers for update to authenticated using (true) with check (true);
drop policy if exists signature_signers_delete on signature_signers;
create policy signature_signers_delete on signature_signers for delete to authenticated using (true);
