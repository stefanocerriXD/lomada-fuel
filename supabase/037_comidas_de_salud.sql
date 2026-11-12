-- 037: las comidas que llegan de Apple Salud una por una (MyFitnessPal u otra app que escriba en Salud).
-- El Atajo manda cada entrada con su hora; al tocar + en Lomada aparecen para precargarlas y solo sumar la foto.

do $$
begin
  if to_regclass('public.tokens_salud') is null then
    raise exception 'Falta correr antes el SQL de Apple Salud (007_importar_y_salud.sql)';
  end if;
end $$;

create table if not exists public.salud_comidas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  momento timestamptz not null,
  kcal integer not null default 0,
  proteinas numeric not null default 0,
  carbohidratos numeric not null default 0,
  grasas numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, momento)
);
create index if not exists salud_comidas_dia on public.salud_comidas (usuario_id, fecha);

-- Cada uno ve solo las suyas. Se escriben solo por la funcion del Atajo.
alter table public.salud_comidas enable row level security;
revoke all on public.salud_comidas from anon, authenticated;
grant select on public.salud_comidas to authenticated;
drop policy if exists "salud_comidas: ver propias" on public.salud_comidas;
create policy "salud_comidas: ver propias" on public.salud_comidas for select to authenticated using (usuario_id = auth.uid());

-- Lo llama el Atajo del iPhone a traves de /api/salud: [{momento, kcal, p, c, g}, ...]
create or replace function public.registrar_comidas_salud(p_token text, p_entradas jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  e jsonb;
  m timestamptz;
  dia date;
  kcal integer;
  prote numeric;
  carbos numeric;
  grasa numeric;
  n integer := 0;
  dias date[] := '{}';
  momentos timestamptz[] := '{}';
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;
  if p_entradas is null or jsonb_typeof(p_entradas) <> 'array' or jsonb_array_length(p_entradas) > 80 then
    raise exception 'valores_invalidos';
  end if;

  for e in select * from jsonb_array_elements(p_entradas) loop
    m := (e->>'momento')::timestamptz;
    dia := (m at time zone 'America/Argentina/Buenos_Aires')::date;
    continue when dia not between hoy - 14 and hoy + 1;
    kcal := round(coalesce((e->>'kcal')::numeric, 0));
    prote := round(coalesce((e->>'p')::numeric, 0), 1);
    carbos := round(coalesce((e->>'c')::numeric, 0), 1);
    grasa := round(coalesce((e->>'g')::numeric, 0), 1);
    if kcal not between 0 and 20000 or prote not between 0 and 2000 or carbos not between 0 and 3000 or grasa not between 0 and 1000 then
      raise exception 'valores_invalidos';
    end if;
    continue when kcal = 0 and prote = 0 and carbos = 0 and grasa = 0;

    insert into salud_comidas (usuario_id, fecha, momento, kcal, proteinas, carbohidratos, grasas)
    values (dueno, dia, m, kcal, prote, carbos, grasa)
    on conflict (usuario_id, momento) do update set
      fecha = excluded.fecha,
      kcal = excluded.kcal,
      proteinas = excluded.proteinas,
      carbohidratos = excluded.carbohidratos,
      grasas = excluded.grasas,
      actualizado_en = now();
    dias := dias || dia;
    momentos := momentos || m;
    n := n + 1;
  end loop;

  -- Lo que se borro en la otra app desaparece: los dias que llegaron quedan tal como llegaron.
  delete from salud_comidas
  where usuario_id = dueno and fecha = any(dias) and not (momento = any(momentos));

  return n;
end;
$$;

revoke all on function public.registrar_comidas_salud(text, jsonb) from public;
grant execute on function public.registrar_comidas_salud(text, jsonb) to anon;

select 'Listo: comidas de Apple Salud activadas.' as resultado;
