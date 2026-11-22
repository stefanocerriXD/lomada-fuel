-- 065: fijar fotos en el perfil (como en Instagram): hasta 3 comidas con foto quedan arriba de todo en la galeria.
-- Las ve el grupo como siempre (mismas reglas que la comida). Solo quien subio la comida la fija o la suelta.
-- Ejecutar en el SQL Editor de Supabase, despues de 064. Se puede correr mas de una vez.

alter table public.comidas add column if not exists fijada_en timestamptz;

-- Tope de 3 fijadas por persona (la base lo cuida aunque la app tambien avise).
create or replace function public.fijadas_tope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.fijada_en is not null and old.fijada_en is null
     and (select count(*) from comidas c where c.usuario_id = new.usuario_id and c.fijada_en is not null and c.id <> new.id) >= 3 then
    raise exception 'demasiadas_fijadas';
  end if;
  return new;
end;
$$;
drop trigger if exists fijadas_tope on public.comidas;
create trigger fijadas_tope before update of fijada_en on public.comidas
  for each row execute function public.fijadas_tope();

select 'Listo: fotos fijadas en el perfil.' as resultado;
