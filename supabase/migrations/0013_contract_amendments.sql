-- Histórico de aditivos/alterações contratuais (prorrogações, mudanças de valor, etc.).
create table contract_amendments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  description text not null,
  amendment_date date not null,
  file_path text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index contract_amendments_contract_id_idx on contract_amendments (contract_id);

alter table contract_amendments enable row level security;

create policy contract_amendments_select on contract_amendments for select to authenticated using (true);
create policy contract_amendments_insert on contract_amendments for insert to authenticated with check (true);
create policy contract_amendments_delete on contract_amendments for delete to authenticated using (true);
