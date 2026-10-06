-- Ajustes do quadro resumo do contrato:
--  * "Valor R$" ganha periodicidade (mensal, bimestral, trimestral... ou conforme demanda).
--  * Aviso prévio passa a ser opcional (null = não informado). Para os alertas automáticos,
--    quem não informou usa 30 dias como padrão.
--  * Flag de WhatsApp também para o segundo telefone (a flag existente passa a valer só para o 1º).
--
-- Idempotente (usa "if not exists"/"create or replace") para poder ser executada novamente
-- com segurança caso uma tentativa anterior tenha sido interrompida no meio.

alter table contracts add column if not exists payment_periodicity text;
alter table contracts drop constraint if exists contracts_payment_periodicity_check;
alter table contracts add constraint contracts_payment_periodicity_check
  check (payment_periodicity in ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'sob_demanda'));

alter table contracts add column if not exists is_whatsapp_2 boolean not null default false;

alter table contracts alter column renewal_notice_days drop not null;
alter table contracts alter column renewal_notice_days drop default;

-- A view usa "select c.*" e colunas novas foram adicionadas à tabela desde que ela foi criada,
-- então "create or replace" falharia: é preciso derrubar e recriar.
drop view if exists contracts_expiring;
create view contracts_expiring as
  select
    c.*,
    (c.end_date - current_date) as days_until_expiration
  from contracts c
  where c.status = 'ativo'
    and c.end_date is not null
    and c.end_date <= current_date + coalesce(c.renewal_notice_days, 30);
