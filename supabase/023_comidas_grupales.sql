-- Comidas grupales: uno publica, suma a otros integrantes y cada uno acepta.
-- Al aceptar, la comida se copia en el día de quien acepta (cuenta para sus totales y la puede ajustar).
-- Ejecutar en el SQL Editor de Supabase, después de 022_objetivo_y_macros.sql.

-- Todas las copias de una comida grupal comparten el id de la original.
alter table public.comidas add column if not exists grupo_comida uuid;
create index if not exists comidas_grupo_comida on public.comidas (grupo_comida) where grupo_comida is not null;

create table if not exists public.invitaciones_comida (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references public.comidas(id) on delete cascade,
  de_usuario uuid not null references public.perfiles(id) on delete cascade,
  para_usuario uuid not null references public.perfiles(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  copia_id uuid,
  creado_en timestamptz not null default now(),
  respondida_en timestamptz,
  unique (comida_id, para_usuario),
  check (de_usuario <> para_usuario)
);

alter table public.invitaciones_comida enable row level security;
revoke all on public.invitaciones_comida from anon, authenticated;
grant select, delete on public.invitaciones_comida to authenticated;

-- Cada invitación la ven solo quien invita y quien es invitado. Se crean y se responden con las funciones de abajo.
drop policy if exists "invitaciones: ver" on public.invitaciones_comida;
create policy "invitaciones: ver" on public.invitaciones_comida for select to authenticated
  using (de_usuario = auth.uid() or para_usuario = auth.uid());
drop policy if exists "invitaciones: cancelar" on public.invitaciones_comida;
create policy "invitaciones: cancelar" on public.invitaciones_comida for delete to authenticated
  using (de_usuario = auth.uid() and estado = 'pendiente');

-- Quien fue invitado ve la comida aunque sea privada, para decidir si acepta.
drop policy if exists "comidas: ver" on public.comidas;
create policy "comidas: ver" on public.comidas for select to authenticated
  using (
    usuario_id = auth.uid()
    or not privada
    or exists (select 1 from public.invitaciones_comida i where i.comida_id = comidas.id and i.para_usuario = auth.uid())
  );

-- La foto de una comida grupal está en la carpeta de quien la subió: la ven también los que comieron.
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] = 'chat'
      or exists (select 1 from public.comidas c where c.foto_path = storage.objects.name and (not c.privada or c.usuario_id = auth.uid()))
      or exists (
        select 1 from public.invitaciones_comida i join public.comidas c on c.id = i.comida_id
        where c.foto_path = storage.objects.name and i.para_usuario = auth.uid()
      )
    )
  );

-- Suma integrantes a una comida propia. Devuelve cuántas invitaciones nuevas salieron.
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
    and exists (select 1 from perfiles where id = u)
    and not exists (select 1 from comidas c where c.grupo_comida = p_comida and c.usuario_id = u)
  on conflict (comida_id, para_usuario) do nothing;
  get diagnostics nuevas = row_count;
  return nuevas;
end;
$$;

-- Acepta (copia la comida en tu día) o rechaza. Devuelve el id de tu copia.
create or replace function public.responder_invitacion(p_id uuid, p_acepta boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  inv invitaciones_comida;
  c comidas;
  nueva uuid;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select * into inv from invitaciones_comida where id = p_id and para_usuario = yo for update;
  if not found then raise exception 'no_encontrada'; end if;
  if inv.estado <> 'pendiente' then return inv.copia_id; end if;

  if not p_acepta then
    update invitaciones_comida set estado = 'rechazada', respondida_en = now() where id = p_id;
    return null;
  end if;

  select * into c from comidas where id = inv.comida_id;
  insert into comidas (usuario_id, tipo, fecha, foto_path, descripcion, calorias, proteinas, carbohidratos, grasas, macros_editados, alimentos, privada, grupo_comida)
  values (yo, c.tipo, c.fecha, c.foto_path, c.descripcion, c.calorias, c.proteinas, c.carbohidratos, c.grasas, c.macros_editados, c.alimentos, c.privada, inv.comida_id)
  returning id into nueva;

  update invitaciones_comida set estado = 'aceptada', respondida_en = now(), copia_id = nueva where id = p_id;
  return nueva;
end;
$$;

-- A quién avisar: con el id de tu comida, a los que acabás de invitar; con el id de una invitación que aceptaste, a quien te invitó.
create or replace function public.aviso_invitacion(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  c comidas;
  inv invitaciones_comida;
  momento text;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre into autor from perfiles where id = yo;

  select * into c from comidas where id = p_id and usuario_id = yo;
  if found then
    momento := case c.tipo when 'desayuno' then 'desayuno' when 'almuerzo' then 'almuerzo' when 'merienda' then 'merienda' when 'cena' then 'cena' else 'colación' end;
    return jsonb_build_object(
      'titulo', autor || ' te sumó a su ' || momento || ' 🍽️',
      'cuerpo', coalesce(nullif(left(c.descripcion, 80), ''), 'Comida grupal') || '. Aceptá para sumarla a tu día.',
      'vista', 'resumen',
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s join invitaciones_comida i on i.para_usuario = s.usuario_id
        where i.comida_id = p_id and i.de_usuario = yo and i.estado = 'pendiente' and i.creado_en > now() - interval '2 minutes'
      ), '[]'::jsonb)
    );
  end if;

  select * into inv from invitaciones_comida
  where id = p_id and para_usuario = yo and estado = 'aceptada' and respondida_en > now() - interval '2 minutes';
  if not found then return null; end if;
  return jsonb_build_object(
    'titulo', autor || ' se sumó a tu comida 🤝',
    'cuerpo', 'Ya la tiene cargada en su día.',
    'vista', 'resumen',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id = inv.de_usuario
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.invitar_a_comida(uuid, uuid[]), public.responder_invitacion(uuid, boolean), public.aviso_invitacion(uuid) from public, anon;
grant execute on function public.invitar_a_comida(uuid, uuid[]), public.responder_invitacion(uuid, boolean), public.aviso_invitacion(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.invitaciones_comida;
exception when duplicate_object then null;
end $$;
