-- 053: registros diarios a medida (futbol, running, lo que cada uno escriba) y recordatorios propios:
-- varios, a la hora que quiera cada uno (cada 15 minutos), los dias que elija y con su texto.
-- El aviso fijo de las 20 pasa a ser un recordatorio mas (20:00, solo si falta tildar algo), que se puede cambiar o borrar.
-- Ejecutar en el SQL Editor de Supabase, despues de 052. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.registros_config') is null then
    raise exception 'Falta correr antes el SQL 043_registros_diarios.sql';
  end if;
  if to_regprocedure('public.destinos_match(text, text, date)') is null then
    raise exception 'Falta correr antes el SQL 052_viaje_y_matchday_propios.sql';
  end if;
end $$;

-- 1. Los registros ya no son solo creatina, gym y magnesio.
alter table public.registros_diarios drop constraint if exists registros_diarios_codigo_check;
alter table public.registros_diarios add constraint registros_diarios_codigo_check check (codigo ~ '^[a-z0-9-]{1,40}$');
alter table public.registros_config drop constraint if exists registros_config_activos_check;
alter table public.registros_config add constraint registros_config_activos_check check (cardinality(activos) <= 15);
-- Los que escribe cada uno: [{codigo, nombre, tipo}] (tipo: actividad, tomar u otro).
alter table public.registros_config add column if not exists personalizados jsonb not null default '[]'::jsonb;
alter table public.registros_config drop constraint if exists registros_config_personalizados_check;
alter table public.registros_config add constraint registros_config_personalizados_check
  check (jsonb_typeof(personalizados) = 'array' and jsonb_array_length(personalizados) <= 10);

-- 2. Recordatorios propios.
create table if not exists public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  hora smallint not null check (hora between 0 and 23),
  minuto smallint not null default 0 check (minuto in (0, 15, 30, 45)),
  dias smallint[] not null default '{0,1,2,3,4,5,6}' check (dias <@ array[0,1,2,3,4,5,6]::smallint[] and cardinality(dias) >= 1),
  texto text check (texto is null or char_length(texto) between 1 and 80),
  solo_si_falta boolean not null default false,
  activo boolean not null default true,
  ultimo_envio timestamptz,
  creado_en timestamptz not null default now()
);
create index if not exists recordatorios_hora on public.recordatorios (hora, minuto) where activo;
alter table public.recordatorios enable row level security;
revoke all on public.recordatorios from anon, authenticated;
grant select, insert, update, delete on public.recordatorios to authenticated;
drop policy if exists "recordatorios: propios" on public.recordatorios;
create policy "recordatorios: propios" on public.recordatorios for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Hasta 10 por persona; ultimo_envio lo maneja la base.
create or replace function public.recordatorios_control()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from recordatorios where usuario_id = new.usuario_id) >= 10 then
      raise exception 'maximo_recordatorios';
    end if;
    new.ultimo_envio := null;
  else
    new.ultimo_envio := old.ultimo_envio;
  end if;
  return new;
end;
$$;
drop trigger if exists recordatorios_control on public.recordatorios;
create trigger recordatorios_control before insert or update on public.recordatorios
  for each row execute function public.recordatorios_control();

-- 3. El aviso de las 20 de antes pasa a ser un recordatorio (una sola vez).
insert into public.recordatorios (usuario_id, hora, minuto, solo_si_falta)
select rc.usuario_id, 20, 0, true
from public.registros_config rc
where rc.aviso and cardinality(rc.activos) > 0
  and not exists (select 1 from public.recordatorios r where r.usuario_id = rc.usuario_id);
update public.registros_config set aviso = false where aviso;

