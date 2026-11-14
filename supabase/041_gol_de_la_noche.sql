-- 041: modo fiesta, si hubo gol (beso) o no esa noche. Se ve en Imagenes con la foto de la noche.
-- Se puede correr mas de una vez.
alter table public.comidas add column if not exists gol boolean;

select 'Listo: modo fiesta con gol.' as resultado;
