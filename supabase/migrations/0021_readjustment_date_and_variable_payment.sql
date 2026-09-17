-- Reajuste passa a ser uma data prevista preenchida manualmente (em vez de um período em
-- meses calculado a partir do início da vigência). Remove "Motivo de encerramento/rescisão"
-- (não será mais usado) e adiciona um campo opcional para descrever um pagamento variável
-- adicional ao valor fixo do contrato.
--
-- Idempotente (usa "if exists"/"if not exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

-- contracts_expiring usa "select c.*", então depende de cada coluna de contracts — precisa
-- ser removida antes de alterar as colunas e recriada depois.
drop view if exists contracts_expiring;

alter table contracts add column if not exists readjustment_date date;

update contracts
  set readjustment_date = (start_date + (readjustment_period_months || ' months')::interval)::date
  where readjustment_date is null
    and readjustment_period_months is not null
    and start_date is not null;

alter table contracts drop column if exists readjustment_period_months;
alter table contracts drop column if exists termination_reason;
alter table contracts add column if not exists variable_payment_note text;

create or replace view contracts_expiring as
  select
    c.*,
    (c.end_date - current_date) as days_until_expiration
  from contracts c
  where c.status = 'ativo'
    and c.end_date is not null
    and c.end_date <= current_date + c.renewal_notice_days;