-- 4. A quien le toca ahora. Lo llama el reloj cada 15 minutos.
create or replace function public.destinos_propios(p_clave text, p_tipo text, p_ahora timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  local timestamp := (coalesce(p_ahora, now()) at time zone 'America/Argentina/Buenos_Aires');
  hoy date := local::date;
  h int := extract(hour from local)::int;
  m int := (floor(extract(minute from local) / 15) * 15)::int;
  franja timestamptz := (date_trunc('hour', local) + make_interval(mins => m)) at time zone 'America/Argentina/Buenos_Aires';
  destinos jsonb;
  ids uuid[];
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'propios' then return null; end if;

  with tocan as (
    select r.*,
      -- Lo que falta tildar hoy, con el nombre de cada registro.
      (select string_agg(coalesce(
                (select p->>'nombre' from jsonb_array_elements(rc.personalizados) p where p->>'codigo' = c.codigo limit 1),
                case c.codigo
                  when 'creatina' then 'creatina' when 'gym' then 'gym' when 'magnesio' then 'magnesio'
                  when 'futbol' then U&'f\00FAtbol' when 'running' then 'running' when 'proteina' then U&'prote\00EDna'
                  when 'vitaminas' then 'vitaminas' when 'caminata' then 'caminata' when 'padel' then U&'p\00E1del'
                  when 'estirar' then 'estirar' when 'agua' then 'agua'
                  else c.codigo end), ', ' order by c.orden)
       from registros_config rc
       cross join lateral unnest(rc.activos) with ordinality as c(codigo, orden)
       where rc.usuario_id = r.usuario_id
         and not exists (select 1 from registros_diarios d where d.usuario_id = r.usuario_id and d.fecha = hoy and d.codigo = c.codigo)
      ) as falta
    from recordatorios r
    where r.activo and r.hora = h and r.minuto = m
      and extract(dow from hoy)::smallint = any(r.dias)
      and (r.ultimo_envio is null or r.ultimo_envio < franja)
  ), validos as (
    select * from tocan where not solo_si_falta or falta is not null
  )
  select
    jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'titulo', coalesce(v.texto, case when v.solo_si_falta then U&'\00BFYa tildaste lo de hoy?' else 'Recordatorio' end),
      'cuerpo', case when v.solo_si_falta and v.falta is not null then 'Te falta: ' || v.falta || '.' else U&'Toc\00E1 para abrir Lomada Fuel.' end)),
    array_agg(distinct v.id)
  into destinos, ids
  from validos v join suscripciones_push s on s.usuario_id = v.usuario_id;

  -- Se marcan todos los que tocaban (aunque no tengan celular anotado), para no repetir en la misma franja.
  update recordatorios set ultimo_envio = coalesce(p_ahora, now())
  where id in (select id from recordatorios r where r.activo and r.hora = h and r.minuto = m
               and extract(dow from hoy)::smallint = any(r.dias) and (r.ultimo_envio is null or r.ultimo_envio < franja));

  if destinos is null then return null; end if;
  return jsonb_build_object('titulo', 'Recordatorio', 'cuerpo', 'Lomada Fuel', 'vista', 'resumen', 'destinos', destinos);
end;
$$;
revoke all on function public.destinos_propios(text, text, timestamptz) from public;
grant execute on function public.destinos_propios(text, text, timestamptz) to anon;

-- 5. Categoria (se apaga junto con los registros) y el filtro (no depende de estar en un grupo).
create or replace function public.categoria_aviso(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo = 'mensaje' then 'mensajes'
    when p_tipo in ('reaccion', 'reaccion_mensaje') then 'reacciones'
    when p_tipo in ('comida', 'postre') then 'comidas'
    when p_tipo in ('invitacion', 'salida') then 'invitaciones'
    when p_tipo = 'medalla' then 'logros'
    when p_tipo = 'recordatorio' then 'recordatorio'
    when p_tipo in ('caca', 'anuncio_caca') then 'caca'
    when p_tipo in ('registros', 'propios') then 'registros'
    when p_tipo = 'semana' then 'semana'
    when p_tipo = 'informe' then 'informe'
    when p_tipo in ('matchday', 'matchday_previa', 'viaje') then 'lomada'
    when p_tipo in ('mejora', 'mejora_hecha') then 'mejoras'
    when p_tipo in ('solicitud_grupo', 'grupo_aceptado') then 'grupos'
    else null
  end;
$$;

create or replace function public.filtrar_destinos(p_clave text, p_tipo text, p_endpoints text[])
returns text[]
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  return coalesce((
    select array_agg(s.endpoint)
    from suscripciones_push s
    where s.endpoint = any(p_endpoints)
      -- El viaje y el Match Day son de cada uno (SQL 052): no dependen del grupo.
      and (p_tipo in ('viaje', 'matchday', 'matchday_previa', 'propios') or exists (
        select 1 from miembros_grupo m join grupos g on g.id = m.grupo_id
        where m.usuario_id = s.usuario_id and (g.con_bocha or p_tipo <> 'anuncio_caca')
      ))
      and public.aviso_permitido(s.usuario_id, p_tipo)
  ), '{}');
end;
$$;

-- 6. Relojes: el de cada 15 minutos; el viejo de las 20 ya no hace falta.
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-propios', '*/15 * * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"propios"}'));
  if exists (select 1 from cron.job where jobname = 'lomada-registros') then
    perform cron.unschedule('lomada-registros');
  end if;
end $$;

select 'Listo: registros a medida y ' || count(*) || ' recordatorios propios.' as resultado from public.recordatorios;
