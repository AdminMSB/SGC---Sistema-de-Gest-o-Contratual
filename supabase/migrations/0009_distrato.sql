-- Flag de distrato (rescisão amigável/formal do contrato) e anexo do documento de distrato,
-- independente do PDF do contrato original.
alter table contracts add column has_distrato boolean not null default false;
alter table contracts add column distrato_file_path text;
