-- 060: el duenio responde los pedidos de mejora (por ejemplo, "esto no se puede hacer porque...").
-- La respuesta queda abajo del pedido y a quien lo pidio le llega una notificacion.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

-- 1. La respuesta en cada pedido. "no_va": el pedido no se va a hacer (sale de los pendientes).
alter table public.mejoras add column if not exists respuesta text;
alter table public.mejoras add column if not exists respondida_en timestamptz;
alter table public.mejoras add column if not exists no_va boolean not null default false;

-- 2. Responder: solo el duenio. Sin texto y sin "no va", la respuesta se borra.
create or replace function public.responder_mejora(p_id uuid, p_respuesta text, p_no_va boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_texto text := nullif(btrim(coalesce(p_respuesta, '')), '');
begin
  if auth.uid() is null or not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  if char_length(coalesce(v_texto, '')) > 500 then raise exception 'texto_invalido'; end if;
  if coalesce(p_no_va, false) and v_texto is null then raise exception 'texto_invalido'; end if;
  update mejoras set
    respuesta = v_texto,
    no_va = coalesce(p_no_va, false),
    respondida_en = case when v_texto is null then null else now() end
  where id = p_id;
  if not found then raise exception 'sin_pedido'; end if;
end;
$$;
revoke all on function public.responder_mejora(uuid, text, boolean) from public, anon;
grant execute on function public.responder_mejora(uuid, text, boolean) to authenticated;

-- 3. El aviso a quien lo pidio (lo pide la app justo despues de responder).
create or replace function public.aviso_respuesta_mejora(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pedido mejoras;
begin
  if auth.uid() is null or not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  select * into pedido from mejoras
  where id = p_id and respuesta is not null and respondida_en > now() - interval '2 minutes';
  if not found or pedido.usuario_id = auth.uid() then return null; end if;
  return jsonb_build_object(
    'titulo', case when pedido.no_va
      then U&'Sobre tu pedido de mejora'
      else U&'\+01F4AC Te respondieron tu pedido de mejora' end,
    'cuerpo', left(pedido.respuesta, 160),
    'vista', 'mejoras',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id = pedido.usuario_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.aviso_respuesta_mejora(uuid) from public, anon;
grant execute on function public.aviso_respuesta_mejora(uuid) to authenticated;

-- 4. Va con las demas de mejoras: quien apago esas, no la recibe.
create or replace function public.categoria_aviso(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo = 'mensaje' then 'mensajes'
    when p_tipo in ('reaccion', 'reaccion_mensaje') then 'reacciones'
    when p_tipo in ('comida', 'postre') then 'comidas'
    when p_tipo in ('invitacion', 'salida') then 'invitaciones'
    when p_tipo = 'medalla' then 'logros'
    when p_tipo = 'recordatorio' then 'recordatorio'
    when p_tipo in ('caca', 'anuncio_caca') then 'caca'
    when p_tipo in ('registros', 'propios') then 'registros'
    when p_tipo = 'semana' then 'semana'
    when p_tipo = 'informe' then 'informe'
    when p_tipo in ('matchday', 'matchday_previa', 'viaje') then 'lomada'
    when p_tipo in ('mejora', 'mejora_hecha', 'mejora_respuesta') then 'mejoras'
    when p_tipo in ('solicitud_grupo', 'grupo_aceptado') then 'grupos'
    when p_tipo = 'anuncio' then 'anuncios'
    else null
  end;
$$;

select 'Listo: ya podes responder los pedidos de mejora.' as resultado;
