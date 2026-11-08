-- El aviso de un audio dice que es un audio.
-- Ejecutar en el SQL Editor de Supabase, después de 018_chat_completo.sql.

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
    select coalesce(nullif(texto, ''), case when adjunto_path ~* '\.(m4a|mp4|webm|ogg|aac)$' then 'Mandó un audio 🎤' when adjunto_path is not null then 'Mandó una foto 📷' when sticker is not null then sticker end), creado_en, respuesta_comida is not null
    into cuerpo, creado, responde from mensajes where id = p_id and usuario_id = yo;
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
