-- Cuenta regresiva al viaje a Floripa (26/12/2026): avisos a las 9 de la mañana (hora de Argentina).
-- Sale el 12/11 (arranque), y cuando faltan 30, 15, 7, 2 y 1 días. Los demás días no manda nada.
-- Usa el mismo pedido que el recordatorio de las 21, así la clave no sale de la base.
-- Ejecutar en el SQL Editor de Supabase, después de 031_recetas_compartidas.sql.

create or replace function public.destinos_viaje(p_clave text, p_tipo text, p_hoy date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := coalesce(p_hoy, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  faltan int := date '2026-12-26' - hoy;
  titulo text;
  cuerpo text;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'viaje' then return null; end if;

  if hoy = date '2026-11-12' then
    titulo := '✈️ Arranca la cuenta regresiva a Floripa';
    cuerpo := format('Faltan %s días. Está en Progreso: hay que llegar al viaje con cuadraditos 🏖️', faltan);
  elsif faltan = 30 then
    titulo := '🏖️ Falta un mes para Floripa';
    cuerpo := '30 días. Es ahora o nunca para los cuadraditos 💪';
  elsif faltan = 15 then
    titulo := '⏳ 15 días para Floripa';
    cuerpo := 'Dos semanas. Cuidá las comidas, que la malla no perdona 😅';
  elsif faltan = 7 then
    titulo := '🔥 Última semana para Floripa';
    cuerpo := '7 días. Recta final: proteína, agua y cero excusas.';
  elsif faltan = 2 then
    titulo := '🧳 Pasado mañana, Floripa';
    cuerpo := 'Faltan 2 días. Armá la valija y no aflojes ahora.';
  elsif faltan = 1 then
    titulo := '✈️ Mañana nos vamos a Floripa';
    cuerpo := 'Último día. Que los cuadraditos lleguen intactos 🏝️';
  else
    return null;
  end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', cuerpo,
    'vista', 'resumen',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.destinos_viaje(text, text, date) from public;
grant execute on function public.destinos_viaje(text, text, date) to anon;

-- 12:00 en hora universal son las 9 en Argentina.
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-viaje', '0 12 * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"viaje"}'));
  perform set_config('lomada.viaje', 'Avisos del viaje programados', false);
exception when others then
  perform set_config('lomada.viaje', 'No se pudo programar: ' || sqlerrm, false);
end;
$$;

select current_setting('lomada.viaje', true) as resultado;
