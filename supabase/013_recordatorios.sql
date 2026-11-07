-- Recordatorio diario de las 21 y resumen semanal con podios.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 012_mejoras.sql.
-- Si cambia la dirección de la app, hay que volver a correrlo con la dirección nueva.

-- Solo se guarda el resumen de la clave. Nadie puede leerla desde la app.
create table if not exists public.clave_recordatorio (hash text primary key);
alter table public.clave_recordatorio enable row level security;
revoke all on public.clave_recordatorio from anon, authenticated;

create or replace function public.armar_resumen_semanal()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  fin date := date_trunc('week', ahora)::date - 1;
  inicio date := fin - 6;
  grupo_comidas integer;
  grupo_fotos integer;
  constancia text;
  proteina text;
  calorias text;
  texto text;
  miles constant text := 'FM999G999';
begin
  -- El lunes espera a las 9, para contar lo que se cargue tarde el domingo.
  if extract(isodow from ahora) = 1 and extract(hour from ahora) < 9 then return null; end if;
  if exists (select 1 from mensajes where bot_semana = inicio) then return null; end if;

  create temporary table semana on commit drop as
    select p.nombre,
           sum(coalesce(c.calorias, 0))::integer as kcal,
           round(sum(coalesce(c.proteinas, 0)))::integer as proteinas,
           count(*) filter (where c.tipo <> 'resumen')::integer as comidas,
           count(c.foto_path)::integer as fotos,
           count(distinct c.fecha)::integer as dias
    from comidas c
    join perfiles p on p.id = c.usuario_id
    where c.fecha between inicio and fin and not c.privada
    group by p.id, p.nombre;

  select sum(comidas), sum(fotos) into grupo_comidas, grupo_fotos from semana;
  if grupo_comidas is null then
    drop table semana;
    return null;
  end if;

  select string_agg(format('%s. %s, %s de 7 días', puesto, nombre, dias), E'\n' order by puesto) into constancia
  from (select *, row_number() over (order by dias desc, comidas desc, nombre) as puesto from semana) s where puesto <= 3;

  select string_agg(format('%s. %s, %s g', puesto, nombre, replace(to_char(proteinas, miles), ',', '.')), E'\n' order by puesto) into proteina
  from (select *, row_number() over (order by proteinas desc, nombre) as puesto from semana) s where puesto <= 3;

  select string_agg(format('%s. %s, %s kcal', puesto, nombre, replace(to_char(kcal, miles), ',', '.')), E'\n' order by puesto) into calorias
  from (select *, row_number() over (order by kcal desc, nombre) as puesto from semana) s where puesto <= 3;

  texto := format(E'Resumen de la semana (%s al %s)\nEntre todos: %s comidas y %s fotos\n\nConstancia\n%s\n\nProteína\n%s\n\nMás comió\n%s',
    to_char(inicio, 'DD/MM'), to_char(fin, 'DD/MM'), grupo_comidas, grupo_fotos, constancia, proteina, calorias);

  insert into mensajes (usuario_id, texto, bot_semana) values (null, texto, inicio) on conflict (bot_semana) do nothing;
  drop table semana;
  return texto;
end;
$$;
revoke all on function public.armar_resumen_semanal() from public, anon, authenticated;

-- Si alguien abre la app después de la hora, igual se publica.
create or replace function public.publicar_resumen_semanal()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return; end if;
  -- Unos minutos de margen para que el aviso programado salga primero.
  if now() at time zone 'America/Argentina/Buenos_Aires' < date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '9 hours 10 minutes' then return; end if;
  perform armar_resumen_semanal();
end;
$$;

create or replace function public.destinos_programados(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  if p_tipo = 'recordatorio' then
    return jsonb_build_object(
      'titulo', 'Son las 21. ¿Cargaste todo?',
      'cuerpo', 'Subí tus comidas de hoy, gordito.',
      'vista', 'resumen',
      -- No se le avisa a quien ya cargó el día.
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where not exists (select 1 from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy and c.tipo = 'resumen')
          and (select count(*) from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy) < 3
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'semana' then
    if armar_resumen_semanal() is null then return null; end if;
    return jsonb_build_object(
      'titulo', 'Salieron los podios de la semana',
      'cuerpo', 'Mirá cómo quedó cada uno en el chat.',
      'vista', 'chat',
      'destinos', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from suscripciones_push s), '[]'::jsonb)
    );
  end if;
  raise exception 'tipo_invalido';
end;
$$;

create or replace function public.limpiar_suscripciones(p_clave text, p_endpoints text[])
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  delete from suscripciones_push where endpoint = any(p_endpoints);
end;
$$;

-- Las llama el servidor sin sesión: las protege la clave, no el usuario.
revoke all on function public.destinos_programados(text, text), public.limpiar_suscripciones(text, text[]) from public;
grant execute on function public.destinos_programados(text, text), public.limpiar_suscripciones(text, text[]) to anon;

-- El reloj corre en hora universal: 00:00 son las 21 en Argentina y 12:00 son las 9.
do $$
declare
  destino constant text := 'https://lomada-fuel.vercel.app/api/recordatorio';
  clave text := encode(extensions.gen_random_bytes(32), 'hex');
  encabezados text;
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;

  delete from public.clave_recordatorio;
  insert into public.clave_recordatorio (hash) values (encode(extensions.digest(clave, 'sha256'), 'hex'));
  encabezados := jsonb_build_object('content-type', 'application/json', 'x-clave', clave)::text;

  perform cron.schedule('lomada-recordatorio', '0 0 * * *',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 20000)', destino, encabezados, '{"tipo":"recordatorio"}'));
  perform cron.schedule('lomada-semana', '0 12 * * 1',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 20000)', destino, encabezados, '{"tipo":"semana"}'));

  perform set_config('lomada.recordatorio', 'Recordatorios activos', false);
exception when others then
  perform set_config('lomada.recordatorio', 'Recordatorios sin activar: ' || sqlerrm, false);
end;
$$;
