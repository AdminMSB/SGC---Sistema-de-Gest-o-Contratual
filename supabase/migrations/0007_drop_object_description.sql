-- Remove o campo livre "Objeto do contrato": o "Detalhamento" (contract_detail_type) passa a
-- cumprir esse papel, selecionado manualmente por lista suspensa. O resumo do objeto extraído
-- do PDF continua disponível (somente leitura) dentro de extracted_highlights.objectSummary.
alter table contracts drop column object_description;
