-- A tabela contract_amendments nunca teve uma política de RLS para UPDATE (só
-- select/insert/delete), então trocar o status de um aditivo era bloqueado
-- silenciosamente pelo Postgres (sem erro, só sem efeito nenhum).
--
-- Idempotente (usa "drop policy if exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

drop policy if exists contract_amendments_update on contract_amendments;
create policy contract_amendments_update on contract_amendments for update to authenticated
  using (true)
  with check (true);
