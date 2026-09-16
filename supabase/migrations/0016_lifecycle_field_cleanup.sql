-- Remove campos que não serão usados (foro de eleição, data de assinatura, sigilo
-- pós-encerramento, aprovado por, tipo de renovação) e adiciona a flag de valor variável
-- (contratos sem um total previsto, ex.: remuneração por comissão/uso).

-- A view depende de contracts via "c.*"; precisa ser recriada depois das alterações de coluna.
drop view contracts_expiring;

alter table contracts drop column jurisdiction_forum;
alter table contracts drop column signature_date;
alter table contracts drop column confidentiality_period_months;
alter table contracts drop column approved_by;
alter table contracts drop column renewal_type;

alter table contracts alter column total_amount_cents drop not null;
alter table contracts add column is_variable_value boolean not null default false;

create view contracts_expiring as
  select
    c.*,
    (c.end_date - current_date) as days_until_expiration
  from contracts c
  where c.status = 'ativo'
    and c.end_date is not null
    and c.end_date <= current_date + c.renewal_notice_days;
