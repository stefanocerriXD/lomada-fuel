-- 050: tope de usos de IA (Gemini) por persona y por dia, asi nadie se gasta solo el cupo gratis de todos.
-- Cuenta las fotos reconocidas, el dictado, las etiquetas, las ideas de comidas y las capturas del Atajo.
-- Solo se cuenta cuando la IA respondio bien. El duenio de la app no tiene tope.
-- Ejecutar en el SQL Editor de Supabase, despues de 048. Se puede correr mas de una vez.

do $$
begin
  if to_regclass('public.dueno_app') is null then
    raise exception 'Falta correr antes el SQL 048_dueno_mejoras_y_avisos.sql';
  end if;
end $$;

create table if not exists public.uso_ia (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  usos integer not null default 0,
  primary key (usuario_id, fecha)
);
alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;
-- Cada uno puede ver cuanto uso (solo leer: se escribe con las funciones de abajo).
grant select on public.uso_ia to authenticated;
drop policy if exists "uso_ia: propio" on public.uso_ia;
create policy "uso_ia: propio" on public.uso_ia for select to authenticated using (usuario_id = auth.uid());

-- Cuantos usos por dia tiene cada uno.
create or replace function public.tope_ia()
returns integer
language sql
immutable
as $$ select 25 $$;

-- Mira (p_sumar = false) o suma un uso (p_sumar = true) para esa persona, hoy.
create or replace function public.uso_ia_de(p_usuario uuid, p_sumar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  tope integer := public.tope_ia();
  sin_tope boolean := exists (select 1 from dueno_app where usuario_id = p_usuario);
  n integer;
begin
  if p_sumar then
    insert into uso_ia (usuario_id, fecha, usos) values (p_usuario, hoy, 1)
    on conflict (usuario_id, fecha) do update set usos = uso_ia.usos + 1
    returning usos into n;
    -- De paso se limpian los dias viejos.
    delete from uso_ia where usuario_id = p_usuario and fecha < hoy - 60;
  else
    select usos into n from uso_ia where usuario_id = p_usuario and fecha = hoy;
  end if;
  n := coalesce(n, 0);
  return jsonb_build_object(
    'permitido', sin_tope or n < tope,
    'usos', n,
    'tope', case when sin_tope then null else tope end,
    'quedan', case when sin_tope then null else greatest(tope - n, 0) end
  );
end;
$$;
revoke all on function public.uso_ia_de(uuid, boolean) from public, anon, authenticated;

-- Desde la API, con la sesion de la persona.
create or replace function public.usar_ia(p_sumar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion'; end if;
  return public.uso_ia_de(auth.uid(), p_sumar);
end;
$$;
revoke all on function public.usar_ia(boolean) from public, anon;
grant execute on function public.usar_ia(boolean) to authenticated;

-- Desde el Atajo del iPhone (captura de MyFitnessPal), con la llave de Apple Salud.
create or replace function public.usar_ia_con_llave(p_token text, p_sumar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;
  return public.uso_ia_de(dueno, p_sumar);
end;
$$;
revoke all on function public.usar_ia_con_llave(text, boolean) from public;
grant execute on function public.usar_ia_con_llave(text, boolean) to anon, authenticated;

select 'Listo: tope de ' || public.tope_ia() || ' usos de IA por persona por dia.' as resultado;
