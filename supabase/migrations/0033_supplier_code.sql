-- "Código do fornecedor" (cadastro no D365), ao lado do código de contrato (internal_code).
-- As colunas de distrato e de lembrete de nota fiscal deixam de ser usadas pela aplicação,
-- mas são mantidas para não perder dados já cadastrados.
--
-- Idempotente (usa "if not exists") para poder ser executada novamente com segurança.

alter table contracts add column if not exists supplier_code text;
