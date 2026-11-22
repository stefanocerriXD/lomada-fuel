-- 064: el mensaje del bot sobre la maldicion (del Bocha o de la cacona) sale una sola vez por semana, el domingo,
-- con el resumen de la semana: cuantas caconas tuvo cada uno, y el Bocha Evo en los grupos con Bocha.
-- La maldicion sigue igual todos los dias (multas, fotos borrosas, avisos de las 22); solo cambia el chat.
-- Ejecutar en el SQL Editor de Supabase, despues de 063. Se puede correr mas de una vez.

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

    -- En el chat, una sola vez por semana: el domingo, el resumen de la semana (la maldicion sigue siendo diaria).
    texto := null;
    if extract(isodow from dia) = 7 then
      select string_agg(format(U&'%s: %s \+01F4A9', nombre, total), E'\n' order by total desc, nombre) into lista
      from (
        select p.nombre, count(*) as total
        from multas mu join perfiles p on p.id = mu.usuario_id
        join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
        where mu.fecha between dia - 6 and dia
        group by p.nombre
      ) t;
      if lista is not null then
        texto := format(U&'Caconas de la semana (%s al %s)\000A%s', to_char(dia - 6, 'DD/MM'), to_char(dia, 'DD/MM'), lista);
      elsif g.con_bocha then
        texto := format(U&'Semana del %s al %s: todos subieron su foto todos los d\00EDas. El Bocha descansa \+01F44F', to_char(dia - 6, 'DD/MM'), to_char(dia, 'DD/MM'));
      else
        texto := format(U&'Semana del %s al %s: todos subieron su foto todos los d\00EDas \+01F44F', to_char(dia - 6, 'DD/MM'), to_char(dia, 'DD/MM'));
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

select 'Listo: la maldicion en el chat, una vez por semana.' as resultado;
