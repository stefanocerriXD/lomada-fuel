-- 054: catalogo de productos compartido por TODA la app.
-- Cada producto que alguien escanea, busca y carga, o lee de la etiqueta, queda guardado con su codigo de barras:
-- la proxima vez que cualquiera lo escanee o lo busque, aparece al toque. La base crece con lo que la gente compra.
-- No guarda quien lo cargo a la vista de los demas. Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

-- 1. Los productos.
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique check (codigo is null or codigo ~ '^[0-9]{6,14}$'),
  nombre text not null check (char_length(nombre) between 1 and 80),
  marca text not null default '' check (char_length(marca) <= 60),
  por100 jsonb not null,
  porcion jsonb,
  fuente text not null default 'usuario' check (fuente in ('off', 'etiqueta', 'usuario')),
  indice text not null default '',
  veces integer not null default 1,
  usuarios integer not null default 1,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists productos_indice on public.productos (indice);
create unique index if not exists productos_nombre_marca on public.productos (lower(nombre), lower(marca)) where codigo is null;

-- Quien uso cada producto (para contar personas distintas; no se muestra).
create table if not exists public.productos_usos (
  producto_id uuid not null references public.productos(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  primary key (producto_id, usuario_id)
);

alter table public.productos enable row level security;
alter table public.productos_usos enable row level security;
revoke all on public.productos from anon, authenticated;
revoke all on public.productos_usos from anon, authenticated;
-- Todos los que usan la app leen el catalogo, sin ver quien cargo cada producto. Se escribe solo con la funcion.
grant select (id, codigo, nombre, marca, por100, porcion, fuente, veces, usuarios, actualizado_en) on public.productos to authenticated;
drop policy if exists "productos: leer" on public.productos;
create policy "productos: leer" on public.productos for select to authenticated using (true);

-- Para buscar sin tildes ni mayusculas.
create or replace function public.texto_indice(p_texto text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(p_texto, '')), U&'\00E1\00E9\00ED\00F3\00FA\00FC\00E0\00E8\00EC\00F2\00F9', 'aeiouuaeiou'),
    '[^a-z0-9' || U&'\00F1' || ']+', ' ', 'g'));
$$;

-- 2. Guardar (o contar un uso de) un producto. Devuelve el producto como quedo.
create or replace function public.guardar_producto(
  p_codigo text, p_nombre text, p_marca text, p_por100 jsonb, p_porcion jsonb default null, p_fuente text default 'usuario'
)
returns setof public.productos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  v_codigo text := nullif(regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g'), '');
  v_nombre text := left(trim(coalesce(p_nombre, '')), 80);
  v_marca text := left(trim(coalesce(p_marca, '')), 60);
  v_fuente text := case when p_fuente in ('off', 'etiqueta') then p_fuente else 'usuario' end;
  kcal numeric; p numeric; c numeric; g numeric;
  previo public.productos;
  nuevo_uso boolean;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if v_nombre = '' then raise exception 'falta_nombre'; end if;
  if v_codigo is not null and v_codigo !~ '^[0-9]{6,14}$' then raise exception 'codigo_invalido'; end if;
  begin
    kcal := (p_por100->>'kcal')::numeric; p := coalesce((p_por100->>'p')::numeric, 0);
    c := coalesce((p_por100->>'c')::numeric, 0); g := coalesce((p_por100->>'g')::numeric, 0);
  exception when others then raise exception 'valores_invalidos';
  end;
  -- Valores imposibles: no entran (la base es de todos).
  if kcal is null or kcal < 0 or kcal > 950 or p < 0 or c < 0 or g < 0 or p > 100 or c > 100 or g > 100 or p + c + g > 105 then
    raise exception 'valores_invalidos';
  end if;
  -- Un tope por dia para que nadie llene la base de basura.
  if (select count(*) from productos where creado_por = yo and creado_en > now() - interval '1 day') >= 60 then
    raise exception 'demasiados_productos';
  end if;

  if v_codigo is not null then
    select * into previo from productos where productos.codigo = v_codigo;
  else
    select * into previo from productos where productos.codigo is null and lower(productos.nombre) = lower(v_nombre) and lower(productos.marca) = lower(v_marca);
  end if;

  if previo.id is null then
    insert into productos (codigo, nombre, marca, por100, porcion, fuente, indice, creado_por)
    values (v_codigo, v_nombre, v_marca, jsonb_build_object('kcal', round(kcal), 'p', p, 'c', c, 'g', g), p_porcion, v_fuente,
            texto_indice(v_nombre || ' ' || v_marca), yo)
    returning * into previo;
    insert into productos_usos (producto_id, usuario_id) values (previo.id, yo) on conflict do nothing;
  else
    insert into productos_usos (producto_id, usuario_id) values (previo.id, yo) on conflict do nothing;
    get diagnostics nuevo_uso = row_count;
    -- Los valores solo se corrigen si lo habia cargado una sola persona a mano y llega algo mas confiable.
    update productos set
      veces = veces + 1,
      usuarios = usuarios + case when nuevo_uso then 1 else 0 end,
      por100 = case when previo.fuente = 'usuario' and v_fuente <> 'usuario' and previo.usuarios <= 1
                    then jsonb_build_object('kcal', round(kcal), 'p', p, 'c', c, 'g', g) else por100 end,
      fuente = case when previo.fuente = 'usuario' and v_fuente <> 'usuario' and previo.usuarios <= 1 then v_fuente else productos.fuente end,
      porcion = coalesce(productos.porcion, p_porcion),
      actualizado_en = now()
    where id = previo.id
    returning * into previo;
  end if;
  return next previo;
end;
$$;
revoke all on function public.guardar_producto(text, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.guardar_producto(text, text, text, jsonb, jsonb, text) to authenticated;

-- 3. Buscar por nombre o marca: primero los que tienen todas las palabras, despues los mas usados.
create or replace function public.buscar_productos(p_texto text)
returns table (id uuid, codigo text, nombre text, marca text, por100 jsonb, porcion jsonb, fuente text, veces integer, usuarios integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with palabras as (
    select w from unnest(string_to_array(texto_indice(p_texto), ' ')) as w
    where char_length(w) >= 2 and w not in ('de', 'del', 'con', 'sin', 'la', 'el', 'en')
  )
  select pr.id, pr.codigo, pr.nombre, pr.marca, pr.por100, pr.porcion, pr.fuente, pr.veces, pr.usuarios
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

select 'Listo: catalogo de productos compartido (' || count(*) || ' productos).' as resultado from public.productos;
