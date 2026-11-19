-- 057: tus comidas de Lomada pasan a Apple Salud (asi las toma WHOOP).
-- Un Atajo del iPhone llama a /api/para-salud con la llave de Apple Salud y registra en Salud cada comida nueva.
-- Cada comida se manda UNA sola vez (los Atajos no pueden borrar de Salud: repetir seria sumar de mas).
-- No se mandan: el total de Apple Salud, lo que vino de Apple Salud o se importo de otra app (eso ya esta en Salud).
-- Lo que mando Lomada vuelve con el Atajo de MyFitnessPal: sincronizar_salud lo saltea.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

-- 1. Lo que ya se mando.
create table if not exists public.salud_exportadas (
  comida_id uuid primary key references public.comidas(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  momento timestamptz not null,
  kcal integer not null default 0,
  exportado_en timestamptz not null default now()
);
create index if not exists salud_exportadas_usuario on public.salud_exportadas (usuario_id, momento);
alter table public.salud_exportadas enable row level security;
revoke all on public.salud_exportadas from anon, authenticated;
grant select on public.salud_exportadas to authenticated;
drop policy if exists "salud_exportadas: ver propias" on public.salud_exportadas;
create policy "salud_exportadas: ver propias" on public.salud_exportadas for select to authenticated using (usuario_id = auth.uid());

-- 2. Las comidas para Salud: las nuevas de hoy (y de ayer, si ya se venia mandando), con su hora.
create or replace function public.comidas_para_salud(p_token text, p_marcar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_primera date;
  v_desde date;
  c record;
  v_momento timestamptz;
  resultado jsonb := '[]';
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;

  -- La primera vez solo hoy (lo de antes ya pudo haber entrado por MyFitnessPal); despues, tambien lo que quedo de ayer.
  select min(fecha) into v_primera from salud_exportadas where usuario_id = dueno;
  v_desde := case when v_primera is null then hoy else greatest(v_primera, hoy - 1) end;

  for c in
    select co.* from comidas co
    where co.usuario_id = dueno
      and co.fecha between v_desde and hoy
      and co.tipo <> 'resumen'
      and coalesce(co.calorias, 0) > 0
      and not exists (select 1 from salud_exportadas x where x.comida_id = co.id)
      -- Lo que vino de Apple Salud o se importo de otra app ya esta en Salud.
      and not exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(co.alimentos) = 'array' then co.alimentos else '[]'::jsonb end) a
        where a ? 'salud_id' or a->>'fuente' = 'importado'
      )
    order by co.fecha, co.creado_en
  loop
    -- La hora: cuando se cargo, si fue ese mismo dia; si no, una hora tipica de esa comida.
    if (c.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = c.fecha then
      v_momento := date_trunc('minute', c.creado_en);
    else
      v_momento := ((c.fecha + case c.tipo
        when 'desayuno' then time '09:00' when 'almuerzo' then time '13:30' when 'merienda' then time '17:30'
        when 'cena' then time '21:30' when 'fiesta' then time '23:30' else time '11:00' end) at time zone 'America/Argentina/Buenos_Aires');
    end if;
    resultado := resultado || jsonb_build_object(
      'nombre', coalesce(nullif(c.descripcion, ''), initcap(c.tipo)),
      'fecha', to_char(v_momento at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00',
      'kcal', round(coalesce(c.calorias, 0)),
      'proteinas', round(coalesce(c.proteinas, 0), 1),
      'carbohidratos', round(coalesce(c.carbohidratos, 0), 1),
      'grasas', round(coalesce(c.grasas, 0), 1));
    if p_marcar then
      insert into salud_exportadas (comida_id, usuario_id, fecha, momento, kcal)
      values (c.id, dueno, c.fecha, v_momento, round(coalesce(c.calorias, 0)))
      on conflict (comida_id) do nothing;
    end if;
  end loop;
  return resultado;
end;
$$;
revoke all on function public.comidas_para_salud(text, boolean) from public;
grant execute on function public.comidas_para_salud(text, boolean) to anon;

-- 3. sincronizar_salud (056) saltea lo que mando Lomada.
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
    -- Lo que mando Lomada a Salud (057) vuelve con el Atajo: no se cuenta como "llego de Apple Salud".
    continue when exists (select 1 from salud_exportadas x where x.usuario_id = dueno and x.momento = date_trunc('minute', m));

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

revoke all on function public.sincronizar_salud(text, jsonb, date, date) from public;
grant execute on function public.sincronizar_salud(text, jsonb, date, date) to anon;

select 'Listo: tus comidas de Lomada pueden pasar a Apple Salud.' as resultado;
