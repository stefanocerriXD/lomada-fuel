-- Multas: quien sube menos de 2 fotos de comidas en un día suma una multa.
-- Cada uno tiene un comodín por semana. El bot avisa en el chat y el lunes dice a quién le toca la prenda.
-- Ejecutar en el SQL Editor de Supabase, después de 024_recetas_propias.sql.

create table if not exists public.ajustes_grupo (
  clave text primary key,
  valor text not null check (char_length(valor) between 1 and 200)
);
-- Se empieza a contar desde mañana: nadie arranca con multas viejas.
insert into public.ajustes_grupo (clave, valor) values
  ('prenda', 'Paga las birras del Match Day 🍺'),
  ('multas_desde', ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 1)::text)
on conflict (clave) do nothing;

create table if not exists public.multas (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  fotos smallint not null default 0,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, fecha)
);

create table if not exists public.comodines (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, fecha)
);

alter table public.ajustes_grupo enable row level security;
alter table public.multas enable row level security;
alter table public.comodines enable row level security;
revoke all on public.ajustes_grupo, public.multas, public.comodines from anon, authenticated;
grant select on public.ajustes_grupo, public.multas, public.comodines to authenticated;
grant update on public.ajustes_grupo to authenticated;

-- Las multas y los comodines los ve todo el grupo; se crean solo con las funciones de abajo.
drop policy if exists "ajustes grupo: ver" on public.ajustes_grupo;
create policy "ajustes grupo: ver" on public.ajustes_grupo for select to authenticated using (true);
drop policy if exists "ajustes grupo: prenda" on public.ajustes_grupo;
create policy "ajustes grupo: prenda" on public.ajustes_grupo for update to authenticated
  using (clave = 'prenda' and public.es_admin()) with check (clave = 'prenda');
drop policy if exists "multas: ver" on public.multas;
create policy "multas: ver" on public.multas for select to authenticated using (true);
drop policy if exists "comodines: ver" on public.comodines;
create policy "comodines: ver" on public.comodines for select to authenticated using (true);

-- Los mensajes del bot de multas tampoco tienen autor.
alter table public.mensajes add column if not exists bot_multas date unique;
alter table public.mensajes drop constraint if exists mensajes_autor_o_bot;
alter table public.mensajes add constraint mensajes_autor_o_bot check (usuario_id is not null or bot_semana is not null or bot_multas is not null);

create or replace function public.fotos_del_dia(p_usuario uuid, p_fecha date)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer from comidas
  where usuario_id = p_usuario and fecha = p_fecha and tipo <> 'resumen' and foto_path is not null;
$$;

-- Comodín: perdona hoy o ayer, uno por semana (de lunes a domingo). Si ayer ya tenía multa, se la saca.
create or replace function public.usar_comodin(p_fecha date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if p_fecha not in (hoy, hoy - 1) then raise exception 'fecha_invalida'; end if;
  if exists (
    select 1 from comodines where usuario_id = yo and date_trunc('week', fecha) = date_trunc('week', p_fecha::timestamp)
  ) then
    raise exception 'comodin_usado';
  end if;
  insert into comodines (usuario_id, fecha) values (yo, p_fecha);
  delete from multas where usuario_id = yo and fecha = p_fecha;
end;
$$;

-- Cuenta las multas de un día (por defecto, ayer) y publica el escrache. El domingo cierra la semana con la prenda.
create or replace function public.contar_multas(p_fecha date default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  dia date := coalesce(p_fecha, (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1);
  desde date;
  nuevas integer;
  texto text;
  lista text;
  inicio date;
  peor text;
  prenda text;
begin
  select valor::date into desde from ajustes_grupo where clave = 'multas_desde';
  if desde is not null and dia < desde then return 0; end if;

  insert into multas (usuario_id, fecha, fotos)
  select p.id, dia, fotos_del_dia(p.id, dia)
  from perfiles p
  where fotos_del_dia(p.id, dia) < 2
    and not exists (select 1 from comodines c where c.usuario_id = p.id and c.fecha = dia)
  on conflict (usuario_id, fecha) do nothing;
  get diagnostics nuevas = row_count;

  select string_agg(format('%s: %s %s', p.nombre, m.fotos, case when m.fotos = 1 then 'foto' else 'fotos' end), E'\n' order by p.nombre)
  into lista
  from multas m join perfiles p on p.id = m.usuario_id
  where m.fecha = dia;

  if lista is not null then
    texto := format(E'Multas del %s 🐷\n%s\n\nMínimo 2 fotos de comidas por día. Si tuviste un día complicado, usá tu comodín en Retos.', to_char(dia, 'DD/MM'), lista);
  else
    texto := format('El %s todos subieron sus fotos. Sin multas 👏', to_char(dia, 'DD/MM'));
  end if;

  -- El domingo se cierra la semana: el que más multas juntó cumple la prenda.
  if extract(isodow from dia) = 7 then
    inicio := dia - 6;
    select string_agg(format('%s. %s, %s', puesto, nombre, total), E'\n' order by puesto), string_agg(nombre, ' y ') filter (where puesto = 1 and total > 0)
    into lista, peor
    from (
      select p.nombre, count(*) as total, rank() over (order by count(*) desc) as puesto
      from multas m join perfiles p on p.id = m.usuario_id
      where m.fecha between inicio and dia
      group by p.nombre
    ) t;
    select valor into prenda from ajustes_grupo where clave = 'prenda';
    if peor is not null then
      texto := texto || format(E'\n\nMultas de la semana\n%s\n\nPrenda para %s: %s', lista, peor, coalesce(prenda, 'a definir'));
    else
      texto := texto || E'\n\nSemana sin multas. Nadie paga nada 🙌';
    end if;
  end if;

  insert into mensajes (usuario_id, texto, bot_multas) values (null, texto, dia) on conflict (bot_multas) do nothing;
  return nuevas;
end;
$$;

revoke all on function public.fotos_del_dia(uuid, date), public.contar_multas(date) from public, anon, authenticated;
revoke all on function public.usar_comodin(date) from public, anon;
grant execute on function public.usar_comodin(date) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.multas;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.comodines;
exception when duplicate_object then null;
end $$;

-- Todos los días a las 00:05 de Argentina se cuentan las multas del día anterior.
select cron.schedule('lomada-multas', '5 3 * * *', 'select public.contar_multas()');
