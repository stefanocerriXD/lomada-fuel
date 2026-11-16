-- 044: cuando una mejora se marca como hecha, le avisa a quien la pidio.
-- Ahora sale desde la base: se marque desde la app o desde el SQL Editor, el aviso llega igual.

-- 1. A quien avisar y que decirle. La llama /api/recordatorio con la clave del reloj.
create or replace function public.destinos_mejora_hecha(p_clave text, p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  pedido mejoras;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'mejora_hecha' then return null; end if;
  select * into pedido from mejoras where id = p_id and hecha;
  if not found then return null; end if;

  return jsonb_build_object(
    'titulo', U&'\2705 Ya est\00E1 tu mejora en la app',
    'cuerpo', left(pedido.texto, 120),
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id = pedido.usuario_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.destinos_mejora_hecha(text, text, uuid) from public;
grant execute on function public.destinos_mejora_hecha(text, text, uuid) to anon;

-- 2. Al pasar a hecha, pide el aviso con el mismo pedido que usa el recordatorio de las 21.
create or replace function public.avisar_mejora_hecha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pedido text;
begin
  if new.hecha and not coalesce(old.hecha, false) and new.usuario_id is distinct from auth.uid() then
    select command into pedido from cron.job where jobname = 'lomada-recordatorio';
    if pedido is not null then
      execute replace(pedido, '{"tipo":"recordatorio"}', format('{"tipo":"mejora_hecha","id":"%s"}', new.id));
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.avisar_mejora_hecha() from public, anon, authenticated;

drop trigger if exists mejora_hecha_aviso on public.mejoras;
create trigger mejora_hecha_aviso
  after update of hecha on public.mejoras
  for each row execute function public.avisar_mejora_hecha();

-- 3. La app ya no lo manda (lo manda la base): asi no llega dos veces.
create or replace function public.aviso_mejora_hecha(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return null;
end;
$$;

select 'Listo: la mejora hecha avisa desde la base.' as resultado;
