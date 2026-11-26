-- 067: el Bocha Evo dura un solo dia (el lunes) y no toda la semana.
-- Al que le toca el domingo a la noche lo tiene todo el lunes: cacona en la pantalla y sin chat. El martes ya se le va.
-- Ejecutar en el SQL Editor de Supabase, despues de 066. Se puede correr mas de una vez.

-- El teclado tapado: solo el dia del castigo (la fila de bocha_evo guarda ese lunes).
create or replace function public.chat_tapado_por_bocha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.usuario_id is not null
     and exists (select 1 from grupos where id = new.grupo_id and con_bocha)
     and exists (
       select 1 from bocha_evo b
       where b.usuario_id = new.usuario_id
         and b.semana = (now() at time zone 'America/Argentina/Buenos_Aires')::date
     ) then
    raise exception 'bocha_evo';
  end if;
  return new;
end;
$$;

-- Los textos del bot y del aviso del lunes: "todo el lunes" en vez de "toda la semana".
-- Se cambian solo las frases dentro de las funciones que ya estan (contar_multas y destinos_caca).
do $$
declare
  f regprocedure;
  antes text;
  despues text;
begin
  foreach f in array array['public.contar_multas(date)'::regprocedure, 'public.destinos_caca(text, text)'::regprocedure] loop
    antes := pg_get_functiondef(f);
    despues := replace(antes, 'para %s toda la semana: pantalla llena de cacona y teclado tapado, sin chat hasta el lunes.', 'para %s todo el lunes: pantalla llena de cacona y teclado tapado, sin chat hasta el martes.');
    despues := replace(despues, 'para %s toda la semana: pantalla llena de caca y teclado tapado, sin chat hasta el lunes.', 'para %s todo el lunes: pantalla llena de cacona y teclado tapado, sin chat hasta el martes.');
    despues := replace(despues, 'Toda la semana con la pantalla de cacona y sin chat.', 'Todo el lunes con la pantalla de cacona y sin chat.');
    despues := replace(despues, 'A %s: toda la semana con la pantalla de cacona y sin chat.', 'A %s: todo el lunes con la pantalla de cacona y sin chat.');
    if despues <> antes then execute despues; end if;
  end loop;
end;
$$;

select 'Listo: el Bocha Evo dura un dia.' as resultado;
