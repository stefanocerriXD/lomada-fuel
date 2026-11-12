-- Varios grupos en la misma app. Cada uno ve solo lo suyo: perfiles, comidas, chat, logros y cacas.
-- El grupo de siempre (Lomada) queda con el Bocha, el Match Day y el viaje. Los grupos nuevos
-- tienen la caca "tipo BeReal": 💩 al lado del nombre y las fotos de los demás borrosas
-- hasta subir la propia, sin Bocha, sin manchas en la pantalla y sin Bocha Evo.
-- Ejecutar en el SQL Editor de Supabase, después de 033_arreglar_acentos.sql. Se puede correr más de una vez.
-- Los códigos de los grupos NO van en este archivo: el repositorio es público.

-- 1. Los grupos. El código solo lo lee la base; la app ve el nombre y si tiene Bocha.
create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 40),
  codigo text not null check (char_length(codigo) between 4 and 60),
  con_bocha boolean not null default false,
  creado_en timestamptz not null default now()
);
create unique index if not exists grupos_codigo on public.grupos (lower(codigo));
alter table public.grupos enable row level security;
revoke all on public.grupos from anon, authenticated;
grant select (id, nombre, con_bocha) on public.grupos to authenticated;

-- Lomada tiene un id fijo y se queda con el código de siempre.
insert into public.grupos (id, nombre, codigo, con_bocha, creado_en)
select '00000000-0000-4000-8000-00000000a001', 'Lomada',
       coalesce((select codigo from public.grupo_acceso limit 1), gen_random_uuid()::text), true, '2026-01-01'
on conflict (id) do nothing;

-- 2. Cada perfil tiene su grupo. Los que ya estaban quedan en Lomada (solo la primera vez).
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfiles' and column_name = 'grupo_id') then
    alter table public.perfiles add column grupo_id uuid references public.grupos(id) on delete set null;
    alter table public.perfiles add column unido_en timestamptz not null default now();
    update public.perfiles set grupo_id = '00000000-0000-4000-8000-00000000a001', unido_en = creado_en;
  end if;
end $$;
create index if not exists perfiles_grupo on public.perfiles (grupo_id);

create or replace function public.mi_grupo()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select grupo_id from perfiles where id = auth.uid();
$$;

