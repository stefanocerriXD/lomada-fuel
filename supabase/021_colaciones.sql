-- Colaciones: lo que se come entre comidas. Puede haber varias por día.
-- Ejecutar en el SQL Editor de Supabase, después de 020_mejoras_para_todos.sql.
alter table public.comidas drop constraint if exists comidas_tipo_check;
alter table public.comidas add constraint comidas_tipo_check
  check (tipo in ('desayuno', 'almuerzo', 'merienda', 'cena', 'colacion', 'resumen'));
