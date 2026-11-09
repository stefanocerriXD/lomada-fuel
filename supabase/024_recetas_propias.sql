-- Recetas propias: cada uno guarda sus recetas con ingredientes y porciones para cargarlas después.
-- Ejecutar en el SQL Editor de Supabase, después de 023_comidas_grupales.sql.
create table if not exists public.recetas_propias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  ingredientes jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredientes) = 'array' and jsonb_array_length(ingredientes) <= 60),
  porciones smallint not null default 1 check (porciones between 1 and 100),
  peso_final numeric(7,1) check (peso_final is null or peso_final between 1 and 50000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.recetas_propias enable row level security;
revoke all on public.recetas_propias from anon, authenticated;
grant select, insert, update, delete on public.recetas_propias to authenticated;

-- Cada receta la ve y la toca solo quien la armó.
drop policy if exists "recetas: propias" on public.recetas_propias;
create policy "recetas: propias" on public.recetas_propias for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
