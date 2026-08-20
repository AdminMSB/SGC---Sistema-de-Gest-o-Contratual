-- Row Level Security: autorização é aplicada no Postgres, não apenas na aplicação.
-- Ferramenta interna sem segmentação por setor — qualquer usuário autenticado (`membro`
-- ou `admin`) lê e mantém contratos/pagamentos; only `admin` gerencia usuários e pode
-- excluir contratos (histórico de pagamentos não deve sumir por engano).

alter table profiles enable row level security;
alter table contracts enable row level security;
alter table contract_payments enable row level security;

-- profiles ---------------------------------------------------------------

create policy profiles_select on profiles for select to authenticated using (true);

create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or auth_role() = 'admin')
  with check (id = auth.uid() or auth_role() = 'admin');

-- contracts ----------------------------------------------------------------

create policy contracts_select on contracts for select to authenticated using (true);

create policy contracts_insert on contracts for insert to authenticated with check (true);

create policy contracts_update on contracts for update to authenticated
  using (true)
  with check (true);

create policy contracts_delete on contracts for delete to authenticated using (
  auth_role() = 'admin'
);

-- contract_payments ---------------------------------------------------------

create policy contract_payments_select on contract_payments for select to authenticated using (true);

create policy contract_payments_insert on contract_payments for insert to authenticated with check (true);

create policy contract_payments_update on contract_payments for update to authenticated
  using (true)
  with check (true);

create policy contract_payments_delete on contract_payments for delete to authenticated using (true);
