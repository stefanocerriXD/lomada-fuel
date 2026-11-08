-- Aviso de los domingos a las 9: hay partido a las 16.
-- Ejecutar en el SQL Editor de Supabase, después de 015_modo_total_y_menciones.sql. Manda el primer aviso en el momento.
-- Si cambia la dirección de la app, hay que volver a correrlo con la dirección nueva.

create or replace function public.destinos_programados(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  todos jsonb;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
  into todos from suscripciones_push s;

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
    return jsonb_build_object('titulo', 'Salieron los podios de la semana', 'cuerpo', 'Mirá cómo quedó cada uno en el chat.', 'vista', 'chat', 'destinos', todos);
  elsif p_tipo = 'matchday' then
    return jsonb_build_object('titulo', 'MATCH DAY', 'cuerpo', 'Día de guerra. No te olvides de publicar tu CARB LOAD.', 'vista', 'resumen', 'destinos', todos);
  end if;
  raise exception 'tipo_invalido';
end;
$$;

revoke all on function public.destinos_programados(text, text) from public;
grant execute on function public.destinos_programados(text, text) to anon;

-- El reloj corre en hora universal: domingo 12:00 son las 9 en Argentina.
do $$
declare
  destino constant text := 'https://lomada-fuel.vercel.app/api/recordatorio';
  clave text := encode(extensions.gen_random_bytes(32), 'hex');
  encabezados text;
  pedido constant text := 'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb, timeout_milliseconds := 20000)';
begin
  delete from public.clave_recordatorio;
  insert into public.clave_recordatorio (hash) values (encode(extensions.digest(clave, 'sha256'), 'hex'));
  encabezados := jsonb_build_object('content-type', 'application/json', 'x-clave', clave)::text;

  perform cron.schedule('lomada-recordatorio', '0 0 * * *', format(pedido, destino, encabezados, '{"tipo":"recordatorio"}'));
  perform cron.schedule('lomada-semana', '0 12 * * 1', format(pedido, destino, encabezados, '{"tipo":"semana"}'));
  perform cron.schedule('lomada-matchday', '0 12 * * 0', format(pedido, destino, encabezados, '{"tipo":"matchday"}'));

  -- El primero sale ahora.
  execute format(pedido, destino, encabezados, '{"tipo":"matchday"}');
  perform set_config('lomada.matchday', 'Match day programado y enviado', false);
exception when others then
  perform set_config('lomada.matchday', 'No se pudo programar: ' || sqlerrm, false);
end;
$$;

select current_setting('lomada.matchday', true) as resultado;
