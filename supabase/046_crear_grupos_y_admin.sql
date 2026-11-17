-- 046: cualquiera puede crear un grupo. Quien lo crea lo administra: acepta o rechaza a los que ponen el codigo.
-- Para entrar a un grupo (con el codigo, al registrarse o desde Ajustes) ahora hace falta que el admin acepte.
-- Los grupos nuevos no tienen Bocha: solo la maldicion de la caca.
-- Ejecutar en el SQL Editor de Supabase, despues de 045. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.miembros_grupo') is null then
    raise exception 'Falta correr antes el SQL 036_varios_grupos.sql';
  end if;
end $$;

-- 1. Quien administra cada grupo. En los que ya existian queda el que mas tiempo lleva
--    (si hay un administrador de la app adentro, ese).
alter table public.grupos add column if not exists creado_por uuid references public.perfiles(id) on delete set null;

update public.grupos g set creado_por = coalesce(
  (select m.usuario_id from public.miembros_grupo m join public.administradores a on a.usuario_id = m.usuario_id
    where m.grupo_id = g.id order by m.unido_en limit 1),
  (select m.usuario_id from public.miembros_grupo m where m.grupo_id = g.id order by m.unido_en limit 1)
)
where g.creado_por is null;

create or replace function public.admin_de_grupo(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from grupos where id = p_grupo and creado_por = auth.uid());
$$;

create or replace function public.grupos_que_administro()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(g.id), '{}') from grupos g
  where g.creado_por = auth.uid() and exists (select 1 from miembros_grupo m where m.grupo_id = g.id and m.usuario_id = auth.uid());
$$;

revoke all on function public.admin_de_grupo(uuid), public.grupos_que_administro() from public, anon;
grant execute on function public.admin_de_grupo(uuid), public.grupos_que_administro() to authenticated;

-- 2. Los pedidos para entrar. Solo se tocan con las funciones de abajo (sin acceso directo).
create table if not exists public.solicitudes_grupo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creado_en timestamptz not null default now(),
  respondido_en timestamptz
);
create unique index if not exists solicitudes_grupo_pendiente on public.solicitudes_grupo (usuario_id, grupo_id) where estado = 'pendiente';
create index if not exists solicitudes_grupo_grupo on public.solicitudes_grupo (grupo_id, estado);
alter table public.solicitudes_grupo enable row level security;
revoke all on public.solicitudes_grupo from anon, authenticated;

