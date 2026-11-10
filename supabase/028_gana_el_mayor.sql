-- El total del día: por defecto cuenta el mayor entre lo de Apple Salud y lo cargado en la app.
-- Así, una comida cargada en la app que no está en Salud se suma. Cada uno lo puede cambiar en Ajustes.
-- Ejecutar en el SQL Editor de Supabase, después de 027_mejora_hecha.sql.
alter table public.perfiles alter column modo_total set default 'mayor';
update public.perfiles set modo_total = 'mayor' where modo_total = 'salud';
select nombre, modo_total from public.perfiles order by nombre;
