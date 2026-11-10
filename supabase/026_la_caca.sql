-- La caca: mínimo 1 foto de comida por día. El que no sube amanece con la maldición del Bocha
-- y el que más cacas junta en la semana se come al BOCHA EVO toda la semana siguiente (sin chat).
-- Reemplaza a 025_multas.sql: sirve tanto si 025 se corrió como si no.
-- Ejecutar en el SQL Editor de Supabase, después de 024_recetas_propias.sql.

create table if not exists public.ajustes_grupo (
  clave text primary key,
  valor text not null check (char_length(valor) between 1 and 200)
);
create table if not exists public.multas (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  fotos smallint not null default 0,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, fecha)
);
-- El Bocha Evo de cada semana: la semana es el lunes en que empieza el castigo.
create table if not exists public.bocha_evo (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  semana date not null,
  cacas smallint not null,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, semana)
);

-- Sin comodín y sin prenda.
drop function if exists public.usar_comodin(date);
drop table if exists public.comodines;
delete from public.ajustes_grupo where clave = 'prenda';
drop policy if exists "ajustes grupo: prenda" on public.ajustes_grupo;

-- Se empieza a contar desde mañana: nadie arranca con cacas viejas.
insert into public.ajustes_grupo (clave, valor)
values ('multas_desde', ((now() at time zone 'America/Argentina/Buenos_Aires')::date + 1)::text)
on conflict (clave) do update set valor = excluded.valor;

alter table public.ajustes_grupo enable row level security;
alter table public.multas enable row level security;
alter table public.bocha_evo enable row level security;
revoke all on public.ajustes_grupo, public.multas, public.bocha_evo from anon, authenticated;
grant select on public.ajustes_grupo, public.multas, public.bocha_evo to authenticated;

drop policy if exists "ajustes grupo: ver" on public.ajustes_grupo;
create policy "ajustes grupo: ver" on public.ajustes_grupo for select to authenticated using (true);
drop policy if exists "multas: ver" on public.multas;
create policy "multas: ver" on public.multas for select to authenticated using (true);
drop policy if exists "bocha evo: ver" on public.bocha_evo;
create policy "bocha evo: ver" on public.bocha_evo for select to authenticated using (true);

-- Las imágenes del Bocha las sube quien administra a su carpeta "bocha" y las ve todo el grupo.
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] in ('chat', 'bocha')
      or exists (select 1 from public.comidas c where c.foto_path = storage.objects.name and (not c.privada or c.usuario_id = auth.uid()))
      or exists (
        select 1 from public.invitaciones_comida i join public.comidas c on c.id = i.comida_id
        where c.foto_path = storage.objects.name and i.para_usuario = auth.uid()
      )
    )
  );

