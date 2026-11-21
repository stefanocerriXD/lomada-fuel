-- 063: perfil tipo Instagram (etapa 1): bio corta y destacadas (colecciones de fotos: gym, cambio fisico, platos...).
-- Las destacadas las ve el grupo, salvo las marcadas "solo yo" (las de cambio fisico arrancan asi).
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez. Va despues del 062.

-- 1. La bio del perfil.
alter table public.perfiles add column if not exists bio text;
alter table public.perfiles drop constraint if exists perfiles_bio_check;
alter table public.perfiles add constraint perfiles_bio_check check (bio is null or char_length(bio) <= 120);

-- 2. Las destacadas: un nombre, si es privada y su orden.
create table if not exists public.destacadas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 24),
  privada boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists destacadas_usuario on public.destacadas (usuario_id, orden);

-- 3. Sus fotos: subidas (carpeta propia/destacadas) o tomadas de una comida propia. Hasta 30 por destacada.
create table if not exists public.destacadas_fotos (
  id uuid primary key default gen_random_uuid(),
  destacada_id uuid not null references public.destacadas(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  foto_path text not null check (char_length(foto_path) between 5 and 300),
  texto text check (texto is null or char_length(texto) <= 140),
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists destacadas_fotos_destacada on public.destacadas_fotos (destacada_id, orden);

-- Solo se suman fotos propias (de su carpeta) a destacadas propias, y con tope.
create or replace function public.destacada_foto_valida()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from destacadas d where d.id = new.destacada_id and d.usuario_id = new.usuario_id) then
    raise exception 'destacada_ajena';
  end if;
  if split_part(new.foto_path, '/', 1) <> new.usuario_id::text then
    raise exception 'foto_ajena';
  end if;
  if tg_op = 'INSERT' and (select count(*) from destacadas_fotos f where f.destacada_id = new.destacada_id) >= 30 then
    raise exception 'demasiadas_fotos';
  end if;
  return new;
end;
$$;
drop trigger if exists destacada_foto_valida on public.destacadas_fotos;
create trigger destacada_foto_valida before insert or update on public.destacadas_fotos
  for each row execute function public.destacada_foto_valida();

-- Hasta 20 destacadas por persona.
create or replace function public.destacadas_tope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from destacadas d where d.usuario_id = new.usuario_id) >= 20 then
    raise exception 'demasiadas_destacadas';
  end if;
  return new;
end;
$$;
drop trigger if exists destacadas_tope on public.destacadas;
create trigger destacadas_tope before insert on public.destacadas
  for each row execute function public.destacadas_tope();

alter table public.destacadas enable row level security;
alter table public.destacadas_fotos enable row level security;
revoke all on public.destacadas, public.destacadas_fotos from anon, authenticated;
grant select, insert, update, delete on public.destacadas, public.destacadas_fotos to authenticated;

drop policy if exists "destacadas: ver" on public.destacadas;
drop policy if exists "destacadas: crear propias" on public.destacadas;
drop policy if exists "destacadas: editar propias" on public.destacadas;
drop policy if exists "destacadas: borrar propias" on public.destacadas;
create policy "destacadas: ver" on public.destacadas for select to authenticated
  using (usuario_id = auth.uid() or (not privada and public.del_grupo(usuario_id)));
create policy "destacadas: crear propias" on public.destacadas for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "destacadas: editar propias" on public.destacadas for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "destacadas: borrar propias" on public.destacadas for delete to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "destacadas fotos: ver" on public.destacadas_fotos;
drop policy if exists "destacadas fotos: crear propias" on public.destacadas_fotos;
drop policy if exists "destacadas fotos: editar propias" on public.destacadas_fotos;
drop policy if exists "destacadas fotos: borrar propias" on public.destacadas_fotos;
create policy "destacadas fotos: ver" on public.destacadas_fotos for select to authenticated
  using (exists (select 1 from public.destacadas d where d.id = destacada_id and (d.usuario_id = auth.uid() or (not d.privada and public.del_grupo(d.usuario_id)))));
create policy "destacadas fotos: crear propias" on public.destacadas_fotos for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "destacadas fotos: editar propias" on public.destacadas_fotos for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "destacadas fotos: borrar propias" on public.destacadas_fotos for delete to authenticated
  using (usuario_id = auth.uid());

-- 4. Las fotos de las destacadas se ven si se ve la destacada (el resto queda igual que en el 042).
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] = 'bocha'
      or ((storage.foldername(name))[2] = 'chat' and public.carpeta_del_grupo((storage.foldername(name))[1]))
      or exists (
        select 1 from public.comidas c
        where (c.foto_path = storage.objects.name or c.postre_foto = storage.objects.name or storage.objects.name = any(c.fotos_extra))
          and (not c.privada or c.usuario_id = auth.uid())
      )
      or exists (
        select 1 from public.invitaciones_comida i join public.comidas c on c.id = i.comida_id
        where (c.foto_path = storage.objects.name or storage.objects.name = any(c.fotos_extra)) and i.para_usuario = auth.uid()
      )
      or exists (select 1 from public.recetas_propias r where storage.objects.name = any(r.fotos))
      or exists (
        select 1 from public.destacadas_fotos f join public.destacadas d on d.id = f.destacada_id
        where f.foto_path = storage.objects.name and (not d.privada and public.del_grupo(d.usuario_id))
      )
    )
  );

select 'Listo: bio y destacadas en el perfil.' as resultado;
