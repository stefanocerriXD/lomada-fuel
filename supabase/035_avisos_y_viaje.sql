-- Avisos de comidas: sin el "Y vos?", y la primera comida del dia del grupo (desayuno, almuerzo, merienda, cena) trae un texto extra.
-- Avisos del viaje a Floripa: no se repiten, y el de arranque sale aunque se haya pasado el dia.
-- Al final revisa que ningun texto de la base haya quedado con caracteres raros.
-- Este archivo es solo ASCII a proposito: las tildes y emojis van como codigos (U&'...') y no se pueden romper al copiarlo.
-- Ejecutar en el SQL Editor de Supabase, despues de 034_grupos.sql. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.grupos') is null then
    raise exception 'Falta correr antes el SQL de grupos (034_grupos.sql)';
  end if;
end $$;

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
  tipo_c text;
  extra text;
  variante int := get_byte(decode(md5(p_id::text), 'hex'), 1) % 2;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre, meta_calorias, modo_total into autor, meta, modo from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select coalesce(nullif(texto, ''), case when adjunto_path ~* '\.(m4a|mp4|webm|ogg|aac)$' then U&'Mand\00F3 un audio \+01F3A4' when adjunto_path is not null then U&'Mand\00F3 una foto \+01F4F7' when sticker is not null then sticker end), creado_en, respuesta_comida is not null
    into cuerpo, creado, responde from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then U&' respondi\00F3 una foto' else '' end;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null, coalesce(calorias, 0), coalesce(proteinas, 0), fecha, tipo
    into cuerpo, creado, privada_c, con_foto, kcal, prote, dia, tipo_c
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    select total_del_dia(modo, sum(calorias) filter (where tipo <> 'resumen'), sum(calorias) filter (where tipo = 'resumen'))
    into total_dia from comidas where usuario_id = yo and fecha = dia;
    -- El titulo va corto para que entre en una linea; la parte graciosa va abajo.
    titulo := case
      when kcal >= 1500 then autor || ': ' || replace(to_char(kcal, 'FM9,999'), ',', '.') || ' kcal'
      when total_dia > meta + 500 then autor || U&' pas\00F3 su meta'
      when hora_local < 5 then autor || U&' atac\00F3 la heladera'
      when prote >= 60 then autor || U&', modo prote\00EDna'
      else autor || case when con_foto then U&' subi\00F3 una foto' else U&' subi\00F3 una comida' end
    end;
    -- La primera de cada comida del dia en el grupo (sin colaciones) trae un saludo.
    if dia = (now() at time zone 'America/Argentina/Buenos_Aires')::date
       and tipo_c in ('desayuno', 'almuerzo', 'merienda', 'cena')
       and not exists (
         select 1 from comidas o join perfiles po on po.id = o.usuario_id
         where o.fecha = dia and o.tipo = tipo_c and o.id <> p_id and not o.privada and o.creado_en <= creado
           and po.grupo_id = (select grupo_id from perfiles where id = yo)
       ) then
      extra := case tipo_c
        when 'desayuno' then case variante when 0 then U&'\2600\FE0F Buen d\00EDa, grupo. Abri\00F3 los desayunos' else U&'\2600\FE0F Buen d\00EDa. Primer desayuno del d\00EDa' end
        when 'almuerzo' then case variante when 0 then U&'\+01F37D\FE0F Ya est\00E1n empezando a almorzar' else U&'\+01F37D\FE0F Arrancaron los almuerzos' end
        when 'merienda' then case variante when 0 then U&'\+01F9C9 Ya se est\00E1 merendando' else U&'\+01F9C9 Abri\00F3 la merienda: \00BFmate o caf\00E9?' end
        else case variante when 0 then U&'\+01F319 Ya est\00E1n empezando a cenar' else U&'\+01F319 Arrancaron las cenas' end
      end;
    end if;
    cuerpo := concat_ws(U&' \00B7 ', extra, case when extra is not null then null else case
      when kcal >= 1500 then U&'Se la mand\00F3 entera'
      when total_dia > meta + 500 then 'Que alguien le saque el plato'
      when hora_local < 5 or prote >= 60 then null
      else case get_byte(decode(md5(p_id::text), 'hex'), 0) % 12
        when 1 then U&'Ya public\00F3'
        when 2 then U&'Mir\00E1 antes de que se enfr\00EDe'
      end
    end end, cuerpo);
    if con_foto then vista := 'imagenes'; end if;
  elsif p_tipo = 'comentario' then
    select k.texto, k.creado_en, c.usuario_id, c.privada into cuerpo, creado, solo_para, privada_c
    from comentarios k join comidas c on c.id = k.comida_id
    where k.id = p_id and k.usuario_id = yo;
    if privada_c or solo_para = yo then return null; end if;
    titulo := autor || U&' coment\00F3 tu comida';
  else
    raise exception 'tipo_invalido';
  end if;

  -- Solo se avisa algo recien creado por quien lo pide.
  if creado is null or creado < now() - interval '2 minutes' then return null; end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', left(coalesce(cuerpo, U&'Mir\00E1 qu\00E9 comi\00F3'), 120),
    'vista', vista,
    'destinos', coalesce((
      -- A quien mencionan con @ le llega un titulo propio.
      select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
        'titulo', case when p_tipo = 'mensaje' and position(lower('@' || p.nombre) in lower(cuerpo)) > 0 then autor || U&' te mencion\00F3' end
      ))
      from suscripciones_push s join perfiles p on p.id = s.usuario_id
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
        and p.grupo_id = (select grupo_id from perfiles where id = yo)
    ), '[]'::jsonb)
  );