create or replace function public.guardar_imagen_bocha(p_clave text, p_ruta text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_admin() then raise exception 'solo_admin'; end if;
  if p_clave not in ('bocha', 'bocha_evo') then raise exception 'clave_invalida'; end if;
  if p_ruta not like auth.uid()::text || '/bocha/%' then raise exception 'ruta_invalida'; end if;
  insert into ajustes_grupo (clave, valor) values (p_clave, p_ruta)
  on conflict (clave) do update set valor = excluded.valor;
end;
$$;
revoke all on function public.guardar_imagen_bocha(text, text) from public, anon;
grant execute on function public.guardar_imagen_bocha(text, text) to authenticated;

-- Los mensajes del bot de la caca tampoco tienen autor.
alter table public.mensajes add column if not exists bot_multas date unique;
alter table public.mensajes drop constraint if exists mensajes_autor_o_bot;
alter table public.mensajes add constraint mensajes_autor_o_bot check (usuario_id is not null or bot_semana is not null or bot_multas is not null);

-- El Bocha Evo tapa el teclado: esa semana no se puede mandar nada al chat.
create or replace function public.chat_tapado_por_bocha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.usuario_id is not null and exists (
    select 1 from bocha_evo
    where usuario_id = new.usuario_id
      and semana = date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) then
    raise exception 'bocha_evo';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_tapado_por_bocha on public.mensajes;
create trigger chat_tapado_por_bocha before insert on public.mensajes for each row execute function public.chat_tapado_por_bocha();

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

-- Cuenta las cacas de un día (por defecto, ayer). El domingo elige al Bocha Evo de la semana siguiente.
drop function if exists public.contar_multas(date);
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
  evo text;
begin
  select valor::date into desde from ajustes_grupo where clave = 'multas_desde';
  if desde is not null and dia < desde then return 0; end if;

  insert into multas (usuario_id, fecha, fotos)
  select p.id, dia, 0 from perfiles p
  where fotos_del_dia(p.id, dia) < 1
  on conflict (usuario_id, fecha) do nothing;
  get diagnostics nuevas = row_count;

  select string_agg(p.nombre, E'\n' order by p.nombre) into lista
  from multas m join perfiles p on p.id = m.usuario_id
  where m.fecha = dia;

  if lista is not null then
    texto := format(E'El %s no subieron ninguna foto 💩\n%s\n\nHoy les cae la maldición del Bocha. Se la sacan subiendo su foto del día.', to_char(dia, 'DD/MM'), lista);
  else
    texto := format('El %s todos subieron su foto. El Bocha descansa 👏', to_char(dia, 'DD/MM'));
  end if;

  -- Domingo: el que más cacas juntó en la semana se come al Bocha Evo de lunes a domingo.
  if extract(isodow from dia) = 7 then
    insert into bocha_evo (usuario_id, semana, cacas)
    select usuario_id, dia + 1, total from (
      select usuario_id, count(*)::smallint as total, rank() over (order by count(*) desc) as puesto
      from multas where fecha between dia - 6 and dia
      group by usuario_id
    ) t
    where puesto = 1
    on conflict (usuario_id, semana) do nothing;

    select string_agg(format('%s. %s, %s', puesto, nombre, total), E'\n' order by puesto, nombre) into lista
    from (
      select p.nombre, count(*) as total, rank() over (order by count(*) desc) as puesto
      from multas m join perfiles p on p.id = m.usuario_id
      where m.fecha between dia - 6 and dia
      group by p.nombre
    ) t;
    select string_agg(p.nombre, ' y ' order by p.nombre) into evo
    from bocha_evo b join perfiles p on p.id = b.usuario_id
    where b.semana = dia + 1;

    if evo is not null then
      texto := texto || format(E'\n\nCacas de la semana\n%s\n\nBOCHA EVO para %s toda la semana: pantalla llena de caca y teclado tapado, sin chat hasta el lunes.', lista, evo);
    else
      texto := texto || E'\n\nSemana sin cacas. El Bocha Evo se queda dormido 🙌';
    end if;
  end if;

  insert into mensajes (usuario_id, texto, bot_multas) values (null, texto, dia) on conflict (bot_multas) do nothing;
  return nuevas;
end;
$$;
revoke all on function public.fotos_del_dia(uuid, date), public.contar_multas(date) from public, anon, authenticated;

-- A quién avisar: a las 22, al que no subió ninguna foto hoy; el anuncio, a todos.
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
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where fotos_del_dia(s.usuario_id, hoy) < 1
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'anuncio_caca' then
    return jsonb_build_object(
      'titulo', 'Nueva regla: la caca 💩',
      'cuerpo', 'Desde mañana, mínimo 1 foto de comida por día. Si no, te cae la maldición del Bocha. Y el peor de la semana se come al BOCHA EVO. Detalles en Ajustes → Tutorial.',
      'vista', 'ajustes',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
      ), '[]'::jsonb)
    );
  end if;
  return null;
end;
$$;
revoke all on function public.destinos_caca(text, text) from public;
grant execute on function public.destinos_caca(text, text) to anon;

do $$
begin
  alter publication supabase_realtime add table public.multas;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.bocha_evo;
exception when duplicate_object then null;
end $$;

-- Relojes (hora universal): 03:05 son las 00:05 en Argentina y 01:00 son las 22.
-- El aviso de las 22 usa el mismo pedido que el recordatorio de las 21, así la clave no sale de la base.
do $$
declare
  pedido text;
begin
  perform cron.schedule('lomada-multas', '5 3 * * *', 'select public.contar_multas()');
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-caca', '0 1 * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"caca"}'));
  perform set_config('lomada.caca', 'La caca está programada', false);
exception when others then
  perform set_config('lomada.caca', 'No se pudo programar: ' || sqlerrm, false);
end;
$$;

select current_setting('lomada.caca', true) as resultado;
