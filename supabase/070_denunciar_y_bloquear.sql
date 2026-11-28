-- 070: denunciar contenido y bloquear personas (Apple lo exige a las apps con contenido de usuarios, guideline 1.2).
-- Denuncias: cualquiera denuncia un mensaje, una comida o un perfil. Le llega un aviso al duenio, que la revisa
-- desde Ajustes > Panel del duenio y puede borrar el contenido o descartarla.
-- Bloqueos: cada uno bloquea a quien quiera. No ve mas lo que sube esa persona y no le llegan sus avisos.
-- Ejecutar en el SQL Editor de Supabase, despues de 069. Se puede correr mas de una vez.

create table if not exists public.denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  denunciado_id uuid references public.perfiles(id) on delete cascade,
  tipo text not null check (tipo in ('mensaje', 'comida', 'perfil')),
  objeto_id uuid,
  motivo text not null check (motivo in ('ofensivo', 'acoso', 'sexual', 'spam', 'otro')),
  detalle text check (char_length(detalle) <= 500),
  -- Lo que se denuncio, tal como estaba (si despues lo borran, el duenio igual sabe que era).
  contenido text check (char_length(contenido) <= 1200),
  foto_path text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'borrado', 'descartada')),
  creado_en timestamptz not null default now(),
  resuelta_en timestamptz
);
create index if not exists denuncias_pendientes on public.denuncias (creado_en) where estado = 'pendiente';

alter table public.denuncias enable row level security;
revoke all on public.denuncias from anon, authenticated;
grant select, insert on public.denuncias to authenticated;

-- Cada uno ve las suyas (el duenio ve todas desde las funciones de abajo).
drop policy if exists "denuncias: ver las mias" on public.denuncias;
create policy "denuncias: ver las mias" on public.denuncias for select to authenticated
  using (denunciante_id = auth.uid());
-- Denunciar: a nombre propio, sin denunciarse a uno mismo y como mucho 30 por dia.
drop policy if exists "denuncias: crear" on public.denuncias;
create policy "denuncias: crear" on public.denuncias for insert to authenticated
  with check (
    denunciante_id = auth.uid()
    and estado = 'pendiente'
    and (denunciado_id is null or denunciado_id <> auth.uid())
    and (select count(*) from public.denuncias d where d.denunciante_id = auth.uid() and d.creado_en > now() - interval '1 day') < 30
  );

create table if not exists public.bloqueos (
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  bloqueado_id uuid not null references public.perfiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, bloqueado_id),
  check (usuario_id <> bloqueado_id)
);

alter table public.bloqueos enable row level security;
revoke all on public.bloqueos from anon, authenticated;
grant select, insert, delete on public.bloqueos to authenticated;

drop policy if exists "bloqueos: los mios" on public.bloqueos;
create policy "bloqueos: los mios" on public.bloqueos for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- El aviso de una denuncia nueva: le llega solo al duenio.
create or replace function public.aviso_denuncia(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  d public.denuncias;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select * into d from denuncias where id = p_id and denunciante_id = yo and creado_en > now() - interval '2 minutes';
  if d.id is null then return null; end if;
  return jsonb_build_object(
    'titulo', 'Nueva denuncia',
    'cuerpo', 'Hay ' || (case d.tipo when 'mensaje' then 'un mensaje' when 'comida' then 'una comida' else 'un perfil' end) || ' para revisar en el Panel del ' || U&'due\00F1o' || '.',
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s join dueno_app a on a.usuario_id = s.usuario_id
      where s.usuario_id <> yo
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.aviso_denuncia(uuid) from public, anon;
grant execute on function public.aviso_denuncia(uuid) to authenticated;

-- Las denuncias para revisar, con los nombres. Solo el duenio.
create or replace function public.denuncias_para_revisar()
returns table (
  id uuid, tipo text, motivo text, detalle text, contenido text, foto_path text, objeto_id uuid, estado text, creado_en timestamptz,
  denunciante text, denunciado text, denunciado_id uuid, sigue_estando boolean, denuncias_al_mismo bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  return query
    select d.id, d.tipo, d.motivo, d.detalle, d.contenido, d.foto_path, d.objeto_id, d.estado, d.creado_en,
      pa.nombre, pb.nombre, d.denunciado_id,
      case d.tipo
        when 'mensaje' then exists (select 1 from mensajes m where m.id = d.objeto_id)
        when 'comida' then exists (select 1 from comidas c where c.id = d.objeto_id)
        else pb.id is not null
      end,
      (select count(*) from denuncias x where x.denunciado_id = d.denunciado_id)
    from denuncias d
    left join perfiles pa on pa.id = d.denunciante_id
    left join perfiles pb on pb.id = d.denunciado_id
    where d.estado = 'pendiente' or d.creado_en > now() - interval '30 days'
    order by (d.estado = 'pendiente') desc, d.creado_en desc
    limit 100;
end;
$$;
revoke all on function public.denuncias_para_revisar() from public, anon;
grant execute on function public.denuncias_para_revisar() to authenticated;

-- Resolver: borrar lo denunciado (el mensaje, la comida, o la foto y la bio del perfil) o descartar la denuncia.
-- Las otras denuncias pendientes sobre lo mismo quedan resueltas igual.
create or replace function public.resolver_denuncia(p_id uuid, p_borrar boolean)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.denuncias;
  estado_final text := case when p_borrar then 'borrado' else 'descartada' end;
begin
  if not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  select * into d from denuncias where id = p_id;
  if d.id is null then raise exception 'no_existe'; end if;
  if p_borrar then
    if d.tipo = 'mensaje' then
      delete from mensajes where id = d.objeto_id;
    elsif d.tipo = 'comida' then
      delete from comidas where id = d.objeto_id;
    elsif d.denunciado_id is not null then
      -- El perfil: se sacan la foto y la bio (si la base ya las tiene).
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfiles' and column_name = 'foto_path') then
        execute 'update public.perfiles set foto_path = null where id = $1' using d.denunciado_id;
      end if;
      if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfiles' and column_name = 'bio') then
        execute 'update public.perfiles set bio = null where id = $1' using d.denunciado_id;
      end if;
    end if;
  end if;
  update denuncias set estado = estado_final, resuelta_en = now()
  where estado = 'pendiente' and (id = p_id or (tipo = d.tipo and objeto_id is not distinct from d.objeto_id and denunciado_id is not distinct from d.denunciado_id));
  return estado_final;
end;
$$;
revoke all on function public.resolver_denuncia(uuid, boolean) from public, anon;
grant execute on function public.resolver_denuncia(uuid, boolean) to authenticated;

-- Los avisos que manda alguien (reacciones, menciones, comidas...) no le llegan a quien lo bloqueo.
-- El que manda es auth.uid(): /api/notificar llama con su sesion.
create or replace function public.filtrar_preferencias(p_tipo text, p_endpoints text[])
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(s.endpoint), '{}')
  from suscripciones_push s
  where s.endpoint = any(p_endpoints)
    and public.aviso_permitido(s.usuario_id, p_tipo)
    and not exists (select 1 from bloqueos b where b.usuario_id = s.usuario_id and b.bloqueado_id = auth.uid());
$$;
revoke all on function public.filtrar_preferencias(text, text[]) from public, anon;
grant execute on function public.filtrar_preferencias(text, text[]) to authenticated;

select 'Listo: denunciar y bloquear.' as resultado;