-- ¿Esa persona es del mismo grupo que yo? Uno mismo siempre cuenta.
create or replace function public.del_grupo(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_usuario = auth.uid() or exists (
    select 1 from perfiles p
    where p.id = p_usuario and p.grupo_id = (select grupo_id from perfiles where id = auth.uid())
  );
$$;

-- Lo mismo, con la carpeta de una foto (que es el id de quien la subió).
create or replace function public.carpeta_del_grupo(p_carpeta text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_carpeta = auth.uid()::text or exists (
    select 1 from perfiles p
    where p.id::text = p_carpeta and p.grupo_id = (select grupo_id from perfiles where id = auth.uid())
  );
$$;

revoke all on function public.mi_grupo(), public.del_grupo(uuid), public.carpeta_del_grupo(text) from public, anon;
grant execute on function public.mi_grupo(), public.del_grupo(uuid), public.carpeta_del_grupo(text) to authenticated;

-- A quien sacan de un grupo no puede volver a entrar a ese grupo con el código.
create table if not exists public.salidas_grupo (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, grupo_id)
);
alter table public.salidas_grupo enable row level security;
revoke all on public.salidas_grupo from anon, authenticated;

-- Nadie se cambia de grupo editando su perfil: solo con un código, desde unirme_a_grupo.
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
  if new.grupo_id is distinct from old.grupo_id then new.unido_en := now(); end if;
  if old.grupo_id is not null and new.grupo_id is null then
    insert into salidas_grupo (usuario_id, grupo_id) values (old.id, old.grupo_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_grupo on public.perfiles;
create trigger proteger_grupo before update on public.perfiles for each row execute function public.proteger_grupo();

-- 3. Los mensajes son de un grupo. Los viejos, de Lomada.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mensajes' and column_name = 'grupo_id') then
    alter table public.mensajes add column grupo_id uuid references public.grupos(id) on delete cascade;
    update public.mensajes set grupo_id = '00000000-0000-4000-8000-00000000a001';
  end if;
end $$;
alter table public.mensajes alter column grupo_id set default coalesce(public.mi_grupo(), '00000000-0000-4000-8000-00000000a001'::uuid);
alter table public.mensajes alter column grupo_id set not null;
create index if not exists mensajes_grupo on public.mensajes (grupo_id, creado_en desc);

-- El bot publica una vez por semana y una vez por día en cada grupo.
do $$
declare
  r record;
begin
  for r in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.mensajes'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text) from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey)) in (array['bot_semana'], array['bot_multas'])
  loop
    execute format('alter table public.mensajes drop constraint %I', r.conname);
  end loop;
end $$;
create unique index if not exists mensajes_bot_semana_grupo on public.mensajes (grupo_id, bot_semana);
create unique index if not exists mensajes_bot_multas_grupo on public.mensajes (grupo_id, bot_multas);

-- 4. Cada uno ve solo lo de su grupo.
drop policy if exists "perfiles: ver" on public.perfiles;
create policy "perfiles: ver" on public.perfiles for select to authenticated
  using (id = auth.uid() or grupo_id = public.mi_grupo());
drop policy if exists "perfiles: crear propio" on public.perfiles;
create policy "perfiles: crear propio" on public.perfiles for insert to authenticated
  with check (id = auth.uid() and grupo_id is null);

drop policy if exists "grupos: ver el propio" on public.grupos;
create policy "grupos: ver el propio" on public.grupos for select to authenticated using (id = public.mi_grupo());

drop policy if exists "comidas: ver" on public.comidas;
create policy "comidas: ver" on public.comidas for select to authenticated
  using (
    usuario_id = auth.uid()
    or (public.del_grupo(usuario_id) and (
      not privada
      or exists (select 1 from public.invitaciones_comida i where i.comida_id = comidas.id and i.para_usuario = auth.uid())
    ))
  );

drop policy if exists "mensajes: ver" on public.mensajes;
create policy "mensajes: ver" on public.mensajes for select to authenticated using (grupo_id = public.mi_grupo());
drop policy if exists "mensajes: enviar propios" on public.mensajes;
create policy "mensajes: enviar propios" on public.mensajes for insert to authenticated
  with check (usuario_id = auth.uid() and grupo_id = public.mi_grupo());

drop policy if exists "reacciones: ver" on public.reacciones;
create policy "reacciones: ver" on public.reacciones for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "agua: ver" on public.agua;
create policy "agua: ver" on public.agua for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "medallas: ver" on public.medallas;
create policy "medallas: ver" on public.medallas for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "desafios: ver" on public.desafios;
create policy "desafios: ver" on public.desafios for select to authenticated using (public.del_grupo(creado_por));
drop policy if exists "reacciones_mensajes: ver" on public.reacciones_mensajes;
create policy "reacciones_mensajes: ver" on public.reacciones_mensajes for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "lecturas: ver" on public.lecturas;
create policy "lecturas: ver" on public.lecturas for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "multas: ver" on public.multas;
create policy "multas: ver" on public.multas for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "bocha evo: ver" on public.bocha_evo;
create policy "bocha evo: ver" on public.bocha_evo for select to authenticated using (public.del_grupo(usuario_id));
drop policy if exists "mejoras: ver" on public.mejoras;
create policy "mejoras: ver" on public.mejoras for select to authenticated using (public.del_grupo(usuario_id) or public.es_admin());
drop policy if exists "recetas: ver" on public.recetas_propias;
create policy "recetas: ver" on public.recetas_propias for select to authenticated
  using (usuario_id = auth.uid() or (compartida and public.del_grupo(usuario_id)));

-- Las fotos y audios del chat, solo los del grupo. Las de comidas siguen la regla de comidas.
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] = 'bocha'
      or ((storage.foldername(name))[2] = 'chat' and public.carpeta_del_grupo((storage.foldername(name))[1]))
      or exists (select 1 from public.comidas c where c.foto_path = storage.objects.name and (not c.privada or c.usuario_id = auth.uid()))
      or exists (
        select 1 from public.invitaciones_comida i join public.comidas c on c.id = i.comida_id
        where c.foto_path = storage.objects.name and i.para_usuario = auth.uid()
      )
    )
  );

-- 5. Registrarse: el código dice a qué grupo entrás.
create or replace function public.controlar_registro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  datos jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  usuario_nuevo text := lower(trim(coalesce(datos->>'usuario', '')));
  grupo uuid;
begin
  select id into grupo from grupos where lower(codigo) = lower(trim(coalesce(datos->>'codigo_grupo', '')));
  if grupo is null then
    raise exception 'codigo_invalido';
  end if;
  if usuario_nuevo !~ '^[a-z0-9_.]{3,20}$' then
    raise exception 'usuario_invalido';
  end if;
  if exists (select 1 from perfiles where lower(usuario) = usuario_nuevo) then
    raise exception 'usuario_ocupado';
  end if;
  new.raw_user_meta_data := (datos - 'codigo_grupo') || jsonb_build_object('grupo_id', grupo);
  return new;
