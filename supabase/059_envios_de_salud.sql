-- 059: lo que manda el Atajo de Apple Salud queda resumido (los ultimos 10 envios de cada uno).
-- Sirve para ver si un dia no llego (MyFitnessPal no lo paso a Salud) o llego y se leyo mal.
-- Se ve en Ajustes > Apple Salud > Lo que llego de Apple Salud. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.salud_envios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  resumen jsonb not null default '{}'
);
create index if not exists salud_envios_usuario on public.salud_envios (usuario_id, creado_en desc);
alter table public.salud_envios enable row level security;
revoke all on public.salud_envios from anon, authenticated;
grant select on public.salud_envios to authenticated;
drop policy if exists "salud_envios: ver propios" on public.salud_envios;
create policy "salud_envios: ver propios" on public.salud_envios for select to authenticated using (usuario_id = auth.uid());

create or replace function public.registrar_envio_salud(p_token text, p_resumen jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;
  if p_resumen is null or length(p_resumen::text) > 8000 then raise exception 'valores_invalidos'; end if;
  insert into salud_envios (usuario_id, resumen) values (dueno, p_resumen);
  delete from salud_envios where usuario_id = dueno and id not in (
    select id from salud_envios where usuario_id = dueno order by creado_en desc limit 10);
end;
$$;
revoke all on function public.registrar_envio_salud(text, jsonb) from public;
grant execute on function public.registrar_envio_salud(text, jsonb) to anon;

select 'Listo: se guardan los ultimos envios del Atajo de Apple Salud.' as resultado;
