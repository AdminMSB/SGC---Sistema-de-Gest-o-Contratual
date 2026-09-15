-- Remove o controle de pagamentos (fora do escopo deste portal — passa a ser controlado em
-- outro sistema). "amount_cents" deixa de ser o valor de uma parcela e passa a representar o
-- valor total do contrato.

-- A view depende de contracts via "c.*"; precisa ser recriada depois das alterações de coluna.
drop view contracts_expiring;

drop table contract_payments;

alter table contracts drop column payment_frequency;
alter table contracts rename column amount_cents to total_amount_cents;

create view contracts_expiring as
  select
    c.*,
    (c.end_date - current_date) as days_until_expiration
  from contracts c
  where c.status = 'ativo'
    and c.end_date is not null
    and c.end_date <= current_date + c.renewal_notice_days;
