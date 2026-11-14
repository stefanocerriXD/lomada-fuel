-- 040: avisos mas directos y el postre con nombre y foto propia.
-- 1. El postre de una comida: nombre, foto y cuando se sumo (para avisarle al grupo).
-- 2. Aviso de comida: el titulo de la comida, sin frases armadas. Aviso nuevo cuando alguien suma postre.
-- 3. La caca en el chat: solo los que caen por primera vez (los que ya venian con caca no se repiten).
--    El domingo solo se anuncia el Bocha Evo, y llega un aviso al celular cuando le cae a alguien.
-- 4. Aviso al grupo solo al cambiar de categoria, no por cada logro.
-- Se puede correr mas de una vez.

-- 1. El postre
alter table public.comidas add column if not exists postre_nombre text;
alter table public.comidas add column if not exists postre_foto text;
alter table public.comidas add column if not exists postre_en timestamptz;
alter table public.comidas drop constraint if exists comidas_postre_nombre_check;
alter table public.comidas add constraint comidas_postre_nombre_check check (postre_nombre is null or char_length(postre_nombre) <= 80);

-- La hora del postre la pone la base: nadie la puede inventar para repetir el aviso.
create or replace function public.hora_del_postre()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.postre_en := case when new.postre_en is not null then now() end;
  elsif new.postre_en is distinct from old.postre_en then
    new.postre_en := case when new.postre_en is not null then now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists hora_del_postre on public.comidas;
create trigger hora_del_postre before insert or update of postre_en on public.comidas
for each row execute function public.hora_del_postre();

-- 2. Avisos de mensajes, comidas, postres y comentarios: a los grupos donde se publico.
create or replace function public.destinos_aviso(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  titulo text;
  cuerpo text;
  creado timestamptz;
  solo_para uuid;
  privada_c boolean;
  con_foto boolean;
  responde boolean;
  vista text := 'chat';
  tipo_c text;
  nombre_tipo text;
  grupos_dest uuid[];
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre into autor from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select coalesce(nullif(texto, ''), case when adjunto_path ~* '\.(m4a|mp4|webm|ogg|aac)$' then U&'Mand\00F3 un audio \+01F3A4' when adjunto_path is not null then U&'Mand\00F3 una foto \+01F4F7' when sticker is not null then sticker end), creado_en, respuesta_comida is not null, array[grupo_id]
    into cuerpo, creado, responde, grupos_dest from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then U&' respondi\00F3 una foto' else '' end;
  elsif p_tipo in ('comida', 'postre') then
    select case when p_tipo = 'postre' then postre_nombre else descripcion end,
           case when p_tipo = 'postre' then postre_en else creado_en end,
           privada, foto_path is not null or postre_foto is not null, tipo, grupos
    into cuerpo, creado, privada_c, con_foto, tipo_c, grupos_dest
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    nombre_tipo := case tipo_c when 'desayuno' then 'Desayuno' when 'almuerzo' then 'Almuerzo' when 'merienda' then 'Merienda' when 'cena' then 'Cena' else U&'Colaci\00F3n' end;
    if p_tipo = 'postre' then
      -- Quien suma el postre a su comida: el nombre del postre, de una.
      titulo := autor || U&' sum\00F3 postre \+01F36E';
      cuerpo := coalesce(nullif(trim(cuerpo), ''), 'Postre de su ' || lower(nombre_tipo));
    else
      -- La comida nueva: quien, que comida y el titulo que le puso. Nada mas.
      titulo := autor || U&' \00B7 ' || nombre_tipo;
      cuerpo := coalesce(nullif(trim(cuerpo), ''), case when con_foto then U&'Subi\00F3 una foto \+01F4F7' else nombre_tipo end);
    end if;
    if con_foto then vista := 'imagenes'; end if;
  elsif p_tipo = 'comentario' then
    select k.texto, k.creado_en, c.usuario_id, c.privada, c.grupos into cuerpo, creado, solo_para, privada_c, grupos_dest
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
        'titulo', case when p_tipo = 'mensaje' and position(lower('@' || p.nombre) in lower(cuerpo)) > 0 then autor || U&' te mencion\00F3'
          -- Quien esta en varios grupos ve de que grupo es el mensaje.
          when p_tipo = 'mensaje' and (select count(*) from miembros_grupo mm where mm.usuario_id = s.usuario_id) > 1 then autor || ' en ' || (select nombre from grupos where id = grupos_dest[1]) end
      ))
      from suscripciones_push s join perfiles p on p.id = s.usuario_id
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
        and exists (select 1 from miembros_grupo m where m.usuario_id = s.usuario_id and m.grupo_id = any(grupos_dest))
    ), '[]'::jsonb)
  );
