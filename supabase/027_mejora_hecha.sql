-- Cuando quien administra marca una mejora como hecha, le llega un aviso a quien la pidió.
-- Ejecutar en el SQL Editor de Supabase, después de 026_la_caca.sql.
create or replace function public.aviso_mejora_hecha(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  pedido mejoras;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if not public.es_admin() then return null; end if;
  select * into pedido from mejoras where id = p_id and hecha;
  -- Si la pidió quien administra, no hace falta avisarse a uno mismo.
  if not found or pedido.usuario_id = yo then return null; end if;

  return jsonb_build_object(
    'titulo', 'Tu pedido ya está en la app ✅',
    'cuerpo', left(pedido.texto, 120),
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id = pedido.usuario_id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.aviso_mejora_hecha(uuid) from public, anon;
grant execute on function public.aviso_mejora_hecha(uuid) to authenticated;