end;
$$;

-- Lo que ya mando el viaje, para no repetir.
create table if not exists public.avisos_viaje (
  clave text primary key,
  enviado_en timestamptz not null default now()
);
alter table public.avisos_viaje enable row level security;
revoke all on public.avisos_viaje from anon, authenticated;

create or replace function public.destinos_viaje(p_clave text, p_tipo text, p_hoy date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := coalesce(p_hoy, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  faltan int := date '2026-12-26' - hoy;
  cual text;
  titulo text;
  cuerpo text;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'viaje' or faltan < 1 then return null; end if;

  if faltan = 30 then
    cual := '30'; titulo := U&'\+01F3D6\FE0F Falta un mes para Floripa'; cuerpo := U&'30 d\00EDas. Es ahora o nunca para los cuadraditos \+01F4AA';
  elsif faltan = 15 then
    cual := '15'; titulo := U&'\23F3 15 d\00EDas para Floripa'; cuerpo := U&'Dos semanas. Cuid\00E1 las comidas, que la malla no perdona \+01F605';
  elsif faltan = 7 then
    cual := '7'; titulo := U&'\+01F525 \00DAltima semana para Floripa'; cuerpo := U&'7 d\00EDas. Recta final: prote\00EDna, agua y cero excusas.';
  elsif faltan = 2 then
    cual := '2'; titulo := U&'\+01F9F3 Pasado ma\00F1ana, Floripa'; cuerpo := U&'Faltan 2 d\00EDas. Arm\00E1 la valija y no aflojes ahora.';
  elsif faltan = 1 then
    cual := '1'; titulo := U&'\2708\FE0F Ma\00F1ana nos vamos a Floripa'; cuerpo := U&'\00DAltimo d\00EDa. Que los cuadraditos lleguen intactos \+01F3DD\FE0F';
  elsif faltan > 30 and not exists (select 1 from avisos_viaje where avisos_viaje.clave = 'arranque') then
    -- El de arranque sale el primer dia que se pueda, aunque ya haya pasado el 12/11.
    cual := 'arranque'; titulo := U&'\2708\FE0F Arranca la cuenta regresiva a Floripa';
    cuerpo := format(U&'Faltan %s d\00EDas. Est\00E1 en Progreso: hay que llegar al viaje con cuadraditos \+01F3D6\FE0F', faltan);
  else
    return null;
  end if;

  if exists (select 1 from avisos_viaje where avisos_viaje.clave = cual) then return null; end if;
  insert into avisos_viaje (clave) values (cual);

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', cuerpo,
    'vista', 'resumen',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s join perfiles p on p.id = s.usuario_id join grupos g on g.id = p.grupo_id
      where g.con_bocha
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.destinos_viaje(text, text, date) from public;
grant execute on function public.destinos_viaje(text, text, date) to anon;

-- Programa el aviso de las 9 y, si el de arranque no salio, lo manda ahora.
do $$
declare
  pedido text;
  ya_salio boolean := false;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  pedido := replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"viaje"}');
  perform cron.schedule('lomada-viaje', '0 12 * * *', pedido);

  -- Si el reloj ya lo mando hoy a las 9 con el SQL anterior, no se repite.
  begin
    select exists (
      select 1 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
      where j.jobname = 'lomada-viaje' and d.status = 'succeeded' and d.start_time >= '2026-11-12'
    ) into ya_salio;
  exception when others then
    ya_salio := false;
  end;

  if ya_salio then
    insert into public.avisos_viaje (clave) values ('arranque') on conflict do nothing;
    perform set_config('lomada.viaje', U&'El aviso de arranque ya hab\00EDa salido', false);
  elsif not exists (select 1 from public.avisos_viaje where clave = 'arranque') then
    execute pedido;
    perform set_config('lomada.viaje', 'Aviso de arranque mandado', false);
  else
    perform set_config('lomada.viaje', 'Avisos del viaje programados', false);
  end if;
exception when others then
  perform set_config('lomada.viaje', 'No se pudo programar el viaje: ' || sqlerrm, false);
end $$;

-- Revision: ?quedo algun texto con caracteres raros en las funciones o en los mensajes?
do $$
declare
  marcas constant text := '[' || chr(9516) || chr(9500) || chr(212) || chr(8801) || chr(9532) || ']';
  funciones int;
  mensajes int;
begin
  select count(*) into funciones from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~ marcas;
  select count(*) into mensajes from public.mensajes where texto ~ marcas;
  perform set_config('lomada.textos', case when funciones + mensajes = 0 then 'Textos bien, sin caracteres raros'
    else format('Quedan textos raros: %s funciones y %s mensajes', funciones, mensajes) end, false);
end $$;

select current_setting('lomada.viaje', true) || '. ' || current_setting('lomada.textos', true) || '.' as resultado;
