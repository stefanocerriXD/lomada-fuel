-- Un total del día y las comidas cargadas no se suman: se usa el mayor de cada dato.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 013_recordatorios.sql.

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
    with por_dia as (
      select c.usuario_id, c.fecha,
             greatest(sum(coalesce(c.calorias, 0)) filter (where c.tipo <> 'resumen'), sum(coalesce(c.calorias, 0)) filter (where c.tipo = 'resumen')) as kcal,
             greatest(sum(coalesce(c.proteinas, 0)) filter (where c.tipo <> 'resumen'), sum(coalesce(c.proteinas, 0)) filter (where c.tipo = 'resumen')) as proteinas,
             count(*) filter (where c.tipo <> 'resumen') as comidas,
             count(c.foto_path) as fotos
      from comidas c
      where c.fecha between inicio and fin and not c.privada
      group by c.usuario_id, c.fecha
    )
    select p.nombre,
           sum(d.kcal)::integer as kcal,
           round(sum(d.proteinas))::integer as proteinas,
           sum(d.comidas)::integer as comidas,
           sum(d.fotos)::integer as fotos,
           count(*)::integer as dias
    from por_dia d
    join perfiles p on p.id = d.usuario_id
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
  select nombre, meta_calorias into autor, meta from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select texto, creado_en, respuesta_comida is not null into cuerpo, creado, responde from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then ' respondió una foto' else '' end;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null, coalesce(calorias, 0), coalesce(proteinas, 0), fecha
    into cuerpo, creado, privada_c, con_foto, kcal, prote, dia
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    select greatest(coalesce(sum(calorias) filter (where tipo <> 'resumen'), 0), coalesce(sum(calorias) filter (where tipo = 'resumen'), 0))
    into total_dia from comidas where usuario_id = yo and fecha = dia;
    -- Lo que se destaca va primero. Una de cada cuatro comidas normales lleva un texto distinto.
    titulo := case
      when kcal >= 1500 then autor || ' se mandó ' || replace(to_char(kcal, 'FM9,999'), ',', '.') || ' kcal'
      when total_dia > meta + 500 then autor || ' pasó su meta. Que alguien le saque el plato'
      when hora_local < 5 then autor || ' atacó la heladera'
      when prote >= 60 then autor || ' está en modo proteína'
      else case get_byte(decode(md5(p_id::text), 'hex'), 0) % 12
        when 0 then autor || ' está comiendo. ¿Y vos?'
        when 1 then 'Hay comida nueva. ' || autor || ' ya publicó'
        when 2 then autor || ' subió algo. Mirá antes de que se enfríe'
        else autor || case when con_foto then ' subió una foto' else ' subió una comida' end
      end
    end;
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
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
    ), '[]'::jsonb)
  );
end;
$$;
