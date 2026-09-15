-- Dados de exemplo para testar os alertas de vencimento. Execute no SQL Editor do
-- Supabase depois de aplicar as migrations (opcional).

insert into contracts (title, counterparty, contract_type, status, start_date, end_date, renewal_type, renewal_notice_days, total_amount_cents, notes)
values
  ('Imobiliária Central Ltda.', 'Imobiliária Central Ltda.', 'locacao', 'ativo', current_date - interval '11 months', current_date + interval '20 days', 'manual', 60, 10200000, 'Reajuste anual pelo IGP-M.'),
  ('Software Solutions S.A.', 'Software Solutions S.A.', 'servico', 'ativo', current_date - interval '10 months', current_date + interval '45 days', 'automatica', 30, 1200000, null),
  ('Fornecedor Clima Ltda.', 'Fornecedor Clima Ltda.', 'fornecimento', 'ativo', current_date - interval '2 months', current_date + interval '10 months', 'manual', 30, 360000, null);
