-- Schema inicial: perfis, contratos e parcelas/pagamentos.
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'membro' check (role in ('membro', 'admin')),
  created_at timestamptz not null default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  counterparty text not null,
  contract_type text not null default 'outro'
    check (contract_type in ('fornecedor', 'aluguel', 'servico', 'outro')),
  status text not null default 'ativo' check (status in ('ativo', 'encerrado', 'cancelado')),
  start_date date not null,
  end_date date,
  renewal_type text not null default 'nenhuma'
    check (renewal_type in ('automatica', 'manual', 'nenhuma')),
  renewal_notice_days int not null default 30 check (renewal_notice_days >= 0),
  payment_frequency text not null default 'mensal'
    check (payment_frequency in ('mensal', 'trimestral', 'semestral', 'anual', 'unico', 'outro')),
  amount_cents bigint not null check (amount_cents >= 0),
  file_path text,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_status_idx on contracts (status);
create index contracts_end_date_idx on contracts (end_date);
create index contracts_contract_type_idx on contracts (contract_type);

create table contract_payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  due_date date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  paid_at date,
  paid_amount_cents bigint,
  notes text,
  created_at timestamptz not null default now()
);

create index contract_payments_contract_id_idx on contract_payments (contract_id);
create index contract_payments_due_date_idx on contract_payments (due_date);

-- Alertas de vencimento/renovação: view em vez de tabela própria — evita manter estado
-- duplicado, sempre reflete `contracts` na hora da consulta.
create view contracts_expiring as
  select
    c.*,
    (c.end_date - current_date) as days_until_expiration
  from contracts c
  where c.status = 'ativo'
    and c.end_date is not null
    and c.end_date <= current_date + c.renewal_notice_days;
