-- 068: estrellas a los platos (de 1 a 5), desde las historias del Resumen.
-- Cada uno puntua las comidas de los demas (la propia no). Las estrellas las ve quien puede ver la comida.
-- Con esto salen el chef y el plato de la semana, las estadisticas y los logros de estrellas.
-- Ejecutar en el SQL Editor de Supabase, despues de 067. Se puede correr mas de una vez.

create table if not exists public.puntajes_comida (
  comida_id uuid not null references public.comidas(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  creado_en timestamptz not null default now(),
  primary key (comida_id, usuario_id)
);
create index if not exists puntajes_comida_usuario on public.puntajes_comida (usuario_id);

alter table public.puntajes_comida enable row level security;
revoke all on public.puntajes_comida from anon, authenticated;
grant select, insert, update, delete on public.puntajes_comida to authenticated;

-- Ver: si ves la comida, ves sus estrellas (la subconsulta respeta las reglas de comidas).
drop policy if exists "puntajes: ver" on public.puntajes_comida;
create policy "puntajes: ver" on public.puntajes_comida for select to authenticated
  using (exists (select 1 from public.comidas c where c.id = comida_id));

-- Poner o cambiar: solo las propias, a comidas de otro que ves (no a la tuya, ni al resumen del dia ni a la fiesta).
drop policy if exists "puntajes: poner" on public.puntajes_comida;
create policy "puntajes: poner" on public.puntajes_comida for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (select 1 from public.comidas c where c.id = comida_id and c.usuario_id <> auth.uid() and c.tipo not in ('resumen', 'fiesta'))
  );
drop policy if exists "puntajes: cambiar" on public.puntajes_comida;
create policy "puntajes: cambiar" on public.puntajes_comida for update to authenticated
  using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and exists (select 1 from public.comidas c where c.id = comida_id and c.usuario_id <> auth.uid() and c.tipo not in ('resumen', 'fiesta'))
  );
drop policy if exists "puntajes: sacar" on public.puntajes_comida;
create policy "puntajes: sacar" on public.puntajes_comida for delete to authenticated
  using (usuario_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.puntajes_comida;
exception when duplicate_object then null;
end $$;

select 'Listo: estrellas a los platos.' as resultado;
