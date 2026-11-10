-- Recetas compartidas: el grupo puede ver las recetas de los demás y mandarlas por el chat.
-- Cada uno decide en su receta si la ve el grupo (por defecto, sí). Solo el dueño la cambia o la borra.
-- Ejecutar en el SQL Editor de Supabase, después de 030_macros_imposibles.sql.

alter table public.recetas_propias add column if not exists compartida boolean not null default true;

drop policy if exists "recetas: propias" on public.recetas_propias;
drop policy if exists "recetas: ver" on public.recetas_propias;
drop policy if exists "recetas: crear propias" on public.recetas_propias;
drop policy if exists "recetas: editar propias" on public.recetas_propias;
drop policy if exists "recetas: borrar propias" on public.recetas_propias;

create policy "recetas: ver" on public.recetas_propias for select to authenticated
  using (usuario_id = auth.uid() or compartida);
create policy "recetas: crear propias" on public.recetas_propias for insert to authenticated
  with check (usuario_id = auth.uid());
create policy "recetas: editar propias" on public.recetas_propias for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "recetas: borrar propias" on public.recetas_propias for delete to authenticated
  using (usuario_id = auth.uid());

-- Un mensaje del chat puede llevar una receta. Si la receta se borra, el mensaje queda sin ella.
alter table public.mensajes add column if not exists receta_id uuid references public.recetas_propias(id) on delete set null;
