-- Destaques extraídos automaticamente do PDF do contrato (datas, valores, CNPJs, cláusulas
-- notáveis), gerados por padrões (regex) no momento do upload. Ver lib/pdf-extract.ts.
alter table contracts add column extracted_highlights jsonb;
