-- 039: cada uno puede eliminar sus mensajes del chat hasta 4 horas despues de mandarlos.
-- El mensaje queda en su lugar como "Mensaje eliminado": se borra el texto, la foto o el audio y las reacciones.

alter table public.mensajes add column if not exists eliminado_en timestamptz;

-- Un mensaje eliminado queda sin texto: se permite.
alter table public.mensajes drop constraint if exists mensajes_texto_check;
alter table public.mensajes add constraint mensajes_texto_check
  check (char_length(texto) <= 1000 and (char_length(texto) >= 1 or adjunto_path is not null or sticker is not null or usuario_id is null or eliminado_en is not null));

-- Devuelve la ruta de la foto o el audio que tenia, para borrar el archivo desde la app.
create or replace function public.eliminar_mensaje(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  adjunto text;
begin
  select adjunto_path into adjunto
  from mensajes
  where id = p_id
    and usuario_id = auth.uid()
    and eliminado_en is null
    and creado_en > now() - interval '4 hours'
  for update;
  if not found then
    raise exception 'no_se_puede_eliminar';
  end if;

  update mensajes
  set texto = '', adjunto_path = null, sticker = null, receta_id = null,
      respuesta_comida = null, respuesta_mensaje = null, eliminado_en = now()
  where id = p_id;
  delete from reacciones_mensajes where mensaje_id = p_id;
  return adjunto;
end;
$$;

revoke all on function public.eliminar_mensaje(uuid) from public;
grant execute on function public.eliminar_mensaje(uuid) to authenticated;

-- Reacciones a las comidas: ya no solo las 5 de antes (se suman el vomito y la bandera multicolor).
alter table public.reacciones drop constraint if exists reacciones_emoji_check;
alter table public.reacciones add constraint reacciones_emoji_check check (char_length(emoji) between 1 and 16);

select 'Listo: ya se pueden eliminar mensajes hasta 4 horas despues.' as resultado;
