-- Papel de cada signatário no documento (contratante, contratada, testemunha etc.).
alter table signature_signers add column if not exists role text;
