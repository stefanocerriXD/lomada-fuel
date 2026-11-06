-- Resúmenes importados de otras apps y datos que llegan desde Apple Salud.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 006_usuarios_y_codigo.sql.

-- Un resumen del día se guarda como una comida especial: suma al total, pero no aparece en el muro.
alter table public.comidas drop constraint if exists comidas_tipo_check;
alter table public.comidas add constraint comidas_tipo_check
  check (tipo in ('desayuno', 'almuerzo', 'merienda', 'cena', 'resumen'));
create unique index if not exists comidas_resumen_dia on public.comidas (usuario_id, fecha) where tipo = 'resumen';

-- Cada persona tiene una llave personal para su Atajo del iPhone. Se guarda solo su huella.
create table if not exists public.tokens_salud (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  token_hash text not null unique,
  creado_en timestamptz not null default now()
);

alter table public.tokens_salud enable row level security;
revoke all on public.tokens_salud from anon, authenticated;
grant select (usuario_id, creado_en), delete on public.tokens_salud to authenticated;
create policy "tokens: ver propio" on public.tokens_salud for select to authenticated using (usuario_id = auth.uid());
create policy "tokens: borrar propio" on public.tokens_salud for delete to authenticated using (usuario_id = auth.uid());

create or replace function public.crear_token_salud()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  token text := encode(gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  insert into tokens_salud (usuario_id, token_hash)
  values (auth.uid(), encode(digest(token, 'sha256'), 'hex'))
  on conflict (usuario_id) do update set token_hash = excluded.token_hash, creado_en = now();
  return token;
end;
$$;

-- Lo llama el Atajo del iPhone, a través de /api/salud.
create or replace function public.registrar_salud(
  p_token text,
  p_fecha date,
  p_calorias numeric default null,
  p_proteinas numeric default null,
  p_carbohidratos numeric default null,
  p_grasas numeric default null,
  p_peso numeric default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  kcal integer := round(coalesce(p_calorias, 0));
  prote numeric := round(coalesce(p_proteinas, 0), 1);
  carbos numeric := round(coalesce(p_carbohidratos, 0), 1);
  grasa numeric := round(coalesce(p_grasas, 0), 1);
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;
  if p_fecha is null or p_fecha > hoy + 1 or p_fecha < hoy - 14 then raise exception 'fecha_invalida'; end if;
  if kcal not between 0 and 20000 or prote not between 0 and 2000 or carbos not between 0 and 3000 or grasa not between 0 and 1000 then
    raise exception 'valores_invalidos';
  end if;

  if kcal > 0 or prote > 0 or carbos > 0 or grasa > 0 then
    insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, proteinas, carbohidratos, grasas, alimentos, privada)
    select dueno, 'resumen', p_fecha, 'Resumen de Apple Salud', kcal, prote, carbos, grasa,
      jsonb_build_array(jsonb_build_object('nombre', 'Apple Salud', 'fuente', 'importado', 'kcal', kcal, 'p', prote, 'c', carbos, 'g', grasa)),
      p.comidas_privadas
    from perfiles p where p.id = dueno
    on conflict (usuario_id, fecha) where tipo = 'resumen' do update set
      descripcion = excluded.descripcion,
      calorias = excluded.calorias,
      proteinas = excluded.proteinas,
      carbohidratos = excluded.carbohidratos,
      grasas = excluded.grasas,
      alimentos = excluded.alimentos;
  end if;

  if p_peso between 30 and 300 then
    insert into pesos (usuario_id, fecha, peso_kg) values (dueno, p_fecha, round(p_peso, 1))
    on conflict (usuario_id, fecha) do update set peso_kg = excluded.peso_kg;
    update perfiles_salud set peso_kg = round(p_peso, 1)
    where usuario_id = dueno and p_fecha = (select max(fecha) from pesos where usuario_id = dueno);
  end if;

  return 'ok';
end;
$$;

revoke all on function public.crear_token_salud(), public.registrar_salud(text, date, numeric, numeric, numeric, numeric, numeric) from public;
grant execute on function public.crear_token_salud() to authenticated;
grant execute on function public.registrar_salud(text, date, numeric, numeric, numeric, numeric, numeric) to anon;
