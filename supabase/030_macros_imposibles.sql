-- Arregla comidas importadas con un macro imposible para sus calorías (por ejemplo "C 71g" leído como 713 g).
-- Igual que la app: se prueba sin el último dígito o con la coma perdida; si sigue sin cerrar, queda en lo que sobra de calorías.
-- Solo toca lo que no cierra; lo que cada uno editó a mano (macros_editados) no se modifica.
-- Ejecutar en el SQL Editor de Supabase, después de 029_fiesta.sql.

create or replace function pg_temp.macros_posibles(m jsonb, kcal numeric) returns jsonb
language plpgsql as $$
declare
  r jsonb := m;
  vuelta int;
  peor text;
  valor numeric;
  factor numeric;
  libre numeric;
  margen numeric := greatest(25, kcal * 0.25);
  a numeric;
  b numeric;
  elegido numeric;
  total numeric;
begin
  if kcal is null or kcal < 20 then return m; end if;
  for vuelta in 1..3 loop
    total := coalesce((r->>'p')::numeric, 0) * 4 + coalesce((r->>'c')::numeric, 0) * 4 + coalesce((r->>'g')::numeric, 0) * 9;
    exit when total <= kcal + margen;
    select k into peor from (values
      ('p', coalesce((r->>'p')::numeric, 0) * 4),
      ('c', coalesce((r->>'c')::numeric, 0) * 4),
      ('g', coalesce((r->>'g')::numeric, 0) * 9)) x(k, aporte)
    order by aporte desc limit 1;
    factor := case when peor = 'g' then 9 else 4 end;
    valor := coalesce((r->>peor)::numeric, 0);
    libre := greatest(0, (kcal - (total - valor * factor)) / factor);
    a := floor(valor / 10);
    b := valor / 10;
    elegido := null;
    if a * factor <= libre * factor + margen then elegido := a; end if;
    if b * factor <= libre * factor + margen and (elegido is null or abs(b - libre) < abs(elegido - libre)) then elegido := b; end if;
    r := jsonb_set(r, array[peor], to_jsonb(round(coalesce(elegido, libre), 1)));
  end loop;
  return r;
end $$;

-- Cada alimento de la lista (los que tienen valores cada 100 g se revisan sobre esos valores).
create or replace function pg_temp.alimento_posible(x jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb := x;
begin
  if jsonb_typeof(x->'por100') = 'object' then
    r := jsonb_set(r, '{por100}', (x->'por100') || pg_temp.macros_posibles(x->'por100', (x->'por100'->>'kcal')::numeric));
  end if;
  if x ? 'kcal' then
    r := r || jsonb_strip_nulls(pg_temp.macros_posibles(jsonb_strip_nulls(jsonb_build_object('p', x->'p', 'c', x->'c', 'g', x->'g')), (x->>'kcal')::numeric));
  end if;
  return r;
end $$;

with arreglo as (
  select id,
    pg_temp.macros_posibles(jsonb_build_object('p', coalesce(proteinas, 0), 'c', coalesce(carbohidratos, 0), 'g', coalesce(grasas, 0)), calorias) as m,
    (select coalesce(jsonb_agg(pg_temp.alimento_posible(x)), '[]'::jsonb) from jsonb_array_elements(alimentos) x) as lista
  from public.comidas
  where calorias >= 20
    and macros_editados is not true
    and coalesce(proteinas, 0) * 4 + coalesce(carbohidratos, 0) * 4 + coalesce(grasas, 0) * 9 > calorias + greatest(25, calorias * 0.25)
)
update public.comidas c
set proteinas = (a.m->>'p')::numeric,
    carbohidratos = (a.m->>'c')::numeric,
    grasas = (a.m->>'g')::numeric,
    alimentos = a.lista
from arreglo a
where c.id = a.id
returning c.fecha, c.tipo, c.calorias, c.proteinas, c.carbohidratos, c.grasas;
