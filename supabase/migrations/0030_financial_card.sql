-- Card "Financeiro": e-mail próprio para alertas financeiros e duas datas de pagamento
-- (fixo e variável, já que às vezes caem em dias diferentes do mês). O alerta de cada uma
-- é enviado com 10 dias corridos de antecedência.
--
-- Idempotente (usa "if not exists"/"if exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts add column if not exists financial_email text;
alter table contracts add column if not exists fixed_payment_date date;
alter table contracts add column if not exists variable_payment_date date;

alter table contract_alert_log drop constraint if exists contract_alert_log_alert_type_check;
alter table contract_alert_log add constraint contract_alert_log_alert_type_check
  check (alert_type in ('vencimento', 'reajuste', 'nota_fiscal', 'pagamento_fixo', 'pagamento_variavel'));
