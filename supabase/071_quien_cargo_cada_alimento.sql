-- 071: en el buscador, los alimentos que cargo otra persona (a mano o leyendo la etiqueta) dicen quien:
-- "Importado por Nahuel" si es de alguno de tus grupos, "Importado por otro usuario" si no.
-- Los de Open Food Facts no dicen nada (vienen de la base de internet). Lo que cargaste vos, tampoco.
-- Ejecutar en el SQL Editor de Supabase, despues de 070. Se puede correr mas de una vez.

-- Quien lo cargo, visto por quien busca: el nombre si comparten grupo, 'otro' si no, null si es propio o de internet.
create or replace function public.cargado_por(p_creador uuid, p_fuente text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_creador is null or p_creador = auth.uid() or p_fuente = 'off' then null
    when exists (
      select 1 from miembros_grupo a join miembros_grupo b on b.grupo_id = a.grupo_id
      where a.usuario_id = auth.uid() and b.usuario_id = p_creador
    ) then (select nombre from perfiles where id = p_creador)
    else 'otro'
  end;
$$;
revoke all on function public.cargado_por(uuid, text) from public, anon, authenticated;

-- El buscador devuelve una columna mas. Cambia lo que devuelve: hay que borrarla y crearla de nuevo.
drop function if exists public.buscar_productos(text);
create function public.buscar_productos(p_texto text)
returns table (id uuid, codigo text, nombre text, marca text, por100 jsonb, porcion jsonb, fuente text, veces integer, usuarios integer, cargado_por text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with palabras as (
    select w from unnest(string_to_array(texto_indice(p_texto), ' ')) as w
    where char_length(w) >= 2 and w not in ('de', 'del', 'con', 'sin', 'la', 'el', 'en')
  )
  select pr.id, pr.codigo, pr.nombre, pr.marca, pr.por100, pr.porcion, pr.fuente, pr.veces, pr.usuarios,
    public.cargado_por(pr.creado_por, pr.fuente)
  from productos pr
  where auth.uid() is not null
    and exists (select 1 from palabras)
    and not exists (
      select 1 from palabras
      where not (' ' || pr.indice) like ('% ' || case when char_length(w) > 3 then regexp_replace(w, '(es|s)$', '') else w end || '%')
    )
  order by pr.usuarios desc, pr.veces desc, char_length(pr.nombre)
  limit 15;
$$;
revoke all on function public.buscar_productos(text) from public, anon;
grant execute on function public.buscar_productos(text) to authenticated;

-- Al escanear un codigo que ya esta en el catalogo: el producto con quien lo cargo.
create or replace function public.producto_por_codigo(p_codigo text)
returns table (id uuid, codigo text, nombre text, marca text, por100 jsonb, porcion jsonb, fuente text, veces integer, usuarios integer, cargado_por text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pr.id, pr.codigo, pr.nombre, pr.marca, pr.por100, pr.porcion, pr.fuente, pr.veces, pr.usuarios,
    public.cargado_por(pr.creado_por, pr.fuente)
  from productos pr
  where auth.uid() is not null and pr.codigo = p_codigo;
$$;
revoke all on function public.producto_por_codigo(text) from public, anon;
grant execute on function public.producto_por_codigo(text) to authenticated;

select 'Listo: el buscador dice quien cargo cada alimento.' as resultado;
