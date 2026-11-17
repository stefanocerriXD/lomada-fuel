-- 047: aviso a los administradores de la app cuando algo del plan gratis se esta por llenar.
-- Fotos (1 GB) y base (500 MB): un aviso al pasar el 70, el 85 y el 95 por ciento (una vez cada uno).
-- La IA (Gemini gratis): un aviso el dia que se queda sin cupo.
-- Ejecutar en el SQL Editor de Supabase, despues de 046. Se puede correr mas de una vez.

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'lomada-recordatorio') then
    raise exception 'Falta el recordatorio de las 21 (lomada-recordatorio)';
  end if;
end $$;

-- 1. Lo ultimo que se aviso de cada cosa (para no repetir).
create table if not exists public.uso_avisos (
  clave text primary key,
  nivel integer not null default 0,
  fecha date
);
alter table public.uso_avisos enable row level security;
revoke all on public.uso_avisos from anon, authenticated;

-- 2. Cuanto se usa.
create or replace function public.medir_uso()
returns jsonb
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select jsonb_build_object(
    'fotos_bytes', coalesce((select sum(coalesce((metadata->>'size')::bigint, 0)) from storage.objects), 0),
    'fotos_cantidad', (select count(*) from storage.objects),
    'fotos_bytes_30_dias', coalesce((select sum(coalesce((metadata->>'size')::bigint, 0)) from storage.objects where created_at > now() - interval '30 days'), 0),
    'fotos_limite', 1073741824,
    'base_bytes', pg_database_size(current_database()),
    'base_limite', 524288000,
    'ia_sin_cupo', (select fecha from uso_avisos where clave = 'ia')
  );
$$;
revoke all on function public.medir_uso() from public, anon, authenticated;

-- Para la pantalla de Ajustes: solo los administradores de la app.
create or replace function public.uso_de_la_app()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin() then raise exception 'no_sos_admin'; end if;
  return public.medir_uso();
end;
$$;
revoke all on function public.uso_de_la_app() from public, anon;
grant execute on function public.uso_de_la_app() to authenticated;

-- 3. Pide un aviso con el mismo pedido que usa el recordatorio de las 21.
create or replace function public.pedir_aviso_tipo(p_tipo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is not null and p_tipo ~ '^[a-z_]{1,30}$' then
    execute replace(pedido, '{"tipo":"recordatorio"}', format('{"tipo":"%s"}', p_tipo));
  end if;
exception when others then
  null;
end;
$$;
revoke all on function public.pedir_aviso_tipo(text) from public, anon, authenticated;

-- La API avisa cuando Gemini dice que no hay mas cupo. Un aviso por dia como mucho.
create or replace function public.anotar_ia_sin_cupo()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  cambio integer;
begin
  insert into uso_avisos (clave, nivel, fecha) values ('ia', 1, hoy)
  on conflict (clave) do update set fecha = excluded.fecha where uso_avisos.fecha is distinct from excluded.fecha;
  get diagnostics cambio = row_count;
  if cambio > 0 then
    perform pedir_aviso_tipo('ia_sin_cupo');
  end if;
end;
$$;
revoke all on function public.anotar_ia_sin_cupo() from public;
grant execute on function public.anotar_ia_sin_cupo() to anon, authenticated;

-- 4. A quien avisar y que decirle. La llama /api/recordatorio con la clave del reloj.
create or replace function public.destinos_uso(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uso jsonb := public.medir_uso();
  titulo text;
  cuerpo text;
  partes text[] := '{}';
  peor integer := 0;
  r record;
  pct integer;
  nivel integer;
  antes integer;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  if p_tipo = 'uso' then
    for r in select * from (values
      ('fotos', 'las fotos', (uso->>'fotos_bytes')::numeric, (uso->>'fotos_limite')::numeric),
      ('base', 'la base de datos', (uso->>'base_bytes')::numeric, (uso->>'base_limite')::numeric)
    ) as x(clave, nombre, usado, limite)
    loop
      pct := floor(100 * r.usado / r.limite);
      nivel := case when pct >= 95 then 95 when pct >= 85 then 85 when pct >= 70 then 70 else 0 end;
      select coalesce((select u.nivel from uso_avisos u where u.clave = r.clave), 0) into antes;
      if nivel <> antes then
        insert into uso_avisos (clave, nivel) values (r.clave, nivel)
        on conflict (clave) do update set nivel = excluded.nivel;
      end if;
      -- Se avisa solo al subir de escalon (si se libero espacio, baja sin avisar).
      if nivel > antes then
        partes := partes || format('%s al %s%% (%s de %s MB)', r.nombre, pct, round(r.usado / 1048576), round(r.limite / 1048576));
        peor := greatest(peor, pct);
      end if;
    end loop;
    if cardinality(partes) = 0 then return null; end if;
    titulo := U&'\26A0\FE0F Lomada Fuel: ' || array_to_string(partes, ' y ') || ' del plan gratis';
    cuerpo := case when peor >= 95
      then U&'Est\00E1 por llenarse. Hay que reducir ya: entr\00E1 a Ajustes > Espacio de la app.'
      else U&'Todav\00EDa hay margen, pero conviene ir reduciendo. Mir\00E1 Ajustes > Espacio de la app.' end;
  elsif p_tipo = 'ia_sin_cupo' then
    titulo := U&'\26A0\FE0F La IA gratis lleg\00F3 al l\00EDmite';
    cuerpo := U&'Gemini dej\00F3 de responder por hoy (fotos, capturas y dictado). Vuelve sola; si pasa seguido, lo reducimos.';
  else
    return null;
  end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', cuerpo,
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s join administradores a on a.usuario_id = s.usuario_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.destinos_uso(text, text) from public;
grant execute on function public.destinos_uso(text, text) to anon;

-- 5. Se revisa todos los dias a las 10 (hora argentina).
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  perform cron.schedule('lomada-uso', '0 13 * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"uso"}'));
end $$;

select 'Listo: aviso cuando las fotos, la base o la IA se esten por llenar.' as resultado;
