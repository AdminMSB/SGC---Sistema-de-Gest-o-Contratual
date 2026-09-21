-- Data do distrato, usada para posicionar o distrato na linha do tempo do contrato
-- junto com a assinatura original e os aditivos.
--
-- Idempotente (usa "if not exists") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts add column if not exists distrato_date date;
