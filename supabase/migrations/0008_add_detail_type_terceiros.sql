-- Adiciona "Prestação de serviço de terceiros" à lista de Detalhamento do contrato.
alter table contracts drop constraint contracts_contract_detail_type_check;
alter table contracts add constraint contracts_contract_detail_type_check
  check (contract_detail_type in (
    'manutencao', 'licenca_uso', 'mao_de_obra', 'prestacao_servico_terceiros',
    'servicos_advocaticios', 'gestao_viagens', 'seguro_patrimonial', 'seguro_predial',
    'seguro_auto', 'outro'
  ));
