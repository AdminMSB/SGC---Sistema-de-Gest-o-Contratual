-- Expande "Tipo" de contrato e adiciona detalhamento, CNPJ da contraparte, objeto do
-- contrato e reajuste (índice + período), para acompanhar a extração automática de destaques
-- do PDF (lib/pdf-extract.ts).

-- Mapeia valores antigos para os novos antes de trocar a constraint (proteção caso já existam
-- contratos cadastrados com o enum anterior).
update contracts set contract_type = case contract_type
  when 'fornecedor' then 'fornecimento'
  when 'aluguel' then 'locacao'
  when 'servico' then 'servico'
  else 'servico'
end
where contract_type not in ('servico', 'locacao', 'fornecimento', 'comodato', 'consultoria');

alter table contracts drop constraint contracts_contract_type_check;
alter table contracts add constraint contracts_contract_type_check
  check (contract_type in ('servico', 'locacao', 'fornecimento', 'comodato', 'consultoria'));
alter table contracts alter column contract_type set default 'servico';

alter table contracts add column contract_detail_type text
  check (contract_detail_type in (
    'manutencao', 'licenca_uso', 'mao_de_obra', 'servicos_advocaticios', 'gestao_viagens',
    'seguro_patrimonial', 'seguro_predial', 'seguro_auto', 'outro'
  ));

alter table contracts add column counterparty_cnpj text;
alter table contracts add column object_description text;

alter table contracts add column readjustment_index text
  check (readjustment_index in ('igpm', 'ipca', 'inpc', 'outro'));
alter table contracts add column readjustment_period_months int check (readjustment_period_months >= 0);