end;
$$;

create or replace function public.crear_perfil_registrado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into perfiles (id, nombre, usuario, grupo_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'usuario'),
    lower(trim(new.raw_user_meta_data->>'usuario')),
    (select id from grupos where id::text = new.raw_user_meta_data->>'grupo_id')
  );
  return new;
end;
$$;

create or replace function public.revisar_registro(p_usuario text, p_codigo text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from grupos where lower(codigo) = lower(trim(coalesce(p_codigo, '')))) then
    perform pg_sleep(0.5); -- Hace lentos los intentos de adivinar el código.
    return 'codigo';
  end if;
  if lower(trim(coalesce(p_usuario, ''))) !~ '^[a-z0-9_.]{3,20}$' then return 'usuario_invalido'; end if;
  if exists (select 1 from perfiles where lower(usuario) = lower(trim(p_usuario))) then return 'usuario_ocupado'; end if;
  return 'ok';
end;
$$;

-- Quien quedó sin grupo entra a uno con su código. Quien ya tiene grupo no se puede pasar a otro.
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
  if (select grupo_id from perfiles where id = auth.uid()) is not null then raise exception 'ya_tiene_grupo'; end if;
  select * into grupo from grupos where lower(codigo) = lower(trim(coalesce(p_codigo, '')));
  if grupo.id is null or exists (select 1 from salidas_grupo where usuario_id = auth.uid() and grupo_id = grupo.id) then
    perform pg_sleep(0.5);
    raise exception 'codigo_invalido';
  end if;
  perform set_config('lomada.cambiar_grupo', 'si', true);
  update perfiles set grupo_id = grupo.id where id = auth.uid();
  perform set_config('lomada.cambiar_grupo', '', true);
  return grupo.nombre;
end;
$$;
revoke all on function public.unirme_a_grupo(text) from public, anon;
grant execute on function public.unirme_a_grupo(text) to authenticated;

-- 6. Comidas grupales: solo se invita a gente del mismo grupo.
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
  -- Solo la comida original de quien publica; una copia no invita a nadie.
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
    and exists (select 1 from perfiles where id = u and grupo_id = (select grupo_id from perfiles where id = yo))
    and not exists (select 1 from comidas c where c.grupo_comida = p_comida and c.usuario_id = u)
  on conflict (comida_id, para_usuario) do nothing;
  get diagnostics nuevas = row_count;
  return nuevas;
end;
$$;

-- 7. El resumen de los lunes, uno por grupo.
drop function if exists public.armar_resumen_semanal();
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
  -- El lunes espera a las 9, para contar lo que se cargue tarde el domingo.
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
      where c.fecha between inicio and fin and not c.privada and pf.grupo_id = p_grupo
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

  select string_agg(format('%s. %s, %s de 7 días', puesto, nombre, dias), E'\n' order by puesto) into constancia
  from (select *, row_number() over (order by dias desc, comidas desc, nombre) as puesto from semana) s where puesto <= 3;

  select string_agg(format('%s. %s, %s g', puesto, nombre, replace(to_char(proteinas, miles), ',', '.')), E'\n' order by puesto) into proteina
  from (select *, row_number() over (order by proteinas desc, nombre) as puesto from semana) s where puesto <= 3;

  select string_agg(format('%s. %s, %s kcal', puesto, nombre, replace(to_char(kcal, miles), ',', '.')), E'\n' order by puesto) into calorias
  from (select *, row_number() over (order by kcal desc, nombre) as puesto from semana) s where puesto <= 3;

  texto := format(E'Resumen de la semana (%s al %s)\nEntre todos: %s comidas y %s fotos\n\nConstancia\n%s\n\nProteína\n%s\n\nMás comió\n%s',
    to_char(inicio, 'DD/MM'), to_char(fin, 'DD/MM'), grupo_comidas, grupo_fotos, constancia, proteina, calorias);

  insert into mensajes (usuario_id, texto, bot_semana, grupo_id) values (null, texto, inicio, p_grupo)
  on conflict (grupo_id, bot_semana) do nothing;
  drop table semana;
  return texto;
end;
$$;
revoke all on function public.armar_resumen_semanal(uuid) from public, anon, authenticated;

create or replace function public.publicar_resumen_semanal()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return; end if;
  -- Unos minutos de margen para que el aviso programado salga primero.
  if now() at time zone 'America/Argentina/Buenos_Aires' < date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '9 hours 10 minutes' then return; end if;
  perform armar_resumen_semanal(mi_grupo());
