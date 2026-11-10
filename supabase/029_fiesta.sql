-- Modo fiesta: lo que se toma en la noche se guarda como una carga de tipo "fiesta".
-- Ejecutar en el SQL Editor de Supabase, después de 028_gana_el_mayor.sql.
alter table public.comidas drop constraint if exists comidas_tipo_check;
alter table public.comidas add constraint comidas_tipo_check
  check (tipo in ('desayuno', 'almuerzo', 'merienda', 'cena', 'colacion', 'fiesta', 'resumen'));