end;
$$;

-- 3. La caca, grupo por grupo. En el chat solo se nombra a los que caen por primera vez:
-- el que ya venia con caca del dia anterior no se repite.
create or replace function public.contar_multas(p_fecha date default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  dia date := coalesce(p_fecha, (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1);
  desde date;
  nuevas integer := 0;
  filas integer;
  texto text;
  lista text;
  hubo boolean;
  evo text;
  g record;
begin
  select valor::date into desde from ajustes_grupo where clave = 'multas_desde';
  if desde is not null and dia < desde then return 0; end if;

  for g in select * from grupos where (creado_en at time zone 'America/Argentina/Buenos_Aires')::date < dia loop
    insert into multas (usuario_id, fecha, fotos)
    select m.usuario_id, dia, 0 from miembros_grupo m
    where m.grupo_id = g.id
      and (m.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia
      and fotos_del_dia(m.usuario_id, dia) < 1
    on conflict (usuario_id, fecha) do nothing;
    get diagnostics filas = row_count;
    nuevas := nuevas + filas;

    continue when not exists (select 1 from miembros_grupo where grupo_id = g.id and (unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia);

    select exists (
      select 1 from multas mu join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
      where mu.fecha = dia and (m.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia
    ) into hubo;

    -- Los nuevos: caca de ese dia y no del anterior.
    select string_agg(p.nombre, E'\n' order by p.nombre) into lista
    from multas mu join perfiles p on p.id = mu.usuario_id
    join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
    where mu.fecha = dia and (m.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia
      and not exists (select 1 from multas antes where antes.usuario_id = mu.usuario_id and antes.fecha = dia - 1);

    texto := null;
    if lista is not null then
      if g.con_bocha then
        texto := format(U&'El %s no subieron ninguna foto \+01F4A9\000A%s\000A\000AHoy les cae la maldici\00F3n del Bocha. Se la sacan subiendo su foto del d\00EDa.', to_char(dia, 'DD/MM'), lista);
      else
        texto := format(U&'El %s no subieron ninguna foto \+01F4A9\000A%s\000A\000AHoy no ven las fotos de los dem\00E1s hasta subir la suya.', to_char(dia, 'DD/MM'), lista);
      end if;
    elsif not hubo then
      if g.con_bocha then
        texto := format(U&'El %s todos subieron su foto. El Bocha descansa \+01F44F', to_char(dia, 'DD/MM'));
      else
        texto := format(U&'El %s todos subieron su foto \+01F44F', to_char(dia, 'DD/MM'));
      end if;
    end if;

    -- El domingo, solo el Bocha Evo: a quien le cae y con cuantas cacas.
    if extract(isodow from dia) = 7 and g.con_bocha then
      insert into bocha_evo (usuario_id, semana, cacas)
      select usuario_id, dia + 1, total from (
        select mu.usuario_id, count(*)::smallint as total, rank() over (order by count(*) desc) as puesto
        from multas mu join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
        where mu.fecha between dia - 6 and dia
        group by mu.usuario_id
      ) t
      where puesto = 1
      on conflict (usuario_id, semana) do nothing;

      select string_agg(format(U&'%s (%s \+01F4A9)', p.nombre, b.cacas), ' y ' order by p.nombre) into evo
      from bocha_evo b join perfiles p on p.id = b.usuario_id
      join miembros_grupo m on m.usuario_id = b.usuario_id and m.grupo_id = g.id
      where b.semana = dia + 1;
      if evo is not null then
        texto := concat_ws(E'\n\n', texto, format(U&'\+01F4A9 BOCHA EVO para %s toda la semana: pantalla llena de caca y teclado tapado, sin chat hasta el lunes.', evo));
      else
        texto := concat_ws(E'\n\n', texto, U&'Semana sin cacas. El Bocha Evo se queda dormido \+01F64C');
      end if;
    end if;

    if texto is not null then
      insert into mensajes (usuario_id, texto, bot_multas, grupo_id) values (null, texto, dia, g.id)
      on conflict (grupo_id, bot_multas) do nothing;
    end if;
  end loop;
  return nuevas;
end;
$$;

-- Los avisos de la caca: el de las 22 (te falta la foto) y, el lunes, a quien le cayo el Bocha Evo.
create or replace function public.destinos_caca(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  lunes date := date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires'))::date;
  desde date;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  select valor::date into desde from ajustes_grupo where clave = 'multas_desde';

  if p_tipo = 'caca' then
    if desde is not null and hoy < desde then return null; end if;
    return jsonb_build_object(
      'titulo', U&'Te falta tu foto de hoy \26A0\FE0F',
      'cuerpo', U&'Sub\00ED al menos una antes de las 00 o ma\00F1ana te cae la maldici\00F3n del Bocha \+01F4A9',
      'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
          'cuerpo', case when exists (select 1 from miembros_grupo m join grupos g on g.id = m.grupo_id where m.usuario_id = s.usuario_id and g.con_bocha) then null
                         else U&'Sub\00ED al menos una antes de las 00 o ma\00F1ana no vas a ver las fotos de los dem\00E1s \+01F4A9' end))
        from suscripciones_push s
        where fotos_del_dia(s.usuario_id, hoy) < 1
          and exists (
            select 1 from miembros_grupo m join grupos g on g.id = m.grupo_id
            where m.usuario_id = s.usuario_id
              and (g.creado_en at time zone 'America/Argentina/Buenos_Aires')::date < hoy
              and (m.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < hoy
          )
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'anuncio_caca' then
    if not exists (select 1 from bocha_evo where bocha_evo.semana = lunes) then return null; end if;
    return jsonb_build_object(
      'titulo', U&'\+01F4A9 Le cay\00F3 el BOCHA EVO',
      'cuerpo', 'Toda la semana con la pantalla de caca y sin chat.',
      'vista', 'chat',
      'destinos', coalesce((
        select jsonb_agg(d) from (
          select jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
            'titulo', case when exists (select 1 from bocha_evo b where b.usuario_id = s.usuario_id and b.semana = lunes)
                           then U&'\+01F4A9 Te cay\00F3 el BOCHA EVO' end,
            'cuerpo', (
              select case when count(*) > 0 then format(U&'A %s: toda la semana con la pantalla de caca y sin chat.', string_agg(distinct p.nombre, ' y ')) end
              from bocha_evo b join perfiles p on p.id = b.usuario_id
              where b.semana = lunes and b.usuario_id <> s.usuario_id
                and not exists (select 1 from bocha_evo yo_evo where yo_evo.usuario_id = s.usuario_id and yo_evo.semana = lunes)
                and exists (
                  select 1 from miembros_grupo a join miembros_grupo c on c.grupo_id = a.grupo_id join grupos g on g.id = a.grupo_id
                  where a.usuario_id = s.usuario_id and c.usuario_id = b.usuario_id and g.con_bocha
                )
            )) as d
          from suscripciones_push s
          where exists (
            select 1 from miembros_grupo a join miembros_grupo c on c.grupo_id = a.grupo_id join grupos g on g.id = a.grupo_id
            join bocha_evo b on b.usuario_id = c.usuario_id and b.semana = lunes
            where a.usuario_id = s.usuario_id and g.con_bocha
          )
        ) t
      ), '[]'::jsonb)
    );
  end if;
  return null;
end;
$$;

-- 4. Los logros ya no se avisan: solo cuando alguien cambia de categoria (Plata, Oro... LOMADA LEGENDARY).
create or replace function public.aviso_medalla(p_codigo text, p_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if not exists (select 1 from medallas where usuario_id = yo and codigo = p_codigo and ganada_en > now() - interval '2 minutes') then
    return null;
  end if;
  select nombre into autor from perfiles where id = yo;

  return jsonb_build_object(
    'titulo', autor || U&' subi\00F3 de categor\00EDa',
    'cuerpo', left(coalesce(p_nombre, U&'Categor\00EDa nueva'), 60),
    'vista', 'retos',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id <> yo
    ), '[]'::jsonb)
  );
end;
$$;

-- El aviso del Bocha Evo sale el lunes 00:10 en Argentina, despues de contar las cacas del domingo.
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-bocha-evo', '10 3 * * 1', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"anuncio_caca"}'));
end $$;

select 'Listo: avisos con el titulo de la comida, postre con nombre y la caca solo para los nuevos.' as resultado;