end;
$$;

-- 8. Avisos programados: el resumen a cada grupo que tuvo el suyo; el Match Day, solo al grupo con Bocha.
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
      'titulo', 'Son las 21. ¿Cargaste todo?',
      'cuerpo', 'Subí tus comidas de hoy, gordito.',
      'vista', 'resumen',
      -- No se le avisa a quien ya cargó el día.
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        join perfiles p on p.id = s.usuario_id and p.grupo_id is not null
        where not exists (select 1 from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy and c.tipo = 'resumen')
          and (select count(*) from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy) < 3
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'semana' then
    for g in select id from grupos loop
      if armar_resumen_semanal(g.id) is not null then con_resumen := con_resumen || g.id; end if;
    end loop;
    if cardinality(con_resumen) = 0 then return null; end if;
    return jsonb_build_object('titulo', 'Salieron los podios de la semana', 'cuerpo', 'Mirá cómo quedó cada uno en el chat.', 'vista', 'chat',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s join perfiles p on p.id = s.usuario_id
        where p.grupo_id = any(con_resumen)
      ), '[]'::jsonb));
  elsif p_tipo = 'matchday' then
    return jsonb_build_object('titulo', 'MATCH DAY ⚽', 'cuerpo', 'Día de guerra ⚔️. No te olvides de publicar tu CARB LOAD 🍝', 'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s join perfiles p on p.id = s.usuario_id join grupos gr on gr.id = p.grupo_id
        where gr.con_bocha
      ), '[]'::jsonb));
  end if;
  raise exception 'tipo_invalido';
end;
$$;
revoke all on function public.destinos_programados(text, text) from public;
grant execute on function public.destinos_programados(text, text) to anon;

