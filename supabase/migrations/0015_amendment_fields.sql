-- Nome do documento e status do aditivo (em análise / assinado).
alter table contract_amendments add column document_name text;
alter table contract_amendments add column status text not null default 'em_analise'
  check (status in ('em_analise', 'assinado'));
