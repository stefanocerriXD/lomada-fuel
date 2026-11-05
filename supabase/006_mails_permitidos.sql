-- Solo pueden crear una cuenta los mails de esta lista. Quien ya tiene cuenta sigue entrando.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 005_retos_y_habitos.sql.
-- Para sumar a alguien: insert into public.mails_permitidos (email) values ('mail@ejemplo.com');
-- No guardar mails reales en este archivo: el repositorio es público.

create table if not exists public.mails_permitidos (
  email text primary key check (email = lower(email)),
  agregado_en timestamptz not null default now()
);

-- Sin políticas: la app no puede leer ni cambiar la lista. Se administra desde el SQL Editor.
alter table public.mails_permitidos enable row level security;
revoke all on public.mails_permitidos from anon, authenticated;

create or replace function public.solo_mails_permitidos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.mails_permitidos where email = lower(new.email)) then
    raise exception 'mail_no_invitado';
  end if;
  return new;
end;
$$;

drop trigger if exists controlar_registro on auth.users;
create trigger controlar_registro
  before insert on auth.users
  for each row execute function public.solo_mails_permitidos();
