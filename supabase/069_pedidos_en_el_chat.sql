-- 069: los pedidos para entrar a un grupo aparecen en el chat de ese grupo.
-- "Fulano quiere unirse al grupo": quien administra lo acepta o lo rechaza ahi mismo (con la misma funcion de siempre,
-- responder_solicitud, que solo deja al admin). Al aceptarlo, el mensaje pasa a "Aceptado" y sale "Fulano se unio al grupo".
-- Si lo responden desde Ajustes o la persona cancela el pedido, el mensaje del chat tambien se actualiza.
-- Ejecutar en el SQL Editor de Supabase, despues de 068. Se puede correr mas de una vez.

alter table public.mensajes add column if not exists aviso_grupo text;
alter table public.mensajes add column if not exists solicitud_id uuid;
alter table public.mensajes add column if not exists solicitud_estado text;
alter table public.mensajes drop constraint if exists mensajes_aviso_grupo_check;
alter table public.mensajes add constraint mensajes_aviso_grupo_check check (aviso_grupo is null or aviso_grupo in ('pedido', 'unido'));
alter table public.mensajes drop constraint if exists mensajes_solicitud_estado_check;
alter table public.mensajes add constraint mensajes_solicitud_estado_check
  check (solicitud_estado is null or solicitud_estado in ('pendiente', 'aceptada', 'rechazada', 'cancelada'));
create index if not exists mensajes_solicitud on public.mensajes (solicitud_id) where solicitud_id is not null;

-- Los mensajes sin autor son del bot: ahora tambien estos avisos del grupo.
alter table public.mensajes drop constraint if exists mensajes_autor_o_bot;
alter table public.mensajes add constraint mensajes_autor_o_bot
  check (usuario_id is not null or bot_semana is not null or bot_multas is not null or aviso_grupo is not null);

-- Cada pedido, al chat del grupo; cada respuesta, al mismo mensaje.
create or replace function public.solicitud_al_chat()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  nombre text;
begin
  select coalesce(nullif(btrim(p.nombre), ''), 'Alguien') into nombre from perfiles p where p.id = coalesce(new.usuario_id, old.usuario_id);
  nombre := coalesce(nombre, 'Alguien');
  if tg_op = 'INSERT' then
    if new.estado = 'pendiente' then
      insert into mensajes (usuario_id, texto, grupo_id, aviso_grupo, solicitud_id, solicitud_estado)
      values (null, format('%s quiere unirse al grupo.', nombre), new.grupo_id, 'pedido', new.id, 'pendiente');
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.estado is distinct from old.estado then
      update mensajes set solicitud_estado = new.estado where solicitud_id = new.id and aviso_grupo = 'pedido';
      if new.estado = 'aceptada' then
        insert into mensajes (usuario_id, texto, grupo_id, aviso_grupo, solicitud_id)
        values (null, format(U&'%s se uni\00F3 al grupo.', nombre), new.grupo_id, 'unido', new.id);
      end if;
    end if;
    return new;
  end if;
  -- Borrado: si seguia esperando, es que lo cancelo.
  if old.estado = 'pendiente' then
    update mensajes set solicitud_estado = 'cancelada' where solicitud_id = old.id and aviso_grupo = 'pedido';
  end if;
  return old;
end;
$$;
revoke all on function public.solicitud_al_chat() from public, anon, authenticated;

drop trigger if exists solicitud_al_chat on public.solicitudes_grupo;
create trigger solicitud_al_chat after insert or update of estado or delete on public.solicitudes_grupo
  for each row execute function public.solicitud_al_chat();

-- Los pedidos que ya estaban esperando tambien aparecen en el chat.
insert into public.mensajes (usuario_id, texto, grupo_id, aviso_grupo, solicitud_id, solicitud_estado, creado_en)
select null, format('%s quiere unirse al grupo.', coalesce(nullif(btrim(p.nombre), ''), 'Alguien')), s.grupo_id, 'pedido', s.id, 'pendiente', s.creado_en
from public.solicitudes_grupo s
join public.perfiles p on p.id = s.usuario_id
where s.estado = 'pendiente'
  and not exists (select 1 from public.mensajes m where m.solicitud_id = s.id);

select 'Listo: los pedidos para entrar aparecen en el chat.' as resultado;
