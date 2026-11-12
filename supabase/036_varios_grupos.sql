-- Varios grupos por persona. Cada uno esta en uno o mas grupos y mira uno a la vez (perfiles.grupo_id = el que esta viendo).
-- Cada comida guarda en que grupos se publico. Cada persona elige: en todos sus grupos, solo en el que esta viendo, o elegir en cada comida.
-- Ejecutar en el SQL Editor de Supabase, despues de 035_avisos_y_viaje.sql. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.avisos_viaje') is null then
    raise exception 'Falta correr antes el SQL 035_avisos_y_viaje.sql';
  end if;
end $$;

-- 1. A que grupos pertenece cada uno.
create table if not exists public.miembros_grupo (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  unido_en timestamptz not null default now(),
  primary key (usuario_id, grupo_id)
);
create index if not exists miembros_grupo_grupo on public.miembros_grupo (grupo_id);
alter table public.miembros_grupo enable row level security;
revoke all on public.miembros_grupo from anon, authenticated;
grant select on public.miembros_grupo to authenticated;

-- Los que ya estaban, en su grupo de siempre.
insert into public.miembros_grupo (usuario_id, grupo_id, unido_en)
select id, grupo_id, unido_en from public.perfiles where grupo_id is not null
on conflict do nothing;

-- Donde publica cada uno sus comidas.
alter table public.perfiles add column if not exists publicar_en text not null default 'todos'
  check (publicar_en in ('todos', 'actual', 'elegir'));

-- 2. Cada comida sabe en que grupos se publico. Las de antes, en el grupo de quien la subio.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comidas' and column_name = 'grupos') then
    alter table public.comidas add column grupos uuid[];
    update public.comidas c set grupos = coalesce(array[p.grupo_id], '{}') from public.perfiles p where p.id = c.usuario_id and p.grupo_id is not null;
    update public.comidas set grupos = '{}' where grupos is null;
  end if;
end $$;
create index if not exists comidas_grupos on public.comidas using gin (grupos);

