-- Todo el grupo ve los pedidos de mejora de todos. Solo quien administra los marca como hechos.
-- Ejecutar en el SQL Editor de Supabase, después de 019_audios.sql.
drop policy if exists "mejoras: ver" on public.mejoras;
create policy "mejoras: ver" on public.mejoras for select to authenticated using (true);
