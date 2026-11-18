-- 052: cada uno arma SU viaje (destino y fecha) y SU Match Day (deporte, dia y hora), y los avisos salen a medida.
-- Antes el viaje (Floripa) y el Match Day (domingos) eran fijos y solo de la Lomada.
-- A los de la Lomada se les carga Floripa y el partido de los domingos a las 16, asi no pierden nada.
-- Ejecutar en el SQL Editor de Supabase, despues de 048. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.preferencias_avisos') is null then
    raise exception 'Falta correr antes el SQL 048_dueno_mejoras_y_avisos.sql';
  end if;
end $$;

-- 1. Lo de cada uno.
create table if not exists public.motivacion (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  viaje_destino text check (viaje_destino is null or char_length(viaje_destino) between 1 and 40),
  viaje_fecha date,
  viaje_desde date,
  viaje_avisados text[] not null default '{}',
  match_activo boolean not null default false,
  match_dia smallint not null default 0 check (match_dia between 0 and 6),
  match_hora smallint not null default 16 check (match_hora between 0 and 23),
  match_nombre text not null default 'partido' check (char_length(match_nombre) between 1 and 30),
  actualizado_en timestamptz not null default now()
);
alter table public.motivacion enable row level security;
revoke all on public.motivacion from anon, authenticated;
grant select, insert, update, delete on public.motivacion to authenticated;
drop policy if exists "motivacion: propia" on public.motivacion;
create policy "motivacion: propia" on public.motivacion for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Desde la app no se tocan los avisos ya mandados; si cambia el viaje, la cuenta arranca de nuevo.
create or replace function public.motivacion_control()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' or new.viaje_fecha is distinct from old.viaje_fecha or new.viaje_destino is distinct from old.viaje_destino then
    new.viaje_avisados := '{}';
    new.viaje_desde := case when new.viaje_fecha is null then null else hoy end;
  else
    new.viaje_avisados := old.viaje_avisados;
    new.viaje_desde := old.viaje_desde;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
drop trigger if exists motivacion_control on public.motivacion;
create trigger motivacion_control before insert or update on public.motivacion
  for each row execute function public.motivacion_control();

-- 2. Los de la Lomada arrancan con Floripa y el partido del domingo (con los avisos que ya salieron).
insert into public.motivacion (usuario_id, viaje_destino, viaje_fecha, viaje_desde, viaje_avisados, match_activo, match_dia, match_hora, match_nombre)
select distinct m.usuario_id, 'Floripa', date '2026-12-26', date '2026-10-01',
  coalesce((select array_agg(a.clave) from public.avisos_viaje a), '{}'), true, 0, 16, 'partido'
from public.miembros_grupo m join public.grupos g on g.id = m.grupo_id
where g.con_bocha
on conflict (usuario_id) do nothing;

-- 3. El viaje: a cada uno con su destino (un mes, 15, 7, 2 y 1 dias antes, el dia, y uno al arrancar).
create or replace function public.destinos_viaje(p_clave text, p_tipo text, p_hoy date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := coalesce(p_hoy, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  r record;
  faltan int;
  cual text;
  titulo text;
  cuerpo text;
  destinos jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'viaje' then return null; end if;

  for r in select * from motivacion where viaje_fecha is not null and viaje_destino is not null and viaje_fecha >= hoy loop
    faltan := r.viaje_fecha - hoy;
    cual := null;
    if faltan = 0 then
      cual := '0'; titulo := format(U&'\2708\FE0F Hoy viaj\00E1s a %s', r.viaje_destino); cuerpo := U&'Lleg\00F3 el d\00EDa. A disfrutar lo que entrenaste \+01F3DD\FE0F';
    elsif faltan = 1 then
      cual := '1'; titulo := format(U&'\2708\FE0F Ma\00F1ana te vas a %s', r.viaje_destino); cuerpo := U&'\00DAltimo d\00EDa. Que los cuadraditos lleguen intactos \+01F4AA';
    elsif faltan = 2 then
      cual := '2'; titulo := format(U&'\+01F9F3 Pasado ma\00F1ana, %s', r.viaje_destino); cuerpo := U&'Faltan 2 d\00EDas. Arm\00E1 la valija y no aflojes ahora.';
    elsif faltan = 7 then
      cual := '7'; titulo := format(U&'\+01F525 \00DAltima semana para %s', r.viaje_destino); cuerpo := U&'7 d\00EDas. Recta final: prote\00EDna, agua y cero excusas.';
    elsif faltan = 15 then
      cual := '15'; titulo := format(U&'\23F3 15 d\00EDas para %s', r.viaje_destino); cuerpo := U&'Dos semanas. Cuid\00E1 las comidas, que la malla no perdona \+01F605';
    elsif faltan = 30 then
      cual := '30'; titulo := format(U&'\+01F3D6\FE0F Falta un mes para %s', r.viaje_destino); cuerpo := U&'30 d\00EDas. Es ahora o nunca para los cuadraditos \+01F4AA';
    elsif not ('arranque' = any(r.viaje_avisados)) then
      cual := 'arranque'; titulo := format(U&'\2708\FE0F Arranca tu cuenta regresiva a %s', r.viaje_destino);
      cuerpo := format(U&'Faltan %s d\00EDas. La ves en Progreso: a llegar con todo \+01F3D6\FE0F', faltan);
    end if;
    continue when cual is null or cual = any(r.viaje_avisados);

    update motivacion set viaje_avisados = array(select distinct unnest(viaje_avisados || array[cual, 'arranque']))
    where usuario_id = r.usuario_id;
    destinos := destinos || coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth, 'titulo', titulo, 'cuerpo', cuerpo))
      from suscripciones_push s where s.usuario_id = r.usuario_id
    ), '[]'::jsonb);
  end loop;

  if jsonb_array_length(destinos) = 0 then return null; end if;
  return jsonb_build_object('titulo', 'Tu viaje', 'cuerpo', 'Cuenta regresiva', 'vista', 'resumen', 'destinos', destinos);
