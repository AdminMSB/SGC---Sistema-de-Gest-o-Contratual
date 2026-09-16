-- Remove campos que não serão usados (foro de eleição, data de assinatura, sigilo
-- pós-encerramento, aprovado por, tipo de renovação) e adiciona a flag de valor variável
-- (contratos sem um total previsto, ex.: remuneração por comissão/uso).
--
-- Idempotente (usa "if exists"/"or replace") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

drop view if exists contracts_expiring;

alter table contracts drop column if exists jurisdiction_forum;
alter table contracts drop column if exists signature_date;
alter table contracts drop column if exists confidentiality_period_months;
alter table contracts drop column if exists approved_by;
alter table contracts drop column if exists renewal_type;

alter table contracts alter column total_amount_cents drop not null;
alter table contracts add column if not exists is_variable_value boolean not null default false;

create or replace view contracts_expiring as
  select
    c.*,
    (c.end_date - current_date) as days_until_expiration
  from contracts c
  where c.status = 'ativo'
    and c.end_date is not null
    and c.end_date <= current_date + c.renewal_notice_days;