-- 3. Ayudas: ?esa persona esta en el grupo que estoy viendo?
create or replace function public.del_grupo(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_usuario = auth.uid() or exists (
    select 1 from miembros_grupo m
    where m.usuario_id = p_usuario and m.grupo_id = (select grupo_id from perfiles where id = auth.uid())
  );
$$;

create or replace function public.carpeta_del_grupo(p_carpeta text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_carpeta = auth.uid()::text or exists (
    select 1 from miembros_grupo m
    where m.usuario_id::text = p_carpeta and m.grupo_id = (select grupo_id from perfiles where id = auth.uid())
  );
$$;

create or replace function public.mis_grupos()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(grupo_id), '{}') from miembros_grupo where usuario_id = auth.uid();
$$;
revoke all on function public.mis_grupos() from public, anon;
grant execute on function public.mis_grupos() to authenticated;

-- 4. Quien ve que.
drop policy if exists "miembros: ver" on public.miembros_grupo;
create policy "miembros: ver" on public.miembros_grupo for select to authenticated
  using (usuario_id = auth.uid() or grupo_id = public.mi_grupo());

drop policy if exists "grupos: ver el propio" on public.grupos;
drop policy if exists "grupos: ver los propios" on public.grupos;
create policy "grupos: ver los propios" on public.grupos for select to authenticated using (id = any(public.mis_grupos()));

drop policy if exists "perfiles: ver" on public.perfiles;
create policy "perfiles: ver" on public.perfiles for select to authenticated using (public.del_grupo(id));

drop policy if exists "comidas: ver" on public.comidas;
create policy "comidas: ver" on public.comidas for select to authenticated
  using (
    usuario_id = auth.uid()
    or (public.mi_grupo() = any(grupos) and public.del_grupo(usuario_id) and (
      not privada
      or exists (select 1 from public.invitaciones_comida i where i.comida_id = comidas.id and i.para_usuario = auth.uid())
    ))
  );

-- 5. En que grupos queda una comida: lo que pidio la app (solo grupos propios) o lo que dice su ajuste.
create or replace function public.grupos_de_comida()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  propios uuid[];
  modo text;
  actual uuid;
begin
  select coalesce(array_agg(grupo_id), '{}') into propios from miembros_grupo where usuario_id = new.usuario_id;
  select publicar_en, grupo_id into modo, actual from perfiles where id = new.usuario_id;
  if tg_op = 'UPDATE' then
    -- Al editar solo se puede dejar en grupos propios (o en ninguno, si saliste de todos donde estaba).
    if new.grupos is distinct from old.grupos then
      new.grupos := array(select distinct g from unnest(coalesce(new.grupos, '{}')) g where g = any(propios));
    end if;
    return new;
  end if;
  if new.grupos is not null then
    new.grupos := array(select distinct g from unnest(new.grupos) g where g = any(propios));
  end if;
  if new.grupos is null or cardinality(new.grupos) = 0 then
    new.grupos := case
      when modo = 'todos' then propios
      when actual is not null then array[actual]
      else propios
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists grupos_de_comida on public.comidas;
create trigger grupos_de_comida before insert or update of grupos on public.comidas
  for each row execute function public.grupos_de_comida();

-- 6. El grupo que se esta viendo solo puede ser uno propio.
create or replace function public.proteger_grupo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and new.grupo_id is distinct from old.grupo_id
     and coalesce(current_setting('lomada.cambiar_grupo', true), '') <> 'si' then
    raise exception 'grupo_bloqueado';
  end if;
  return new;
end;
$$;

-- Si quien administra saca a alguien de un grupo, no puede volver con el codigo. Si lo estaba viendo, pasa a otro.
create or replace function public.al_salir_de_grupo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Si se esta borrando la cuenta o el grupo entero, no hay nada que anotar.
  if not exists (select 1 from perfiles where id = old.usuario_id) or not exists (select 1 from grupos where id = old.grupo_id) then
    return old;
  end if;
  if auth.uid() is null then
    insert into salidas_grupo (usuario_id, grupo_id) values (old.usuario_id, old.grupo_id) on conflict do nothing;
  end if;
  perform set_config('lomada.cambiar_grupo', 'si', true);
  update perfiles set grupo_id = (
    select m.grupo_id from miembros_grupo m where m.usuario_id = old.usuario_id and m.grupo_id <> old.grupo_id order by m.unido_en limit 1
  ) where id = old.usuario_id and grupo_id = old.grupo_id;
  perform set_config('lomada.cambiar_grupo', '', true);
  return old;
end;
$$;
drop trigger if exists al_salir_de_grupo on public.miembros_grupo;
create trigger al_salir_de_grupo after delete on public.miembros_grupo for each row execute function public.al_salir_de_grupo();

-- Quien ya estaba afuera (sacado antes de este cambio) no tiene membresia: queda registrado igual.

-- 7. Registrarse, sumarse a otro grupo, cambiar de grupo y salir.
create or replace function public.crear_perfil_registrado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  grupo uuid := (select id from grupos where id::text = new.raw_user_meta_data->>'grupo_id');
begin
  insert into perfiles (id, nombre, usuario, grupo_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'usuario'),
    lower(trim(new.raw_user_meta_data->>'usuario')),
    grupo
  );
  if grupo is not null then
    insert into miembros_grupo (usuario_id, grupo_id) values (new.id, grupo) on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.unirme_a_grupo(p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  grupo grupos;
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  select * into grupo from grupos where lower(codigo) = lower(trim(coalesce(p_codigo, '')));
  if grupo.id is null or exists (select 1 from salidas_grupo where usuario_id = auth.uid() and grupo_id = grupo.id) then
    perform pg_sleep(0.5);
    raise exception 'codigo_invalido';
  end if;
  insert into miembros_grupo (usuario_id, grupo_id) values (auth.uid(), grupo.id) on conflict do nothing;
  perform set_config('lomada.cambiar_grupo', 'si', true);
  update perfiles set grupo_id = grupo.id where id = auth.uid();
  perform set_config('lomada.cambiar_grupo', '', true);
  return grupo.nombre;
end;
$$;

create or replace function public.cambiar_grupo(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  if not exists (select 1 from miembros_grupo where usuario_id = auth.uid() and grupo_id = p_grupo) then
    raise exception 'no_es_tu_grupo';
  end if;
  perform set_config('lomada.cambiar_grupo', 'si', true);
  update perfiles set grupo_id = p_grupo where id = auth.uid();
  perform set_config('lomada.cambiar_grupo', '', true);
end;
$$;

create or replace function public.salir_de_grupo(p_grupo uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  delete from miembros_grupo where usuario_id = auth.uid() and grupo_id = p_grupo;
  -- Las comidas dejan de verse en ese grupo.
  update comidas set grupos = array_remove(grupos, p_grupo) where usuario_id = auth.uid() and p_grupo = any(grupos);
end;
$$;
revoke all on function public.cambiar_grupo(uuid), public.salir_de_grupo(uuid) from public, anon;
grant execute on function public.cambiar_grupo(uuid), public.salir_de_grupo(uuid) to authenticated;

-- 8. Comidas grupales: solo con gente del grupo que estas viendo.
create or replace function public.invitar_a_comida(p_comida uuid, p_para uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  nuevas integer;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if coalesce(array_length(p_para, 1), 0) = 0 then return 0; end if;
  if array_length(p_para, 1) > 30 then raise exception 'demasiados'; end if;
  if not exists (
    select 1 from comidas where id = p_comida and usuario_id = yo and tipo <> 'resumen'
      and (grupo_comida is null or grupo_comida = id)
  ) then
    raise exception 'no_es_tuya';
  end if;

  update comidas set grupo_comida = id where id = p_comida and grupo_comida is null;

  insert into invitaciones_comida (comida_id, de_usuario, para_usuario)
  select p_comida, yo, u
  from (select distinct unnest(p_para) as u) x
  where u <> yo
    and exists (select 1 from miembros_grupo where usuario_id = u and grupo_id = (select grupo_id from perfiles where id = yo))
    and not exists (select 1 from comidas c where c.grupo_comida = p_comida and c.usuario_id = u)
  on conflict (comida_id, para_usuario) do nothing;
  get diagnostics nuevas = row_count;
  return nuevas;
end;
$$;

-- 9. El resumen de los lunes: los integrantes del grupo y las comidas publicadas ahi.
create or replace function public.armar_resumen_semanal(p_grupo uuid)
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
  if p_grupo is null then return null; end if;
  if extract(isodow from ahora) = 1 and extract(hour from ahora) < 9 then return null; end if;
  if exists (select 1 from mensajes where bot_semana = inicio and grupo_id = p_grupo) then return null; end if;

  create temporary table semana on commit drop as
    with por_dia as (
      select c.usuario_id, c.fecha,
             total_del_dia(pf.modo_total, sum(coalesce(c.calorias, 0)) filter (where c.tipo <> 'resumen'), sum(coalesce(c.calorias, 0)) filter (where c.tipo = 'resumen')) as kcal,
             total_del_dia(pf.modo_total, sum(coalesce(c.proteinas, 0)) filter (where c.tipo <> 'resumen'), sum(coalesce(c.proteinas, 0)) filter (where c.tipo = 'resumen')) as proteinas,
             count(*) filter (where c.tipo <> 'resumen') as comidas,
             count(c.foto_path) as fotos
      from comidas c
      join perfiles pf on pf.id = c.usuario_id
      join miembros_grupo m on m.usuario_id = c.usuario_id and m.grupo_id = p_grupo
      where c.fecha between inicio and fin and not c.privada and p_grupo = any(c.grupos)
      group by c.usuario_id, c.fecha, pf.modo_total
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

  select string_agg(format(U&'%s. %s, %s de 7 d\00EDas', puesto, nombre, dias), E'\n' order by puesto) into constancia
  from (select *, row_number() over (order by dias desc, comidas desc, nombre) as puesto from semana) s where puesto <= 3;

  select string_agg(format('%s. %s, %s g', puesto, nombre, replace(to_char(proteinas, miles), ',', '.')), E'\n' order by puesto) into proteina
  from (select *, row_number() over (order by proteinas desc, nombre) as puesto from semana) s where puesto <= 3;

  select string_agg(format('%s. %s, %s kcal', puesto, nombre, replace(to_char(kcal, miles), ',', '.')), E'\n' order by puesto) into calorias
  from (select *, row_number() over (order by kcal desc, nombre) as puesto from semana) s where puesto <= 3;

  texto := format(U&'Resumen de la semana (%s al %s)\000AEntre todos: %s comidas y %s fotos\000A\000AConstancia\000A%s\000A\000AProte\00EDna\000A%s\000A\000AM\00E1s comi\00F3\000A%s',
    to_char(inicio, 'DD/MM'), to_char(fin, 'DD/MM'), grupo_comidas, grupo_fotos, constancia, proteina, calorias);

  insert into mensajes (usuario_id, texto, bot_semana, grupo_id) values (null, texto, inicio, p_grupo)
  on conflict (grupo_id, bot_semana) do nothing;
  drop table semana;
  return texto;
end;
$$;

-- 10. Avisos programados.
create or replace function public.destinos_programados(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  g record;
  con_resumen uuid[] := '{}';
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  if p_tipo = 'recordatorio' then
    return jsonb_build_object(
      'titulo', U&'Son las 21. \00BFCargaste todo?',
      'cuerpo', U&'Sub\00ED tus comidas de hoy, gordito.',
      'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where exists (select 1 from miembros_grupo m where m.usuario_id = s.usuario_id)
          and not exists (select 1 from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy and c.tipo = 'resumen')
          and (select count(*) from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy) < 3
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'semana' then
    for g in select id from grupos loop
      if armar_resumen_semanal(g.id) is not null then con_resumen := con_resumen || g.id; end if;
    end loop;
    if cardinality(con_resumen) = 0 then return null; end if;
    return jsonb_build_object('titulo', 'Salieron los podios de la semana', 'cuerpo', U&'Mir\00E1 c\00F3mo qued\00F3 cada uno en el chat.', 'vista', 'chat',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where exists (select 1 from miembros_grupo m where m.usuario_id = s.usuario_id and m.grupo_id = any(con_resumen))
      ), '[]'::jsonb));
  elsif p_tipo = 'matchday' then
    return jsonb_build_object('titulo', U&'MATCH DAY \26BD', 'cuerpo', U&'D\00EDa de guerra \2694\FE0F. No te olvides de publicar tu CARB LOAD \+01F35D', 'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where exists (select 1 from miembros_grupo m join grupos gr on gr.id = m.grupo_id where m.usuario_id = s.usuario_id and gr.con_bocha)
      ), '[]'::jsonb));
  end if;
  raise exception 'tipo_invalido';
end;
$$;

-- 11. La caca, grupo por grupo, con los integrantes de cada uno.
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

    select string_agg(p.nombre, E'\n' order by p.nombre) into lista
    from multas mu join perfiles p on p.id = mu.usuario_id
    join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
    where mu.fecha = dia and (m.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia;

    if g.con_bocha then
      if lista is not null then
        texto := format(U&'El %s no subieron ninguna foto \+01F4A9\000A%s\000A\000AHoy les cae la maldici\00F3n del Bocha. Se la sacan subiendo su foto del d\00EDa.', to_char(dia, 'DD/MM'), lista);
      else
        texto := format(U&'El %s todos subieron su foto. El Bocha descansa \+01F44F', to_char(dia, 'DD/MM'));
      end if;
    else
      if lista is not null then
        texto := format(U&'El %s no subieron ninguna foto \+01F4A9\000A%s\000A\000AHoy no ven las fotos de los dem\00E1s hasta subir la suya.', to_char(dia, 'DD/MM'), lista);
      else
        texto := format(U&'El %s todos subieron su foto \+01F44F', to_char(dia, 'DD/MM'));
      end if;
    end if;

    if extract(isodow from dia) = 7 then
      if g.con_bocha then
        insert into bocha_evo (usuario_id, semana, cacas)
        select usuario_id, dia + 1, total from (
          select mu.usuario_id, count(*)::smallint as total, rank() over (order by count(*) desc) as puesto
          from multas mu join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
          where mu.fecha between dia - 6 and dia
          group by mu.usuario_id
        ) t
        where puesto = 1
        on conflict (usuario_id, semana) do nothing;
      end if;

      select string_agg(format('%s. %s, %s', puesto, nombre, total), E'\n' order by puesto, nombre) into lista
      from (
        select p.nombre, count(*) as total, rank() over (order by count(*) desc) as puesto
        from multas mu join perfiles p on p.id = mu.usuario_id
        join miembros_grupo m on m.usuario_id = mu.usuario_id and m.grupo_id = g.id
        where mu.fecha between dia - 6 and dia
        group by p.id, p.nombre
      ) t;

      if g.con_bocha then
        select string_agg(p.nombre, ' y ' order by p.nombre) into evo
        from bocha_evo b join perfiles p on p.id = b.usuario_id
        join miembros_grupo m on m.usuario_id = b.usuario_id and m.grupo_id = g.id
        where b.semana = dia + 1;
        if evo is not null then
          texto := texto || format(E'\n\nCacas de la semana\n%s\n\nBOCHA EVO para %s toda la semana: pantalla llena de caca y teclado tapado, sin chat hasta el lunes.', lista, evo);
        else
          texto := texto || U&'\000A\000ASemana sin cacas. El Bocha Evo se queda dormido \+01F64C';
        end if;
      elsif lista is not null then
        texto := texto || format(E'\n\nCacas de la semana\n%s', lista);
      else
        texto := texto || U&'\000A\000ASemana sin cacas \+01F64C';
      end if;
    end if;

    insert into mensajes (usuario_id, texto, bot_multas, grupo_id) values (null, texto, dia, g.id)
    on conflict (grupo_id, bot_multas) do nothing;
  end loop;
  return nuevas;
end;
$$;

-- El Bocha Evo tapa el teclado solo en el chat de un grupo con Bocha.
create or replace function public.chat_tapado_por_bocha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.usuario_id is not null
     and exists (select 1 from grupos where id = new.grupo_id and con_bocha)
     and exists (
       select 1 from bocha_evo b
       where b.usuario_id = new.usuario_id
         and b.semana = date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date
     ) then
    raise exception 'bocha_evo';
  end if;
  return new;
end;
$$;

create or replace function public.destinos_caca(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
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
    return null;
  end if;
  return null;
end;
$$;

-- 12. Filtros de seguridad de los avisos.
-- Desde la app: solo a gente que comparte algun grupo con quien lo manda.
create or replace function public.solo_mi_grupo(p_endpoints text[])
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.endpoint), '{}')
  from suscripciones_push s
  where s.endpoint = any(p_endpoints)
    and exists (
      select 1 from miembros_grupo a join miembros_grupo b on b.grupo_id = a.grupo_id
      where a.usuario_id = auth.uid() and b.usuario_id = s.usuario_id
    );
$$;

create or replace function public.filtrar_destinos(p_clave text, p_tipo text, p_endpoints text[])
returns text[]
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  return coalesce((
    select array_agg(s.endpoint)
    from suscripciones_push s
    where s.endpoint = any(p_endpoints)
      and exists (
        select 1 from miembros_grupo m join grupos g on g.id = m.grupo_id
        where m.usuario_id = s.usuario_id and (g.con_bocha or p_tipo not in ('viaje', 'matchday', 'anuncio_caca'))
      )
  ), '{}');
end;
$$;

-- 13. El viaje, a los integrantes de la Lomada.
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
      from suscripciones_push s
      where exists (select 1 from miembros_grupo m join grupos g on g.id = m.grupo_id where m.usuario_id = s.usuario_id and g.con_bocha)
    ), '[]'::jsonb)
  );
