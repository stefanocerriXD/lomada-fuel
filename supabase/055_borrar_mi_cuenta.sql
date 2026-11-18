-- 055: borrar mi cuenta (lo pide el App Store y la ley de datos personales).
-- Borra la cuenta y TODO lo de la persona: comidas, chat, pesos, registros, avisos, etc. (todo cuelga de su perfil y se borra en cascada).
-- Las fotos las borra la app antes de llamar a esta funcion (cada uno puede borrar su carpeta).
-- Los grupos que creo pasan al integrante mas antiguo que quede. Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

create or replace function public.borrar_mi_cuenta(p_confirmacion text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  yo uuid := auth.uid();
  v_usuario text;
begin
  if yo is null then
    raise exception 'sin_sesion';
  end if;
  -- El duenio de la app no se puede borrar desde la app (se perderia el panel).
  if exists (select 1 from public.dueno_app where usuario_id = yo) then
    raise exception 'es_dueno';
  end if;
  -- La app primero llama sin confirmar para saber que esta todo listo antes de borrar las fotos.
  if p_confirmacion is distinct from 'BORRAR' then
    raise exception 'falta_confirmar';
  end if;

  select usuario into v_usuario from public.perfiles where id = yo;

  -- Los grupos que creo quedan a cargo del integrante mas antiguo (si no queda nadie, sin admin).
  update public.grupos g
     set creado_por = (
       select m.usuario_id from public.miembros_grupo m
        where m.grupo_id = g.id and m.usuario_id <> yo
        order by m.unido_en, m.usuario_id
        limit 1)
   where g.creado_por = yo;

  -- Lo que no cuelga del perfil.
  if v_usuario is not null then
    delete from public.intentos_ingreso where lower(usuario) = lower(v_usuario);
  end if;
  delete from public.uso_avisos where clave like '%' || yo::text || '%';

  -- La cuenta: arrastra el perfil y todo lo demas.
  delete from auth.users where id = yo;
  return 'ok';
end;
$$;
revoke all on function public.borrar_mi_cuenta(text) from public, anon;
grant execute on function public.borrar_mi_cuenta(text) to authenticated;

select 'Listo: ya se puede borrar la cuenta desde Ajustes.' as resultado;
