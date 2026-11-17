-- 048: el panel del duenio de la app, las mejoras de cada grupo y que cada uno elija sus notificaciones.
-- Ejecutar en el SQL Editor de Supabase, despues de 047. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.uso_avisos') is null then
    raise exception 'Falta correr antes el SQL 047_aviso_de_espacio.sql';
  end if;
end $$;

-- 1. El duenio de la app: el unico que ve el panel, el espacio y todas las mejoras.
--    Arranca siendo quien administra la Lomada (el resultado de abajo dice quien quedo).
create table if not exists public.dueno_app (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade
);
alter table public.dueno_app enable row level security;
revoke all on public.dueno_app from anon, authenticated;

insert into public.dueno_app (usuario_id)
select creado_por from public.grupos
where id = '00000000-0000-4000-8000-00000000a001' and creado_por is not null
  and not exists (select 1 from public.dueno_app);

create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from dueno_app where usuario_id = auth.uid());
$$;
revoke all on function public.es_dueno() from public, anon;
grant execute on function public.es_dueno() to authenticated;

-- El espacio lo ve solo el duenio, y los avisos de espacio le llegan solo a el.
create or replace function public.uso_de_la_app()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  return public.medir_uso();
end;
$$;

create or replace function public.destinos_uso(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uso jsonb := public.medir_uso();
  titulo text;
  cuerpo text;
  partes text[] := '{}';
  peor integer := 0;
  r record;
  pct integer;
  nivel integer;
  antes integer;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  if p_tipo = 'uso' then
    for r in select * from (values
      ('fotos', 'las fotos', (uso->>'fotos_bytes')::numeric, (uso->>'fotos_limite')::numeric),
      ('base', 'la base de datos', (uso->>'base_bytes')::numeric, (uso->>'base_limite')::numeric)
    ) as x(clave, nombre, usado, limite)
    loop
      pct := floor(100 * r.usado / r.limite);
      nivel := case when pct >= 95 then 95 when pct >= 85 then 85 when pct >= 70 then 70 else 0 end;
      select coalesce((select u.nivel from uso_avisos u where u.clave = r.clave), 0) into antes;
      if nivel <> antes then
        insert into uso_avisos (clave, nivel) values (r.clave, nivel)
        on conflict (clave) do update set nivel = excluded.nivel;
      end if;
      if nivel > antes then
        partes := partes || format('%s al %s%% (%s de %s MB)', r.nombre, pct, round(r.usado / 1048576), round(r.limite / 1048576));
        peor := greatest(peor, pct);
      end if;
    end loop;
    if cardinality(partes) = 0 then return null; end if;
    titulo := U&'\26A0\FE0F Lomada Fuel: ' || array_to_string(partes, ' y ') || ' del plan gratis';
    cuerpo := case when peor >= 95
      then U&'Est\00E1 por llenarse. Hay que reducir ya: entr\00E1 a Ajustes > Panel del due\00F1o.'
      else U&'Todav\00EDa hay margen, pero conviene ir reduciendo. Mir\00E1 Ajustes > Panel del due\00F1o.' end;
  elsif p_tipo = 'ia_sin_cupo' then
    titulo := U&'\26A0\FE0F La IA gratis lleg\00F3 al l\00EDmite';
    cuerpo := U&'Gemini dej\00F3 de responder por hoy (fotos, capturas y dictado). Vuelve sola; si pasa seguido, lo reducimos.';
  else
    return null;
  end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', cuerpo,
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s join dueno_app d on d.usuario_id = s.usuario_id
    ), '[]'::jsonb)
  );
end;
$$;

