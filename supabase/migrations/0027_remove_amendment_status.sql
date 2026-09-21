-- Remove o status do aditivo (Em análise/Concluído) — não é mais exibido nem editável,
-- a linha do tempo do contrato já cobre o histórico dos aditivos.
--
-- Idempotente (usa "if exists") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

alter table contract_amendments drop column if exists status;
