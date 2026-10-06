-- Documentação de habilitação/regularidade do fornecedor, por contrato: cartão CNPJ,
-- contrato social, alvará, certidões (federal, FGTS, trabalhista, estadual, municipal) e
-- outros documentos avulsos. Cada tipo fixo tem no máximo um registro por contrato (reenviar
-- substitui); "outro" aceita vários.
--
-- Idempotente (usa "if not exists"/"if exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

create table if not exists contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  document_type text not null check (document_type in (
    'cartao_cnpj', 'contrato_social', 'alvara', 'cnd_federal', 'crf_fgts', 'cndt',
    'certidao_estadual', 'certidao_municipal', 'outro'
  )),
  label text,
  validity_date date,
  file_path text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists contract_documents_unique_fixed_type
  on contract_documents (contract_id, document_type)
  where document_type <> 'outro';

create index if not exists contract_documents_contract_id_idx on contract_documents (contract_id);

alter table contract_documents enable row level security;

drop policy if exists contract_documents_select on contract_documents;
create policy contract_documents_select on contract_documents for select to authenticated using (true);

drop policy if exists contract_documents_insert on contract_documents;
create policy contract_documents_insert on contract_documents for insert to authenticated with check (true);

drop policy if exists contract_documents_update on contract_documents;
create policy contract_documents_update on contract_documents for update to authenticated
  using (true)
  with check (true);

drop policy if exists contract_documents_delete on contract_documents;
create policy contract_documents_delete on contract_documents for delete to authenticated using (true);

alter table contract_alert_log drop constraint if exists contract_alert_log_alert_type_check;
alter table contract_alert_log add constraint contract_alert_log_alert_type_check
  check (alert_type in (
    'vencimento', 'reajuste', 'nota_fiscal', 'pagamento_fixo', 'pagamento_variavel', 'documento_vencendo'
  ));
