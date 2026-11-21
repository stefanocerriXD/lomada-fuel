-- 062: comidas planeadas. Se cargan antes de comerlas (de hoy o de manana), sin foto y sin avisar al grupo.
-- Cuando se comen, se les suma la foto y recien ahi le llega el aviso al grupo.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

alter table public.comidas add column if not exists planeada boolean not null default false;

select 'Listo: comidas planeadas.' as resultado;
