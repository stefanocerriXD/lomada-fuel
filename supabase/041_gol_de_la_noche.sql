-- 041: modo fiesta (gol y salida en grupo), avisos de reacciones y fotos extra visibles para el grupo.
-- 1. Si hubo gol (beso) esa noche.
-- 2. Salida en grupo: cada uno carga sus vasos, unidos por la misma salida.
-- 3. Las fotos extra y la del postre se ven en el grupo (antes solo la principal).
-- 4. Aviso al que invitaron a una salida, y al que le reaccionan una foto o un mensaje.
-- Se puede correr mas de una vez.

-- 1 y 2
alter table public.comidas add column if not exists gol boolean;
alter table public.comidas add column if not exists salida uuid;
alter table public.comidas add column if not exists salida_con uuid[] not null default '{}';
alter table public.comidas drop constraint if exists comidas_salida_con_check;
alter table public.comidas add constraint comidas_salida_con_check check (cardinality(salida_con) <= 30);
create index if not exists comidas_salida_idx on public.comidas (salida) where salida is not null;

-- 3. Quien ve la comida ve todas sus fotos: la principal, las extra y la del postre.
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] = 'bocha'
      or ((storage.foldername(name))[2] = 'chat' and public.carpeta_del_grupo((storage.foldername(name))[1]))
      or exists (
        select 1 from public.comidas c
        where (c.foto_path = storage.objects.name or c.postre_foto = storage.objects.name or storage.objects.name = any(c.fotos_extra))
          and (not c.privada or c.usuario_id = auth.uid())
      )
      or exists (
        select 1 from public.invitaciones_comida i join public.comidas c on c.id = i.comida_id
        where (c.foto_path = storage.objects.name or storage.objects.name = any(c.fotos_extra)) and i.para_usuario = auth.uid()
      )
    )
  );

-- 4a. Te sumaron a una salida: le llega a los invitados que todavia no se sumaron.
create or replace function public.aviso_salida(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  invitados uuid[];
  la_salida uuid;
  dia date;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select salida_con, coalesce(salida, id), fecha into invitados, la_salida, dia
  from comidas where id = p_id and usuario_id = yo and tipo = 'fiesta';
  if invitados is null or cardinality(invitados) = 0 then return null; end if;
  if dia < (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1 then return null; end if;
  select nombre into autor from perfiles where id = yo;

  return jsonb_build_object(
    'titulo', autor || U&' te sum\00F3 a la salida \+01FAA9',
    'cuerpo', U&'Carg\00E1 tus vasos de esta noche: cada uno lleva los suyos.',
    'vista', 'fiesta',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s
      where s.usuario_id = any(invitados) and s.usuario_id <> yo
        and not exists (select 1 from comidas o where o.usuario_id = s.usuario_id and o.tipo = 'fiesta' and o.salida = la_salida)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.aviso_salida(uuid) from public, anon;
grant execute on function public.aviso_salida(uuid) to authenticated;

-- 4b. Te reaccionaron: solo le llega a quien subio la foto o mando el mensaje.
create or replace function public.aviso_reaccion(p_tipo text, p_id uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  duenio uuid;
  que text;
  titulo text;
  vista text;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if p_tipo = 'comida' then
    if not exists (select 1 from reacciones where comida_id = p_id and usuario_id = yo and emoji = p_emoji and creado_en > now() - interval '2 minutes') then
      return null;
    end if;
    select c.usuario_id, coalesce(nullif(trim(c.descripcion), ''), 'Tu comida'), case when c.foto_path is not null then 'imagenes' else 'resumen' end
    into duenio, que, vista
    from comidas c where c.id = p_id and not c.privada;
    titulo := ' a tu foto';
  elsif p_tipo = 'mensaje' then
    if not exists (select 1 from reacciones_mensajes where mensaje_id = p_id and usuario_id = yo and emoji = p_emoji and creado_en > now() - interval '2 minutes') then
      return null;
    end if;
    select m.usuario_id,
           coalesce(nullif(m.texto, ''), case when m.adjunto_path ~* '\.(m4a|mp4|webm|ogg|aac)$' then 'Tu audio' when m.adjunto_path is not null then 'Tu foto' else 'Tu mensaje' end),
           'chat'
    into duenio, que, vista
    from mensajes m where m.id = p_id and m.eliminado_en is null;
    titulo := ' a tu mensaje';
  else
    raise exception 'tipo_invalido';
  end if;
  if duenio is null or duenio = yo then return null; end if;
  select nombre into autor from perfiles where id = yo;

  return jsonb_build_object(
    'titulo', autor || U&' reaccion\00F3 ' || left(p_emoji, 16) || titulo,
    'cuerpo', left(que, 100),
    'vista', vista,
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id = duenio
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.aviso_reaccion(text, uuid, text) from public, anon;
grant execute on function public.aviso_reaccion(text, uuid, text) to authenticated;

select 'Listo: gol, salida en grupo, fotos extra para todos y avisos de reacciones.' as resultado;