end;
$$;
revoke all on function public.destinos_viaje(text, text, date) from public;
grant execute on function public.destinos_viaje(text, text, date) to anon;

-- 4. El Match Day: a las 9 del dia del partido; si se juega antes de las 12, la noche anterior a las 21.
create or replace function public.destinos_match(p_clave text, p_tipo text, p_hoy date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := coalesce(p_hoy, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  destinos jsonb;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  if p_tipo = 'matchday' then
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'titulo', U&'MATCH DAY \26BD',
      'cuerpo', format(U&'Hoy a las %s hay %s. D\00EDa de guerra \2694\FE0F: no te olvides de publicar tu CARB LOAD \+01F35D', m.match_hora, m.match_nombre)))
    into destinos
    from motivacion m join suscripciones_push s on s.usuario_id = m.usuario_id
    where m.match_activo and m.match_dia = extract(dow from hoy) and m.match_hora >= 12;
  elsif p_tipo = 'matchday_previa' then
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'titulo', U&'Ma\00F1ana es MATCH DAY \26BD',
      'cuerpo', format(U&'Ma\00F1ana a las %s hay %s. Esta noche cen\00E1 tu CARB LOAD \+01F35D', m.match_hora, m.match_nombre)))
    into destinos
    from motivacion m join suscripciones_push s on s.usuario_id = m.usuario_id
    where m.match_activo and m.match_dia = extract(dow from hoy + 1) and m.match_hora < 12;
  else
    return null;
  end if;

  if destinos is null then return null; end if;
  return jsonb_build_object('titulo', U&'MATCH DAY \26BD', 'cuerpo', 'Hoy se juega', 'vista', 'resumen', 'destinos', destinos);
end;
$$;
revoke all on function public.destinos_match(text, text, date) from public;
grant execute on function public.destinos_match(text, text, date) to anon;

-- 5. Los avisos programados derivan el Match Day a la funcion nueva.
create or replace function public.destinos_programados(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  g record;
  con_resumen uuid[] := '{}';
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  if p_tipo = 'recordatorio' then
    return jsonb_build_object(
      'titulo', U&'Son las 21. \00BFCargaste todo?',
      'cuerpo', U&'Sub\00ED tus comidas de hoy, gordito.',
      'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where exists (select 1 from miembros_grupo m where m.usuario_id = s.usuario_id)
          and not exists (select 1 from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy and c.tipo = 'resumen')
          and (select count(*) from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy) < 3
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'semana' then
    for g in select id from grupos loop
      if armar_resumen_semanal(g.id) is not null then con_resumen := con_resumen || g.id; end if;
    end loop;
    if cardinality(con_resumen) = 0 then return null; end if;
    return jsonb_build_object('titulo', 'Salieron los podios de la semana', 'cuerpo', U&'Mir\00E1 c\00F3mo qued\00F3 cada uno en el chat.', 'vista', 'chat',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where exists (select 1 from miembros_grupo m where m.usuario_id = s.usuario_id and m.grupo_id = any(con_resumen))
      ), '[]'::jsonb));
  elsif p_tipo in ('matchday', 'matchday_previa') then
    -- Ahora cada uno tiene su Match Day (SQL 052).
    return public.destinos_match(p_clave, p_tipo);
  end if;
  raise exception 'tipo_invalido';
end;
$$;

-- 6. Categoria del aviso de la noche anterior (se apaga junto con el Match Day).
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
    when p_tipo = 'registros' then 'registros'
    when p_tipo = 'semana' then 'semana'
    when p_tipo = 'informe' then 'informe'
    when p_tipo in ('matchday', 'matchday_previa', 'viaje') then 'lomada'
    when p_tipo in ('mejora', 'mejora_hecha') then 'mejoras'
    when p_tipo in ('solicitud_grupo', 'grupo_aceptado') then 'grupos'
    else null
  end;
$$;

-- 7. El viaje y el Match Day ya no dependen de estar en la Lomada.
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
      and (p_tipo in ('viaje', 'matchday', 'matchday_previa') or exists (
        select 1 from miembros_grupo m join grupos g on g.id = m.grupo_id
        where m.usuario_id = s.usuario_id and (g.con_bocha or p_tipo <> 'anuncio_caca')
      ))
      and public.aviso_permitido(s.usuario_id, p_tipo)
  ), '{}');
end;
$$;

-- 8. Los relojes: el Match Day mira todos los dias a las 9, y a las 21 el de la noche anterior.
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-matchday', '0 12 * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"matchday"}'));
  perform cron.schedule('lomada-matchday-previa', '0 0 * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"matchday_previa"}'));
end $$;

select 'Listo: viaje y Match Day de cada uno (' || count(*) || ' cargados).' as resultado from public.motivacion;
