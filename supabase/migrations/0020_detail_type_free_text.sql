-- "Detalhamento" deixa de ser uma lista fixa e passa a ser texto livre.
--
-- Idempotente (usa "if exists") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts drop constraint if exists contracts_contract_detail_type_check;
