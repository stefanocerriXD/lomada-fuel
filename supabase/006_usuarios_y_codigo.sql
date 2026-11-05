-- Cuentas con usuario y contraseña. Para registrarse hace falta el código del grupo.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 005_retos_y_habitos.sql.
-- Después, cargar el código: insert into public.grupo_acceso (codigo) values ('tu-codigo');
-- No guardar el código en este archivo: el repositorio es público.

alter table public.perfiles add column if not exists usuario text;
create unique index if not exists perfiles_usuario on public.perfiles (lower(usuario));

create table if not exists public.grupo_acceso (
  id boolean primary key default true check (id),
  codigo text not null
);

create table if not exists public.intentos_ingreso (
  usuario text primary key,
  fallas integer not null default 0,
  bloqueado_hasta timestamptz
);

-- Sin políticas: el navegador no puede leerlas. Solo se usan desde estas funciones.
alter table public.grupo_acceso enable row level security;
alter table public.intentos_ingreso enable row level security;
revoke all on public.grupo_acceso, public.intentos_ingreso from anon, authenticated;

-- Control real del registro: corre dentro de la base, aunque alguien evite la pantalla de la app.
create or replace function public.controlar_registro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  usuario_nuevo text := lower(trim(coalesce(datos->>'usuario', '')));
begin
  if not exists (select 1 from grupo_acceso where lower(codigo) = lower(trim(coalesce(datos->>'codigo_grupo', '')))) then
    raise exception 'codigo_invalido';
  end if;
  if usuario_nuevo !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'usuario_invalido';
  end if;
  if exists (select 1 from perfiles where lower(usuario) = usuario_nuevo) then
    raise exception 'usuario_ocupado';
  end if;
  new.raw_user_meta_data := datos - 'codigo_grupo';
  return new;
end;
$$;

create or replace function public.crear_perfil_registrado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into perfiles (id, nombre, usuario)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'usuario'), lower(trim(new.raw_user_meta_data->>'usuario')));
  return new;
end;
$$;

drop trigger if exists controlar_registro on auth.users;
create trigger controlar_registro before insert on auth.users
  for each row execute function public.controlar_registro();

drop trigger if exists crear_perfil_registrado on auth.users;
create trigger crear_perfil_registrado after insert on auth.users
  for each row execute function public.crear_perfil_registrado();

-- Le avisa a la pantalla qué dato corregir antes de intentar crear la cuenta.
create or replace function public.revisar_registro(p_usuario text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from grupo_acceso where lower(codigo) = lower(trim(coalesce(p_codigo, '')))) then
    perform pg_sleep(0.5); -- Hace lentos los intentos de adivinar el código.
    return 'codigo';
  end if;
  if lower(trim(coalesce(p_usuario, ''))) !~ '^[a-z0-9_.]{3,20}$' then return 'usuario_invalido'; end if;
  if exists (select 1 from perfiles where lower(usuario) = lower(trim(p_usuario))) then return 'usuario_ocupado'; end if;
  return 'ok';
end;
$$;

-- Devuelve el mail solo si la contraseña es correcta. Así el usuario no revela el mail de nadie.
create or replace function public.mail_de_ingreso(p_usuario text, p_clave text)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  nombre_usuario text := lower(trim(coalesce(p_usuario, '')));
  mail text;
  clave_guardada text;
begin
  if exists (select 1 from intentos_ingreso where usuario = nombre_usuario and bloqueado_hasta > now()) then
    raise exception 'demasiados_intentos';
  end if;

  select u.email, u.encrypted_password into mail, clave_guardada
  from perfiles p
  join auth.users u on u.id = p.id
  where lower(p.usuario) = nombre_usuario;

  if clave_guardada is null then
    return null;
  end if;

  if crypt(coalesce(p_clave, ''), clave_guardada) = clave_guardada then
    delete from intentos_ingreso where usuario = nombre_usuario;
    return mail;
  end if;

  -- Cinco fallas seguidas bloquean ese usuario por 10 minutos.
  insert into intentos_ingreso as i (usuario, fallas) values (nombre_usuario, 1)
  on conflict (usuario) do update set
    fallas = case when i.bloqueado_hasta is not null then 1 else i.fallas + 1 end,
    bloqueado_hasta = case when i.bloqueado_hasta is null and i.fallas + 1 >= 5 then now() + interval '10 minutes' end;
  return null;
end;
$$;

revoke all on function public.controlar_registro(), public.crear_perfil_registrado() from anon, authenticated;
revoke all on function public.revisar_registro(text, text), public.mail_de_ingreso(text, text) from public;
grant execute on function public.revisar_registro(text, text), public.mail_de_ingreso(text, text) to anon, authenticated;
