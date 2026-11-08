-- El aviso del domingo con emojis. No cambia la hora ni la clave.
-- Ejecutar en el SQL Editor de Supabase, después de 016_match_day.sql.

create or replace function public.destinos_programados(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  todos jsonb;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]'::jsonb)
  into todos from suscripciones_push s;

  if p_tipo = 'recordatorio' then
    return jsonb_build_object(
      'titulo', 'Son las 21. ¿Cargaste todo?',
      'cuerpo', 'Subí tus comidas de hoy, gordito.',
      'vista', 'resumen',
      -- No se le avisa a quien ya cargó el día.
      'destinos', coalesce((
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from suscripciones_push s
        where not exists (select 1 from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy and c.tipo = 'resumen')
          and (select count(*) from comidas c where c.usuario_id = s.usuario_id and c.fecha = hoy) < 3
      ), '[]'::jsonb)
    );
  elsif p_tipo = 'semana' then
    if armar_resumen_semanal() is null then return null; end if;
    return jsonb_build_object('titulo', 'Salieron los podios de la semana', 'cuerpo', 'Mirá cómo quedó cada uno en el chat.', 'vista', 'chat', 'destinos', todos);
  elsif p_tipo = 'matchday' then
    return jsonb_build_object('titulo', '⚽ MATCH DAY 🔥', 'cuerpo', 'Día de guerra 💪 No te olvides de publicar tu CARB LOAD 🍝', 'vista', 'resumen', 'destinos', todos);
  end if;
  raise exception 'tipo_invalido';
end;
$$;

revoke all on function public.destinos_programados(text, text) from public;
grant execute on function public.destinos_programados(text, text) to anon;