end;
$$;

-- 14. Avisos de mensajes y comidas: a los grupos donde se publico.
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
  grupos_dest uuid[];
  variante int := get_byte(decode(md5(p_id::text), 'hex'), 1) % 2;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre, meta_calorias, modo_total into autor, meta, modo from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select coalesce(nullif(texto, ''), case when adjunto_path ~* '\.(m4a|mp4|webm|ogg|aac)$' then U&'Mand\00F3 un audio \+01F3A4' when adjunto_path is not null then U&'Mand\00F3 una foto \+01F4F7' when sticker is not null then sticker end), creado_en, respuesta_comida is not null, array[grupo_id]
    into cuerpo, creado, responde, grupos_dest from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then U&' respondi\00F3 una foto' else '' end;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null, coalesce(calorias, 0), coalesce(proteinas, 0), fecha, tipo, grupos
    into cuerpo, creado, privada_c, con_foto, kcal, prote, dia, tipo_c, grupos_dest
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
           and o.grupos && grupos_dest
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

do $$
begin
  alter publication supabase_realtime add table public.miembros_grupo;
exception when duplicate_object then null;
end $$;

select 'Listo. ' || string_agg(format('%s: %s personas', g.nombre, (select count(*) from public.miembros_grupo m where m.grupo_id = g.id)), ' | ' order by g.creado_en) as resultado
from public.grupos g;
