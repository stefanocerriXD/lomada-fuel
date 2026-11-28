-- 072: cada grupo tiene su Bocha. Por defecto es un dibujo (viene con la app); quien administra el grupo puede
-- subir su propia imagen (y la del Bocha Evo), cambiarla cuando quiera o volver al dibujo.
-- La Lomada se queda con las imagenes que ya tenia. Las de antes (ajustes_grupo) quedan, pero ya no se usan.
-- Ejecutar en el SQL Editor de Supabase, despues de 071. Se puede correr mas de una vez.

alter table public.grupos add column if not exists bocha_path text;
alter table public.grupos add column if not exists bocha_evo_path text;

-- La Lomada conserva las suyas.
update public.grupos g set
  bocha_path = coalesce(g.bocha_path, (select valor from public.ajustes_grupo where clave = 'bocha')),
  bocha_evo_path = coalesce(g.bocha_evo_path, (select valor from public.ajustes_grupo where clave = 'bocha_evo'))
where g.id = '00000000-0000-4000-8000-00000000a001';

-- Quien puede cambiarlas: quien creo el grupo, y en la Lomada (que no tiene creador) los admins de siempre.
create or replace function public.puede_cambiar_bocha(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_grupo is not null and (
    public.admin_de_grupo(p_grupo)
    or public.es_dueno()
    or (public.es_admin() and exists (select 1 from grupos where id = p_grupo and creado_por is null))
  );
$$;
revoke all on function public.puede_cambiar_bocha(uuid) from public, anon, authenticated;

-- Las del grupo que estoy mirando (null: el dibujo) y si las puedo cambiar.
create or replace function public.imagenes_bocha()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('dia', g.bocha_path, 'evo', g.bocha_evo_path, 'puede', public.puede_cambiar_bocha(g.id))
  from grupos g where g.id = public.mi_grupo();
$$;
revoke all on function public.imagenes_bocha() from public, anon;
grant execute on function public.imagenes_bocha() to authenticated;

-- Guardar una (subida antes a la carpeta bocha propia) o volver al dibujo (ruta null).
create or replace function public.guardar_bocha_grupo(p_clave text, p_ruta text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  grupo uuid := public.mi_grupo();
begin
  if not public.puede_cambiar_bocha(grupo) then raise exception 'solo_admin'; end if;
  if p_clave not in ('bocha', 'bocha_evo') then raise exception 'clave_invalida'; end if;
  if p_ruta is not null and p_ruta not like auth.uid()::text || '/bocha/%' then raise exception 'ruta_invalida'; end if;
  if p_clave = 'bocha' then
    update grupos set bocha_path = p_ruta where id = grupo;
  else
    update grupos set bocha_evo_path = p_ruta where id = grupo;
  end if;
end;
$$;
revoke all on function public.guardar_bocha_grupo(text, text) from public, anon;
grant execute on function public.guardar_bocha_grupo(text, text) to authenticated;

select 'Listo: cada grupo con su Bocha.' as resultado;