-- 2. Panel del duenio: todos los usuarios y numeros de la app.
create or replace function public.admin_usuarios()
returns table (
  id uuid, nombre text, usuario text, color text, creado_en timestamptz,
  grupos text[], comidas integer, comidas_7_dias integer, fotos integer, ultima_comida date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  return query
    select p.id, p.nombre, p.usuario, p.color, p.creado_en,
      coalesce((select array_agg(g.nombre order by g.nombre) from miembros_grupo m join grupos g on g.id = m.grupo_id where m.usuario_id = p.id), '{}'),
      (select count(*)::int from comidas c where c.usuario_id = p.id),
      (select count(*)::int from comidas c where c.usuario_id = p.id and c.fecha > current_date - 7),
      (select count(*)::int from comidas c where c.usuario_id = p.id and c.foto_path is not null),
      (select max(c.fecha) from comidas c where c.usuario_id = p.id)
    from perfiles p
    order by (select max(c.fecha) from comidas c where c.usuario_id = p.id) desc nulls last, p.creado_en;
end;
$$;

create or replace function public.admin_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  return jsonb_build_object(
    'usuarios', (select count(*) from perfiles),
    'usuarios_nuevos_7', (select count(*) from perfiles where creado_en > now() - interval '7 days'),
    'activos_7', (select count(distinct usuario_id) from comidas where fecha > hoy - 7),
    'activos_30', (select count(distinct usuario_id) from comidas where fecha > hoy - 30),
    'grupos', (select count(*) from grupos),
    'comidas', (select count(*) from comidas),
    'comidas_7', (select count(*) from comidas where fecha > hoy - 7),
    'fotos_7', (select count(*) from comidas where fecha > hoy - 7 and foto_path is not null),
    'mensajes_7', (select count(*) from mensajes where creado_en > now() - interval '7 days'),
    'kcal_dia', (
      select round(avg(total)) from (
        select sum(calorias) total from comidas where fecha > hoy - 30 and fecha < hoy and calorias > 0 group by usuario_id, fecha
      ) d
    ),
    'por_dia', (
      select jsonb_agg(jsonb_build_object('fecha', d.fecha::date, 'comidas', coalesce(x.n, 0), 'personas', coalesce(x.u, 0)) order by d.fecha)
      from generate_series(hoy - 13, hoy, interval '1 day') as d(fecha)
      left join (select fecha, count(*) n, count(distinct usuario_id) u from comidas where fecha > hoy - 14 group by fecha) x on x.fecha = d.fecha::date
    ),
    'por_hora', (
      select jsonb_agg(coalesce(x.n, 0) order by h)
      from generate_series(0, 23) as h
      left join (
        select extract(hour from creado_en at time zone 'America/Argentina/Buenos_Aires')::int hora, count(*) n
        from comidas where creado_en > now() - interval '30 days' group by 1
      ) x on x.hora = h
    ),
    'top_alimentos', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'veces', veces)), '[]'::jsonb) from (
        select initcap(lower(btrim(a->>'nombre'))) nombre, count(*) veces
        from comidas c, jsonb_array_elements(case when jsonb_typeof(c.alimentos) = 'array' then c.alimentos else '[]'::jsonb end) a
        where c.fecha > hoy - 30 and c.tipo <> 'fiesta' and coalesce(btrim(a->>'nombre'), '') <> ''
        group by 1 order by 2 desc limit 8
      ) t
    ),
    'mas_activos', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'comidas', n)), '[]'::jsonb) from (
        select p.nombre, count(*) n from comidas c join perfiles p on p.id = c.usuario_id
        where c.fecha > hoy - 7 group by p.nombre order by 2 desc limit 3
      ) t
    ),
    'grupos_lista', (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', g.nombre, 'miembros', (select count(*) from miembros_grupo m where m.grupo_id = g.id),
        'con_bocha', g.con_bocha, 'creado_en', g.creado_en) order by g.creado_en), '[]'::jsonb)
      from grupos g
    ),
    'vasos_30', (select coalesce(sum(jsonb_array_length(alimentos)), 0) from comidas where tipo = 'fiesta' and fecha > hoy - 30 and jsonb_typeof(alimentos) = 'array'),
    'registros_7', (select coalesce(jsonb_object_agg(codigo, n), '{}'::jsonb) from (select codigo, count(*) n from registros_diarios where fecha > hoy - 7 group by codigo) r)
  );
end;
$$;

revoke all on function public.admin_usuarios(), public.admin_insights() from public, anon;
grant execute on function public.admin_usuarios(), public.admin_insights() to authenticated;

