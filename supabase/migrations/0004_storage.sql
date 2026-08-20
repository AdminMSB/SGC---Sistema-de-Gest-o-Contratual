-- Bucket privado para os PDFs dos contratos.
-- Convenção de path: contracts/{contract_id}/{arquivo}.

insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

create policy contracts_bucket_all on storage.objects for all to authenticated using (
  bucket_id = 'contracts'
) with check (
  bucket_id = 'contracts'
);
