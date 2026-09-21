-- Remove o status "Cancelado" — mantém só Ativo/Encerrado. "Expirado" (vigência
-- ultrapassada) não é um valor salvo, é calculado na aplicação a partir do fim da vigência.
--
-- Idempotente (usa "if exists") para poder ser executada novamente com segurança
-- caso uma tentativa anterior tenha sido interrompida no meio.

update contracts set status = 'encerrado' where status = 'cancelado';

alter table contracts drop constraint if exists contracts_status_check;
alter table contracts add constraint contracts_status_check check (status in ('ativo', 'encerrado'));
