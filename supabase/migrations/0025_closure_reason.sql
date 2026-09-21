-- Motivo escolhido ao marcar um contrato como encerrado (Inativo/Encerrado/Cancelado),
-- usado para exibir uma tarja com o motivo na tela de detalhe. Só faz sentido quando
-- status = 'encerrado'; a aplicação zera esse campo ao reativar o contrato.
--
-- Idempotente (usa "if exists"/"if not exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts add column if not exists closure_reason text;

alter table contracts drop constraint if exists contracts_closure_reason_check;
alter table contracts add constraint contracts_closure_reason_check
  check (closure_reason in ('inativo', 'encerrado', 'cancelado'));
