-- Aviso de los domingos a las 9 (hay partido a las 16) y títulos de avisos más cortos.
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

-- Títulos cortos: en el celular se cortaban.
create or replace function public.destinos_aviso(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  meta integer;
  modo text;
  titulo text;
  cuerpo text;
  creado timestamptz;
  solo_para uuid;
  privada_c boolean;
  con_foto boolean;
  responde boolean;
  kcal integer;
  prote numeric;
  dia date;
  total_dia integer;
  hora_local integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
  vista text := 'chat';
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre, meta_calorias, modo_total into autor, meta, modo from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select texto, creado_en, respuesta_comida is not null into cuerpo, creado, responde from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then ' respondió una foto' else '' end;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null, coalesce(calorias, 0), coalesce(proteinas, 0), fecha
    into cuerpo, creado, privada_c, con_foto, kcal, prote, dia
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    select total_del_dia(modo, sum(calorias) filter (where tipo <> 'resumen'), sum(calorias) filter (where tipo = 'resumen'))
    into total_dia from comidas where usuario_id = yo and fecha = dia;
    -- El título va corto para que entre en una línea; la parte graciosa va abajo.
    titulo := case
      when kcal >= 1500 then autor || ': ' || replace(to_char(kcal, 'FM9,999'), ',', '.') || ' kcal'
      when total_dia > meta + 500 then autor || ' pasó su meta'
      when hora_local < 5 then autor || ' atacó la heladera'
      when prote >= 60 then autor || ', modo proteína'
      else autor || case when con_foto then ' subió una foto' else ' subió una comida' end
    end;
    cuerpo := concat_ws(' · ', case
      when kcal >= 1500 then 'Se la mandó entera'
      when total_dia > meta + 500 then 'Que alguien le saque el plato'
      when hora_local < 5 or prote >= 60 then null
      else case get_byte(decode(md5(p_id::text), 'hex'), 0) % 12
        when 0 then '¿Y vos?'
        when 1 then 'Ya publicó'
        when 2 then 'Mirá antes de que se enfríe'
      end
    end, cuerpo);
    if con_foto then vista := 'imagenes'; end if;
  elsif p_tipo = 'comentario' then
    select k.texto, k.creado_en, c.usuario_id, c.privada into cuerpo, creado, solo_para, privada_c
    from comentarios k join comidas c on c.id = k.comida_id
    where k.id = p_id and k.usuario_id = yo;
    if privada_c or solo_para = yo then return null; end if;
    titulo := autor || ' comentó tu comida';
  else
    raise exception 'tipo_invalido';
  end if;

  -- Solo se avisa algo recién creado por quien lo pide.
  if creado is null or creado < now() - interval '2 minutes' then return null; end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', left(coalesce(cuerpo, 'Mirá qué comió'), 120),
    'vista', vista,
    'destinos', coalesce((
      -- A quien mencionan con @ le llega un título propio.
      select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
        'titulo', case when p_tipo = 'mensaje' and position(lower('@' || p.nombre) in lower(cuerpo)) > 0 then autor || ' te mencionó' end
      ))
      from suscripciones_push s join perfiles p on p.id = s.usuario_id
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
    ), '[]'::jsonb)
  );
end;
$$;

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
