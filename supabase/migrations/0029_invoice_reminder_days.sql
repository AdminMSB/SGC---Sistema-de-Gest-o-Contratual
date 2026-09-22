-- Lembrete por e-mail ao FORNECEDOR para emissão/envio de nota fiscal, em dia(s) fixos do
-- mês (ex.: "5" para pagamento único, "5, 20" para dois pagamentos no mês). Vai para o
-- e-mail cadastrado em "Dados do fornecedor" (contact_email).
--
-- Idempotente (usa "if exists"/"if not exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts add column if not exists invoice_reminder_days text;

alter table contract_alert_log drop constraint if exists contract_alert_log_alert_type_check;
alter table contract_alert_log add constraint contract_alert_log_alert_type_check
  check (alert_type in ('vencimento', 'reajuste', 'nota_fiscal'));
