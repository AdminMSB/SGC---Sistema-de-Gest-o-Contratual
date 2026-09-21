-- Renomeia o papel "membro" para "fiscal" (terminologia usada na gestão de contratos:
-- Gestor, Fiscal e Administrador).
--
-- Idempotente (usa "if exists"/"if not exists") para poder ser executada novamente com
-- segurança caso uma tentativa anterior tenha sido interrompida no meio.

alter table profiles drop constraint if exists profiles_role_check;

update profiles set role = 'fiscal' where role = 'membro';
alter table profiles alter column role set default 'fiscal';

alter table profiles add constraint profiles_role_check check (role in ('fiscal', 'gestor', 'admin'));

-- Novos usuários criados sem "role" no metadata (raro, mas o fallback existia) devem cair em
-- "fiscal", não mais em "membro".
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'fiscal')
  );
  return new;
end;
$$;
