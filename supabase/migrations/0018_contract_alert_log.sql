-- Registro de alertas de vencimento/reajuste já enviados por e-mail, para não notificar o
-- mesmo evento repetidamente a cada execução diária do job (ver app/api/cron/contract-alerts).
--
-- Idempotente (usa "if exists"/"if not exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

create table if not exists contract_alert_log (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  alert_type text not null check (alert_type in ('vencimento', 'reajuste')),
  sent_at timestamptz not null default now()
);

create index if not exists contract_alert_log_contract_id_idx on contract_alert_log (contract_id, alert_type);

alter table contract_alert_log enable row level security;

drop policy if exists contract_alert_log_select on contract_alert_log;
create policy contract_alert_log_select on contract_alert_log for select to authenticated using (true);
