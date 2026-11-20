-- 061: recetas con paso a paso (opcional) y videos de recetas (TikTok, Instagram, YouTube).
-- Los videos no son recetas propias: son solo un link con nombre. Se ven aparte, marcados con su red.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

-- 1. El paso a paso: un paso por renglon.
alter table public.recetas_propias add column if not exists pasos text;
alter table public.recetas_propias drop constraint if exists recetas_propias_pasos_check;
alter table public.recetas_propias add constraint recetas_propias_pasos_check check (pasos is null or char_length(pasos) <= 4000);

-- 2. Los videos de recetas. Como las recetas: los ve el grupo si estan compartidos; solo quien lo subio lo cambia o lo borra.
create table if not exists public.recetas_videos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  url text not null check (char_length(url) between 10 and 500 and url ~ '^https?://'),
  titulo text not null check (char_length(titulo) between 1 and 80),
  red text not null default 'otro' check (red in ('tiktok', 'instagram', 'youtube', 'otro')),
  compartida boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists recetas_videos_usuario on public.recetas_videos (usuario_id, creado_en desc);
alter table public.recetas_videos enable row level security;
revoke all on public.recetas_videos from anon, authenticated;
grant select, insert, update, delete on public.recetas_videos to authenticated;

drop policy if exists "videos: ver" on public.recetas_videos;
drop policy if exists "videos: crear propios" on public.recetas_videos;
drop policy if exists "videos: editar propios" on public.recetas_videos;
drop policy if exists "videos: borrar propios" on public.recetas_videos;
create policy "videos: ver" on public.recetas_videos for select to authenticated
  using (usuario_id = auth.uid() or (compartida and public.del_grupo(usuario_id)));
create policy "videos: crear propios" on public.recetas_videos for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "videos: editar propios" on public.recetas_videos for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "videos: borrar propios" on public.recetas_videos for delete to authenticated
  using (usuario_id = auth.uid());

select 'Listo: recetas con paso a paso y videos de recetas.' as resultado;
