-- Notificaciones de fotos, mensajes y comentarios.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 007_importar_y_salud.sql.

-- Arma el aviso a partir de lo guardado, para que nadie pueda inventar notificaciones.
create or replace function public.destinos_aviso(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  titulo text;
  cuerpo text;
  creado timestamptz;
  solo_para uuid;
  privada_c boolean;
  con_foto boolean;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre into autor from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select texto, creado_en into cuerpo, creado from mensajes where id = p_id and usuario_id = yo;
    titulo := autor;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null into cuerpo, creado, privada_c, con_foto
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    titulo := autor || case when con_foto then ' subió una foto' else ' subió una comida' end;
  elsif p_tipo = 'comentario' then
    select k.texto, k.creado_en, c.usuario_id, c.privada into cuerpo, creado, solo_para, privada_c
    from comentarios k join comidas c on c.id = k.comida_id
    where k.id = p_id and k.usuario_id = yo;
    if privada_c or solo_para = yo then return null; end if;
    titulo := autor || ' comentó tu comida';
  else
    raise exception 'tipo_invalido';
  end if;

  -- Solo se avisa algo recién creado por quien lo pide.
  if creado is null or creado < now() - interval '2 minutes' then return null; end if;

  return jsonb_build_object(
    'titulo', titulo,
    'cuerpo', left(coalesce(cuerpo, 'Mirá qué comió'), 120),
    'vista', 'chat',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
    ), '[]'::jsonb)
  );
end;
$$;

-- Limpia los dispositivos que el navegador informó como dados de baja.
create or replace function public.borrar_suscripciones(p_endpoints text[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from suscripciones_push where auth.uid() is not null and endpoint = any(p_endpoints);
$$;

revoke all on function public.destinos_aviso(text, uuid), public.borrar_suscripciones(text[]) from public;
grant execute on function public.destinos_aviso(text, uuid), public.borrar_suscripciones(text[]) to authenticated;