-- 3. Pide un aviso con el mismo pedido que usa el recordatorio de las 21 (como la mejora hecha).
--    Si no se puede avisar, no frena nada.
create or replace function public.pedir_aviso_grupo(p_tipo text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is not null then
    execute replace(pedido, '{"tipo":"recordatorio"}', format('{"tipo":"%s","id":"%s"}', p_tipo, p_id));
  end if;
exception when others then
  null;
end;
$$;
revoke all on function public.pedir_aviso_grupo(text, uuid) from public, anon, authenticated;

-- 4. Crear un grupo: el codigo sale del nombre y cuatro numeros. Quien lo crea entra y lo administra.
create or replace function public.crear_grupo(p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  limpio text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  base text;
  nuevo_codigo text;
  nuevo uuid;
  intentos int := 0;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if char_length(limpio) not between 2 and 40 then raise exception 'nombre_invalido'; end if;
  if (select count(*) from grupos where creado_por = auth.uid() and creado_en > now() - interval '1 day') >= 3 then
    raise exception 'demasiados_grupos';
  end if;
  base := left(regexp_replace(lower(translate(limpio, U&'\00C1\00C9\00CD\00D3\00DA\00D1\00E1\00E9\00ED\00F3\00FA\00F1\00FC', 'AEIOUNaeiounu')), '[^a-z0-9]', '', 'g'), 12);
  if char_length(base) < 3 then base := 'grupo'; end if;
  loop
    nuevo_codigo := base || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from grupos where lower(codigo) = nuevo_codigo);
    intentos := intentos + 1;
    if intentos > 30 then
      nuevo_codigo := base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
      exit;
    end if;
  end loop;

  insert into grupos (nombre, codigo, con_bocha, creado_por) values (limpio, nuevo_codigo, false, auth.uid()) returning id into nuevo;
  insert into miembros_grupo (usuario_id, grupo_id) values (auth.uid(), nuevo) on conflict do nothing;
  perform set_config('lomada.cambiar_grupo', 'si', true);
  update perfiles set grupo_id = nuevo where id = auth.uid();
  perform set_config('lomada.cambiar_grupo', '', true);
  return jsonb_build_object('id', nuevo, 'nombre', limpio, 'codigo', nuevo_codigo);
end;
$$;

-- 5. Pedir entrar con el codigo. Queda pendiente hasta que el admin acepte.
create or replace function public.pedir_entrar_a_grupo(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  grupo grupos;
  nueva uuid;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  select * into grupo from grupos where lower(codigo) = lower(btrim(coalesce(p_codigo, '')));
  if grupo.id is null or exists (select 1 from salidas_grupo where usuario_id = auth.uid() and grupo_id = grupo.id) then
    perform pg_sleep(0.5); -- Hace lentos los intentos de adivinar codigos.
    raise exception 'codigo_invalido';
  end if;
  if exists (select 1 from miembros_grupo where usuario_id = auth.uid() and grupo_id = grupo.id) then
    return jsonb_build_object('estado', 'ya_estas', 'id', grupo.id, 'nombre', grupo.nombre);
  end if;
  if exists (select 1 from solicitudes_grupo where usuario_id = auth.uid() and grupo_id = grupo.id and estado = 'pendiente') then
    return jsonb_build_object('estado', 'pendiente', 'id', grupo.id, 'nombre', grupo.nombre);
  end if;
  if (select count(*) from solicitudes_grupo where usuario_id = auth.uid() and estado = 'pendiente') >= 5 then
    raise exception 'demasiados_pedidos';
  end if;
  if grupo.creado_por is null then raise exception 'grupo_sin_admin'; end if;

  insert into solicitudes_grupo (usuario_id, grupo_id) values (auth.uid(), grupo.id) returning id into nueva;
  delete from solicitudes_grupo where estado <> 'pendiente' and respondido_en < now() - interval '30 days';
  perform pedir_aviso_grupo('solicitud_grupo', nueva);
  return jsonb_build_object('estado', 'pendiente', 'id', grupo.id, 'nombre', grupo.nombre);
end;
$$;

-- La funcion vieja (la usan las apps sin actualizar) ya no mete a nadie directo: tambien pide.
create or replace function public.unirme_a_grupo(p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return (public.pedir_entrar_a_grupo(p_codigo))->>'nombre';
end;
$$;

-- 6. Mis pedidos sin responder (para mostrar "esperando que te acepten") y cancelarlos.
create or replace function public.mis_solicitudes()
returns table (grupo_id uuid, nombre text, creado_en timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.grupo_id, g.nombre, s.creado_en
  from solicitudes_grupo s join grupos g on g.id = s.grupo_id
  where s.usuario_id = auth.uid() and s.estado = 'pendiente'
  order by s.creado_en;
$$;

create or replace function public.cancelar_solicitud(p_grupo uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from solicitudes_grupo where usuario_id = auth.uid() and grupo_id = p_grupo and estado = 'pendiente';
$$;

-- 7. Para el admin: los pedidos de su grupo, aceptar o rechazar, el codigo y sacar a alguien.
create or replace function public.solicitudes_de_grupo(p_grupo uuid)
returns table (id uuid, usuario_id uuid, nombre text, usuario text, creado_en timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_de_grupo(p_grupo) then raise exception 'no_sos_admin'; end if;
  return query
    select s.id, s.usuario_id, p.nombre, p.usuario, s.creado_en
    from solicitudes_grupo s join perfiles p on p.id = s.usuario_id
    where s.grupo_id = p_grupo and s.estado = 'pendiente'
    order by s.creado_en;
end;
$$;

-- Cuantos esperan en los grupos que administro (para el puntito de Ajustes).
create or replace function public.pedidos_pendientes()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from solicitudes_grupo s join grupos g on g.id = s.grupo_id
  where s.estado = 'pendiente' and g.creado_por = auth.uid();
$$;

create or replace function public.responder_solicitud(p_id uuid, p_aceptar boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s solicitudes_grupo;
begin
  select * into s from solicitudes_grupo where id = p_id and estado = 'pendiente';
  if s.id is null then raise exception 'sin_pedido'; end if;
  if not public.admin_de_grupo(s.grupo_id) then raise exception 'no_sos_admin'; end if;

  update solicitudes_grupo set estado = case when p_aceptar then 'aceptada' else 'rechazada' end, respondido_en = now() where id = p_id;
  if p_aceptar then
    insert into miembros_grupo (usuario_id, grupo_id) values (s.usuario_id, s.grupo_id) on conflict do nothing;
    delete from salidas_grupo where usuario_id = s.usuario_id and grupo_id = s.grupo_id;
    -- Si no estaba en ningun grupo, pasa a ver este.
    perform set_config('lomada.cambiar_grupo', 'si', true);
    update perfiles set grupo_id = s.grupo_id where id = s.usuario_id and grupo_id is null;
    perform set_config('lomada.cambiar_grupo', '', true);
    perform pedir_aviso_grupo('grupo_aceptado', p_id);
  end if;
end;
$$;

create or replace function public.codigo_de_grupo(p_grupo uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_de_grupo(p_grupo) then raise exception 'no_sos_admin'; end if;
  return (select codigo from grupos where id = p_grupo);
end;
$$;

create or replace function public.sacar_de_grupo(p_grupo uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.admin_de_grupo(p_grupo) then raise exception 'no_sos_admin'; end if;
  if p_usuario = auth.uid() then raise exception 'no_a_vos'; end if;
  delete from miembros_grupo where usuario_id = p_usuario and grupo_id = p_grupo;
  -- No puede volver a entrar con el codigo (salvo que el admin lo acepte de nuevo desde un pedido viejo).
  insert into salidas_grupo (usuario_id, grupo_id) values (p_usuario, p_grupo) on conflict do nothing;
  update comidas set grupos = array_remove(grupos, p_grupo) where usuario_id = p_usuario and p_grupo = any(grupos);
end;
$$;

-- 8. Salir: si se va el admin, administra el que mas tiempo lleva. Si no queda nadie, el grupo se borra.
create or replace function public.salir_de_grupo(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  delete from miembros_grupo where usuario_id = auth.uid() and grupo_id = p_grupo;
  -- Las comidas dejan de verse en ese grupo.
  update comidas set grupos = array_remove(grupos, p_grupo) where usuario_id = auth.uid() and p_grupo = any(grupos);
  if exists (select 1 from grupos where id = p_grupo and creado_por = auth.uid()) then
    update grupos set creado_por = (
      select m.usuario_id from miembros_grupo m where m.grupo_id = p_grupo order by m.unido_en limit 1
    ) where id = p_grupo;
    delete from grupos where id = p_grupo and not con_bocha and not exists (select 1 from miembros_grupo where grupo_id = p_grupo);
  end if;
end;
$$;

revoke all on function public.crear_grupo(text), public.pedir_entrar_a_grupo(text), public.unirme_a_grupo(text),
  public.mis_solicitudes(), public.cancelar_solicitud(uuid), public.solicitudes_de_grupo(uuid), public.pedidos_pendientes(),
  public.responder_solicitud(uuid, boolean), public.codigo_de_grupo(uuid), public.sacar_de_grupo(uuid, uuid), public.salir_de_grupo(uuid)
  from public, anon;
grant execute on function public.crear_grupo(text), public.pedir_entrar_a_grupo(text), public.unirme_a_grupo(text),
  public.mis_solicitudes(), public.cancelar_solicitud(uuid), public.solicitudes_de_grupo(uuid), public.pedidos_pendientes(),
  public.responder_solicitud(uuid, boolean), public.codigo_de_grupo(uuid), public.sacar_de_grupo(uuid, uuid), public.salir_de_grupo(uuid)
  to authenticated;

-- 9. Registrarse: el codigo del grupo ahora es opcional. Si se pone, queda el pedido para que el admin acepte;
--    si no, al entrar se crea un grupo o se pide entrar a uno.
create or replace function public.controlar_registro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  usuario_nuevo text := lower(btrim(coalesce(datos->>'usuario', '')));
  codigo_puesto text := btrim(coalesce(datos->>'codigo_grupo', ''));
  grupo uuid;
begin
  if codigo_puesto <> '' then
    select id into grupo from grupos where lower(codigo) = lower(codigo_puesto);
    if grupo is null then
      raise exception 'codigo_invalido';
    end if;
  end if;
  if usuario_nuevo !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'usuario_invalido';
  end if;
  if exists (select 1 from perfiles where lower(usuario) = usuario_nuevo) then
    raise exception 'usuario_ocupado';
  end if;
  -- Lo que mande la app sobre grupos no se usa: solo lo que sale del codigo.
  new.raw_user_meta_data := (datos - 'codigo_grupo' - 'grupo_id' - 'grupo_pedido')
    || case when grupo is null then '{}'::jsonb else jsonb_build_object('grupo_pedido', grupo) end;
  return new;
end;
$$;

create or replace function public.crear_perfil_registrado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pedido uuid := (select id from grupos where id::text = new.raw_user_meta_data->>'grupo_pedido');
  nueva uuid;
begin
  insert into perfiles (id, nombre, usuario, grupo_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'usuario'),
    lower(btrim(new.raw_user_meta_data->>'usuario')),
    null
  );
  if pedido is not null and exists (select 1 from grupos where id = pedido and creado_por is not null) then
    insert into solicitudes_grupo (usuario_id, grupo_id) values (new.id, pedido) returning id into nueva;
    perform pedir_aviso_grupo('solicitud_grupo', nueva);
  end if;
  return new;
end;
$$;

create or replace function public.revisar_registro(p_usuario text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if btrim(coalesce(p_codigo, '')) <> '' and not exists (select 1 from grupos where lower(codigo) = lower(btrim(p_codigo))) then
    perform pg_sleep(0.5); -- Hace lentos los intentos de adivinar el codigo.
    return 'codigo';
  end if;
  if lower(btrim(coalesce(p_usuario, ''))) !~ '^[a-z0-9_.]{3,20}$' then return 'usuario_invalido'; end if;
  if exists (select 1 from perfiles where lower(usuario) = lower(btrim(p_usuario))) then return 'usuario_ocupado'; end if;
  return 'ok';
end;
$$;

revoke all on function public.controlar_registro(), public.crear_perfil_registrado() from public, anon, authenticated;

-- 10. Los avisos: al admin cuando alguien pide entrar, y a quien pidio cuando lo aceptan.
--     Los pide la base y los manda /api/recordatorio con la clave del reloj.
create or replace function public.destinos_grupo(p_clave text, p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  s solicitudes_grupo;
  g grupos;
  quien text;
  para uuid;
  titulo text;
  cuerpo text;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  select * into s from solicitudes_grupo where id = p_id;
  if s.id is null then return null; end if;
  select * into g from grupos where id = s.grupo_id;
  select coalesce(nombre, usuario) into quien from perfiles where id = s.usuario_id;

  if p_tipo = 'solicitud_grupo' and s.estado = 'pendiente' then
    para := g.creado_por;
    titulo := U&'\+01F64B ' || coalesce(quien, 'Alguien') || ' quiere entrar a ' || g.nombre;
    cuerpo := U&'Toc\00E1 para aceptarlo o rechazarlo.';
  elsif p_tipo = 'grupo_aceptado' and s.estado = 'aceptada' then
    para := s.usuario_id;
    titulo := U&'\2705 Ya est\00E1s en ' || g.nombre;
    cuerpo := U&'Te aceptaron en el grupo. Entr\00E1 y sub\00ED tu primera comida.';
  else
    return null;
  end if;
  if para is null then return null; end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', cuerpo,
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', x.endpoint, 'p256dh', x.p256dh, 'auth', x.auth))
      from suscripciones_push x where x.usuario_id = para
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.destinos_grupo(text, text, uuid) from public;
grant execute on function public.destinos_grupo(text, text, uuid) to anon;

select 'Listo: todos pueden crear grupos y el admin acepta a los que entran.' as resultado;
