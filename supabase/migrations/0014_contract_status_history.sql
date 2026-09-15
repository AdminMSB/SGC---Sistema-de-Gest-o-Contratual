-- Histórico de mudança de status do contrato, para consulta futura ("ativo -> encerrado em
-- X, por Y"). Gravado automaticamente por trigger, não pela aplicação, para valer também em
-- eventuais alterações feitas direto no banco.
create table contract_status_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index contract_status_history_contract_id_idx on contract_status_history (contract_id);

alter table contract_status_history enable row level security;

create policy contract_status_history_select on contract_status_history for select to authenticated using (true);

create or replace function log_contract_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into contract_status_history (contract_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger contracts_log_status_change
  after update on contracts
  for each row execute function log_contract_status_change();