-- 9. La caca, grupo por grupo. Cuenta desde el día siguiente a entrar al grupo.
-- Con Bocha: maldición del Bocha y Bocha Evo el domingo. Sin Bocha: solo la 💩 y las fotos borrosas.
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
    select p.id, dia, 0 from perfiles p
    where p.grupo_id = g.id
      and (p.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia
      and fotos_del_dia(p.id, dia) < 1
    on conflict (usuario_id, fecha) do nothing;
    get diagnostics filas = row_count;
    nuevas := nuevas + filas;

    select string_agg(p.nombre, E'\n' order by p.nombre) into lista
    from multas m join perfiles p on p.id = m.usuario_id
    where m.fecha = dia and p.grupo_id = g.id;

    -- Un grupo que todavía no tiene a nadie no recibe mensajes del bot.
    continue when not exists (select 1 from perfiles where grupo_id = g.id and (unido_en at time zone 'America/Argentina/Buenos_Aires')::date < dia);

    if g.con_bocha then
      if lista is not null then
        texto := format(E'El %s no subieron ninguna foto 💩\n%s\n\nHoy les cae la maldición del Bocha. Se la sacan subiendo su foto del día.', to_char(dia, 'DD/MM'), lista);
      else
        texto := format('El %s todos subieron su foto. El Bocha descansa 👏', to_char(dia, 'DD/MM'));
      end if;
    else
      if lista is not null then
        texto := format(E'El %s no subieron ninguna foto 💩\n%s\n\nHoy no ven las fotos de los demás hasta subir la suya.', to_char(dia, 'DD/MM'), lista);
      else
        texto := format('El %s todos subieron su foto 👏', to_char(dia, 'DD/MM'));
      end if;
    end if;

    -- Domingo: la tabla de la semana. Con Bocha, el que más cacas juntó se come al Bocha Evo de lunes a domingo.
    if extract(isodow from dia) = 7 then
      if g.con_bocha then
        insert into bocha_evo (usuario_id, semana, cacas)
        select usuario_id, dia + 1, total from (
          select m.usuario_id, count(*)::smallint as total, rank() over (order by count(*) desc) as puesto
          from multas m join perfiles p on p.id = m.usuario_id
          where m.fecha between dia - 6 and dia and p.grupo_id = g.id
          group by m.usuario_id
        ) t
        where puesto = 1
        on conflict (usuario_id, semana) do nothing;
      end if;

      select string_agg(format('%s. %s, %s', puesto, nombre, total), E'\n' order by puesto, nombre) into lista
      from (
        select p.nombre, count(*) as total, rank() over (order by count(*) desc) as puesto
        from multas m join perfiles p on p.id = m.usuario_id
        where m.fecha between dia - 6 and dia and p.grupo_id = g.id
        group by p.id, p.nombre
      ) t;

      if g.con_bocha then
        select string_agg(p.nombre, ' y ' order by p.nombre) into evo
        from bocha_evo b join perfiles p on p.id = b.usuario_id
        where b.semana = dia + 1 and p.grupo_id = g.id;
        if evo is not null then
          texto := texto || format(E'\n\nCacas de la semana\n%s\n\nBOCHA EVO para %s toda la semana: pantalla llena de caca y teclado tapado, sin chat hasta el lunes.', lista, evo);
        else
          texto := texto || E'\n\nSemana sin cacas. El Bocha Evo se queda dormido 🙌';
        end if;
      elsif lista is not null then
        texto := texto || format(E'\n\nCacas de la semana\n%s', lista);
      else
        texto := texto || E'\n\nSemana sin cacas 🙌';
      end if;
    end if;

    insert into mensajes (usuario_id, texto, bot_multas, grupo_id) values (null, texto, dia, g.id)
    on conflict (grupo_id, bot_multas) do nothing;
  end loop;
  return nuevas;
end;
$$;
revoke all on function public.contar_multas(date) from public, anon, authenticated;

-- El Bocha Evo tapa el teclado solo en el grupo con Bocha.
create or replace function public.chat_tapado_por_bocha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.usuario_id is not null and exists (
    select 1 from bocha_evo b
    join perfiles p on p.id = b.usuario_id
    join grupos g on g.id = p.grupo_id and g.con_bocha
    where b.usuario_id = new.usuario_id
      and b.semana = date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) then
    raise exception 'bocha_evo';
  end if;
  return new;
end;
$$;

-- El aviso de las 22, con el texto de cada grupo.
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
      'titulo', 'Te falta tu foto de hoy ⚠️',
      'cuerpo', 'Subí al menos una antes de las 00 o mañana te cae la maldición del Bocha 💩',
      'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
          'cuerpo', case when g.con_bocha then null else 'Subí al menos una antes de las 00 o mañana no vas a ver las fotos de los demás 💩' end))
        from suscripciones_push s
        join perfiles p on p.id = s.usuario_id
        join grupos g on g.id = p.grupo_id
        where fotos_del_dia(s.usuario_id, hoy) < 1
          and (g.creado_en at time zone 'America/Argentina/Buenos_Aires')::date < hoy
          and (p.unido_en at time zone 'America/Argentina/Buenos_Aires')::date < hoy
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'anuncio_caca' then
    return jsonb_build_object(
      'titulo', 'Nueva regla: la caca 💩',
      'cuerpo', 'Desde mañana, mínimo 1 foto de comida por día. Si no, te cae la maldición del Bocha. Y el peor de la semana se come al BOCHA EVO. Detalles en Ajustes → Tutorial.',
      'vista', 'ajustes',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s join perfiles p on p.id = s.usuario_id join grupos g on g.id = p.grupo_id
        where g.con_bocha
      ), '[]'::jsonb)
    );
  end if;
  return null;
end;
$$;
revoke all on function public.destinos_caca(text, text) from public;
grant execute on function public.destinos_caca(text, text) to anon;

-- 10. Filtros para los demás avisos, sin tener que reescribirlos.
-- Los que manda alguien desde la app (mensajes, comidas, logros): solo a su grupo.
create or replace function public.solo_mi_grupo(p_endpoints text[])
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.endpoint), '{}')
  from suscripciones_push s join perfiles p on p.id = s.usuario_id
  where s.endpoint = any(p_endpoints)
    and p.grupo_id = (select grupo_id from perfiles where id = auth.uid());
$$;
revoke all on function public.solo_mi_grupo(text[]) from public, anon;
grant execute on function public.solo_mi_grupo(text[]) to authenticated;

-- Los programados: el viaje es solo del grupo con Bocha; el resto, a cualquiera que tenga grupo.
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
    from suscripciones_push s join perfiles p on p.id = s.usuario_id join grupos g on g.id = p.grupo_id
    where s.endpoint = any(p_endpoints)
      and (g.con_bocha or p_tipo not in ('viaje', 'matchday', 'anuncio_caca'))
  ), '{}');
end;
$$;
revoke all on function public.filtrar_destinos(text, text, text[]) from public;
grant execute on function public.filtrar_destinos(text, text, text[]) to anon;

select 'Grupos listos: ' || string_agg(format('%s (%s personas)', g.nombre, (select count(*) from public.perfiles p where p.grupo_id = g.id)), ', ' order by g.creado_en) as resultado
from public.grupos g;
