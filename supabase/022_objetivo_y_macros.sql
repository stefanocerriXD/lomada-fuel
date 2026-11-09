-- Plan según el objetivo: definir, mantener o bulkear, qué priorizar y macros a medida.
-- Ejecutar en el SQL Editor de Supabase, después de 021_colaciones.sql.
alter table public.perfiles_salud
  add column if not exists objetivo text check (objetivo in ('definir', 'mantener', 'bulk')),
  add column if not exists prioridad text not null default 'equilibrado' check (prioridad in ('equilibrado', 'proteina', 'carbos')),
  add column if not exists proteinas_propias smallint check (proteinas_propias between 20 and 500),
  add column if not exists carbos_propios smallint check (carbos_propios between 0 and 1000),
  add column if not exists grasas_propias smallint check (grasas_propias between 10 and 400);
