-- Segundo telefone de contato e flag indicando se algum dos telefones é WhatsApp.
--
-- Idempotente (usa "if not exists") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts add column if not exists contact_phone_2 text;
alter table contracts add column if not exists is_whatsapp boolean not null default false;
