-- Dados de exemplo para testar os alertas de vencimento. Execute no SQL Editor do
-- Supabase depois de aplicar as migrations (opcional).

insert into contracts (title, counterparty, contract_type, status, start_date, end_date, renewal_type, renewal_notice_days, payment_frequency, amount_cents, notes)
values
  ('Locação da sede', 'Imobiliária Central Ltda.', 'aluguel', 'ativo', current_date - interval '11 months', current_date + interval '20 days', 'manual', 60, 'mensal', 850000, 'Reajuste anual pelo IGP-M.'),
  ('Licença de software de gestão', 'Software Solutions S.A.', 'servico', 'ativo', current_date - interval '10 months', current_date + interval '45 days', 'automatica', 30, 'anual', 1200000, null),
  ('Manutenção de ar-condicionado', 'Fornecedor Clima Ltda.', 'fornecedor', 'ativo', current_date - interval '2 months', current_date + interval '10 months', 'manual', 30, 'trimestral', 90000, null);
