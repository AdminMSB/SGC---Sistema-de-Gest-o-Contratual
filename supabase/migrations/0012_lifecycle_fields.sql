-- Campos de gestão do ciclo de vida do contrato e consulta de histórico.
alter table contracts add column internal_code text;
alter table contracts add column department text;
alter table contracts add column internal_manager_id uuid references profiles (id) on delete set null;
alter table contracts add column signature_date date;
alter table contracts add column termination_reason text;
alter table contracts add column jurisdiction_forum text;
alter table contracts add column confidentiality_period_months int check (confidentiality_period_months >= 0);
alter table contracts add column approved_by text;
-- Lista de e-mails (separados por vírgula) para alerta de vencimento/renovação — apenas
-- armazenamento; o envio automático não está implementado (ver README).
alter table contracts add column alert_emails text;