-- 3. Mejoras: cada una queda en el grupo donde se pidio. Cada grupo ve las suyas; el duenio, todas.
alter table public.mejoras add column if not exists grupo_id uuid references public.grupos(id) on delete set null;
alter table public.mejoras alter column grupo_id set default public.mi_grupo();
update public.mejoras m set grupo_id = coalesce(
  (select p.grupo_id from public.perfiles p where p.id = m.usuario_id and p.grupo_id is not null
     and exists (select 1 from public.miembros_grupo x where x.usuario_id = m.usuario_id and x.grupo_id = p.grupo_id and x.unido_en <= m.creado_en)),
  (select x.grupo_id from public.miembros_grupo x where x.usuario_id = m.usuario_id order by x.unido_en limit 1)
)
where m.grupo_id is null;

drop policy if exists "mejoras: ver" on public.mejoras;
create policy "mejoras: ver" on public.mejoras for select to authenticated
  using (usuario_id = auth.uid() or grupo_id = public.mi_grupo() or public.es_dueno());

-- 4. Notificaciones a medida: cada uno apaga las que no quiere.
create table if not exists public.preferencias_avisos (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  apagados text[] not null default '{}' check (apagados <@ array[
    'mensajes', 'reacciones', 'comidas', 'invitaciones', 'logros', 'recordatorio', 'caca',
    'registros', 'semana', 'informe', 'lomada', 'mejoras', 'grupos'
  ]::text[]),
  actualizado_en timestamptz not null default now()
);
alter table public.preferencias_avisos enable row level security;
revoke all on public.preferencias_avisos from anon, authenticated;
grant select, insert, update on public.preferencias_avisos to authenticated;
drop policy if exists "preferencias_avisos: propias" on public.preferencias_avisos;
create policy "preferencias_avisos: propias" on public.preferencias_avisos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- De que grupo es cada tipo de aviso (lo que no esta aca, como los del duenio, no se puede apagar).
create or replace function public.categoria_aviso(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo = 'mensaje' then 'mensajes'
    when p_tipo in ('reaccion', 'reaccion_mensaje') then 'reacciones'
    when p_tipo in ('comida', 'postre') then 'comidas'
    when p_tipo in ('invitacion', 'salida') then 'invitaciones'
    when p_tipo = 'medalla' then 'logros'
    when p_tipo = 'recordatorio' then 'recordatorio'
    when p_tipo in ('caca', 'anuncio_caca') then 'caca'
    when p_tipo = 'registros' then 'registros'
    when p_tipo = 'semana' then 'semana'
    when p_tipo = 'informe' then 'informe'
    when p_tipo in ('matchday', 'viaje') then 'lomada'
    when p_tipo in ('mejora', 'mejora_hecha') then 'mejoras'
    when p_tipo in ('solicitud_grupo', 'grupo_aceptado') then 'grupos'
    else null
  end;
$$;

create or replace function public.aviso_permitido(p_usuario uuid, p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from preferencias_avisos pa
    where pa.usuario_id = p_usuario and public.categoria_aviso(p_tipo) = any(pa.apagados)
  );
$$;
revoke all on function public.aviso_permitido(uuid, text) from public, anon, authenticated;

-- Los avisos programados (recordatorio, caca, informe...) pasan por aca: se saca a quien los apago.
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
      and public.aviso_permitido(s.usuario_id, p_tipo)
  ), '{}');
end;
$$;

-- Los avisos que manda la app (mensajes, reacciones, comidas...) pasan por aca.
create or replace function public.filtrar_preferencias(p_tipo text, p_endpoints text[])
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.endpoint), '{}')
  from suscripciones_push s
  where s.endpoint = any(p_endpoints) and public.aviso_permitido(s.usuario_id, p_tipo);
$$;
revoke all on function public.filtrar_preferencias(text, text[]) from public, anon;
grant execute on function public.filtrar_preferencias(text, text[]) to authenticated;

select 'Listo: panel del duenio, mejoras por grupo y notificaciones a medida. Duenio: '
  || coalesce((select p.nombre from public.perfiles p join public.dueno_app d on d.usuario_id = p.id limit 1), 'NADIE (avisame)') as resultado;
