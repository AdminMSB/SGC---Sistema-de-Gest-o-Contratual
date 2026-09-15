-- Dados de contato da contraparte, preenchidos manualmente (não fazem parte da extração
-- automática do PDF).
alter table contracts add column representative_name text;
alter table contracts add column contact_email text;
alter table contracts add column contact_phone text;
