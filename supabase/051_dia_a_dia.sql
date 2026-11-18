-- 051: el dia a dia (sentado / se mueve bastante / trabajo fisico) para calcular mejor cuanto quema cada uno.
-- Antes el gasto salia solo de los dias de entreno y daba de mas a quien trabaja sentado.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

alter table public.perfiles_salud add column if not exists dia_a_dia text not null default 'sentado';
alter table public.perfiles_salud drop constraint if exists perfiles_salud_dia_a_dia_check;
alter table public.perfiles_salud add constraint perfiles_salud_dia_a_dia_check check (dia_a_dia in ('sentado', 'movido', 'fisico'));

select 'Listo: dia a dia agregado al plan (' || count(*) || ' planes).' as resultado from public.perfiles_salud;
