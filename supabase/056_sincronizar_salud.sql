-- 056: Apple Salud sincroniza dia por dia.
-- El Atajo manda las comidas sueltas de los ultimos 7 dias. Antes el total del dia salia de una lista de totales
-- y se tomaba el ultimo valor como "hoy": si hoy quedaba vacio (por ejemplo, pasaste la cena a ayer en MyFitnessPal),
-- el total de ayer se guardaba como de hoy, y ayer no se actualizaba.
-- Ahora, para cada dia de la ventana: las comidas sueltas quedan tal como estan en Apple Salud (lo borrado o movido
-- se borra o se mueve) y el total del dia es la suma de esas comidas. Un dia que quedo vacio pierde su total.
-- Solo toca el total que puso Apple Salud: un resumen importado a mano no se pisa.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

create or replace function public.sincronizar_salud(p_token text, p_entradas jsonb, p_desde date, p_hasta date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  e jsonb;
  m timestamptz;
  v_dia date;
  kcal integer;
  prote numeric;
  carbos numeric;
  grasa numeric;
  momentos timestamptz[] := '{}';
  v_privada boolean;
  t record;
  resultado jsonb := '{}';
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta > hoy + 1 or p_desde < hoy - 14 then
    raise exception 'fecha_invalida';
  end if;
  if p_entradas is null or jsonb_typeof(p_entradas) <> 'array' or jsonb_array_length(p_entradas) > 300 then
    raise exception 'valores_invalidos';
  end if;

  -- 1. Las comidas sueltas de la ventana, como estan en Apple Salud.
  for e in select * from jsonb_array_elements(p_entradas) loop
    m := (e->>'momento')::timestamptz;
    v_dia := (m at time zone 'America/Argentina/Buenos_Aires')::date;
    continue when v_dia not between p_desde and p_hasta;
    kcal := round(coalesce((e->>'kcal')::numeric, 0));
    prote := round(coalesce((e->>'p')::numeric, 0), 1);
    carbos := round(coalesce((e->>'c')::numeric, 0), 1);
    grasa := round(coalesce((e->>'g')::numeric, 0), 1);
    if kcal not between 0 and 20000 or prote not between 0 and 2000 or carbos not between 0 and 3000 or grasa not between 0 and 1000 then
      raise exception 'valores_invalidos';
    end if;
    continue when kcal = 0 and prote = 0 and carbos = 0 and grasa = 0;

    insert into salud_comidas (usuario_id, fecha, momento, kcal, proteinas, carbohidratos, grasas)
    values (dueno, v_dia, m, kcal, prote, carbos, grasa)
    on conflict (usuario_id, momento) do update set
      fecha = excluded.fecha,
      kcal = excluded.kcal,
      proteinas = excluded.proteinas,
      carbohidratos = excluded.carbohidratos,
      grasas = excluded.grasas,
      actualizado_en = now();
    momentos := momentos || m;
  end loop;

  -- Lo que ya no esta en Apple Salud (borrado o pasado a otro dia) se va.
  delete from salud_comidas
  where usuario_id = dueno and fecha between p_desde and p_hasta and not (momento = any(momentos));

  -- 2. El total de cada dia: la suma de sus comidas.
  select comidas_privadas into v_privada from perfiles where id = dueno;
  for v_dia in select generate_series(p_desde, p_hasta, interval '1 day')::date loop
    select coalesce(sum(s.kcal), 0)::integer as k, coalesce(sum(s.proteinas), 0) as p, coalesce(sum(s.carbohidratos), 0) as c, coalesce(sum(s.grasas), 0) as g
      into t from salud_comidas s where s.usuario_id = dueno and s.fecha = v_dia;
    if t.k > 0 or t.p > 0 or t.c > 0 or t.g > 0 then
      insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, proteinas, carbohidratos, grasas, alimentos, privada)
      values (dueno, 'resumen', v_dia, 'Resumen de Apple Salud', t.k, round(t.p, 1), round(t.c, 1), round(t.g, 1),
        jsonb_build_array(jsonb_build_object('nombre', 'Apple Salud', 'fuente', 'importado', 'kcal', t.k, 'p', round(t.p, 1), 'c', round(t.c, 1), 'g', round(t.g, 1))),
        coalesce(v_privada, false))
      on conflict (usuario_id, fecha) where tipo = 'resumen' do update set
        calorias = excluded.calorias,
        proteinas = excluded.proteinas,
        carbohidratos = excluded.carbohidratos,
        grasas = excluded.grasas,
        alimentos = excluded.alimentos
      where comidas.descripcion = 'Resumen de Apple Salud';
    else
      delete from comidas
      where usuario_id = dueno and fecha = v_dia and tipo = 'resumen' and descripcion = 'Resumen de Apple Salud';
    end if;
    resultado := resultado || jsonb_build_object(v_dia::text, t.k);
  end loop;

  return resultado;
end;
$$;
revoke all on function public.sincronizar_salud(text, jsonb, date, date) from public;
grant execute on function public.sincronizar_salud(text, jsonb, date, date) to anon;

select 'Listo: Apple Salud sincroniza dia por dia.' as resultado;
