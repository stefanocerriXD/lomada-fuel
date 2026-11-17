-- 049: la "caca" pasa a llamarse "cacona" en los mensajes del bot y en los avisos.
-- En los grupos sin Bocha es "la maldicion de la cacona". Mismas funciones que en 040, solo cambian los textos.
-- Ejecutar en el SQL Editor de Supabase, despues de 048. Se puede correr mas de una vez.

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
        texto := format(U&'El %s no subieron ninguna foto \+01F4A9\000A%s\000A\000AHoy les cae la maldici\00F3n de la cacona: no ven las fotos de los dem\00E1s hasta subir la suya.', to_char(dia, 'DD/MM'), lista);
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
        texto := concat_ws(E'\n\n', texto, format(U&'\+01F4A9 BOCHA EVO para %s toda la semana: pantalla llena de cacona y teclado tapado, sin chat hasta el lunes.', evo));
      else
        texto := concat_ws(E'\n\n', texto, U&'Semana sin caconas. El Bocha Evo se queda dormido \+01F64C');
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
                         else U&'Sub\00ED al menos una antes de las 00 o ma\00F1ana te cae la maldici\00F3n de la cacona y no ves las fotos de los dem\00E1s \+01F4A9' end))
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
      'cuerpo', 'Toda la semana con la pantalla de cacona y sin chat.',
      'vista', 'chat',
      'destinos', coalesce((
        select jsonb_agg(d) from (
          select jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
            'titulo', case when exists (select 1 from bocha_evo b where b.usuario_id = s.usuario_id and b.semana = lunes)
                           then U&'\+01F4A9 Te cay\00F3 el BOCHA EVO' end,
            'cuerpo', (
              select case when count(*) > 0 then format(U&'A %s: toda la semana con la pantalla de cacona y sin chat.', string_agg(distinct p.nombre, ' y ')) end
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

select 'Listo: ahora es la cacona.' as resultado;
