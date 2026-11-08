-- Chat: responder mensajes, reaccionar, ver quién lo vio, mandar fotos, GIF y stickers.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 017_match_day_emojis.sql.

alter table public.mensajes add column if not exists respuesta_mensaje uuid references public.mensajes(id) on delete set null;
alter table public.mensajes add column if not exists adjunto_path text;
alter table public.mensajes add column if not exists sticker text check (sticker is null or char_length(sticker) <= 16);
alter table public.mensajes alter column texto set default '';
-- Una foto o un sticker pueden ir sin texto.
alter table public.mensajes drop constraint if exists mensajes_texto_check;
alter table public.mensajes add constraint mensajes_texto_check
  check (char_length(texto) <= 1000 and (char_length(texto) >= 1 or adjunto_path is not null or sticker is not null or usuario_id is null));
-- La foto tiene que ser de la carpeta de quien la manda.
alter table public.mensajes drop constraint if exists mensajes_adjunto_propio;
alter table public.mensajes add constraint mensajes_adjunto_propio
  check (adjunto_path is null or adjunto_path like usuario_id::text || '/chat/%');

create table if not exists public.reacciones_mensajes (
  mensaje_id uuid not null references public.mensajes(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  creado_en timestamptz not null default now(),
  primary key (mensaje_id, usuario_id, emoji)
);

-- Hasta qué mensaje vio cada uno.
create table if not exists public.lecturas (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  hasta timestamptz not null
);

alter table public.reacciones_mensajes enable row level security;
alter table public.lecturas enable row level security;
revoke all on public.reacciones_mensajes, public.lecturas from anon, authenticated;
grant select, insert, delete on public.reacciones_mensajes to authenticated;
grant select, insert, update on public.lecturas to authenticated;

drop policy if exists "reacciones_mensajes: ver" on public.reacciones_mensajes;
drop policy if exists "reacciones_mensajes: crear propias" on public.reacciones_mensajes;
drop policy if exists "reacciones_mensajes: borrar propias" on public.reacciones_mensajes;
create policy "reacciones_mensajes: ver" on public.reacciones_mensajes for select to authenticated using (true);
create policy "reacciones_mensajes: crear propias" on public.reacciones_mensajes for insert to authenticated with check (usuario_id = auth.uid());
create policy "reacciones_mensajes: borrar propias" on public.reacciones_mensajes for delete to authenticated using (usuario_id = auth.uid());

drop policy if exists "lecturas: ver" on public.lecturas;
drop policy if exists "lecturas: crear propia" on public.lecturas;
drop policy if exists "lecturas: editar propia" on public.lecturas;
create policy "lecturas: ver" on public.lecturas for select to authenticated using (true);
create policy "lecturas: crear propia" on public.lecturas for insert to authenticated with check (usuario_id = auth.uid());
create policy "lecturas: editar propia" on public.lecturas for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Las fotos del chat las ve todo el grupo.
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] = 'chat'
      or exists (select 1 from public.comidas c where c.foto_path = storage.objects.name and not c.privada)
    )
  );

do $$
declare
  tabla text;
begin
  foreach tabla in array array['reacciones_mensajes', 'lecturas'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla) then
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    end if;
  end loop;
end;
$$;

-- El aviso de un mensaje con foto o sticker dice qué mandó.
create or replace function public.destinos_aviso(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  meta integer;
  modo text;
  titulo text;
  cuerpo text;
  creado timestamptz;
  solo_para uuid;
  privada_c boolean;
  con_foto boolean;
  responde boolean;
  kcal integer;
  prote numeric;
  dia date;
  total_dia integer;
  hora_local integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
  vista text := 'chat';
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select nombre, meta_calorias, modo_total into autor, meta, modo from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select coalesce(nullif(texto, ''), case when adjunto_path is not null then 'Mandó una foto 📷' when sticker is not null then sticker end), creado_en, respuesta_comida is not null
    into cuerpo, creado, responde from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then ' respondió una foto' else '' end;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null, coalesce(calorias, 0), coalesce(proteinas, 0), fecha
    into cuerpo, creado, privada_c, con_foto, kcal, prote, dia
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    select total_del_dia(modo, sum(calorias) filter (where tipo <> 'resumen'), sum(calorias) filter (where tipo = 'resumen'))
    into total_dia from comidas where usuario_id = yo and fecha = dia;
    -- El título va corto para que entre en una línea; la parte graciosa va abajo.
    titulo := case
      when kcal >= 1500 then autor || ': ' || replace(to_char(kcal, 'FM9,999'), ',', '.') || ' kcal'
      when total_dia > meta + 500 then autor || ' pasó su meta'
      when hora_local < 5 then autor || ' atacó la heladera'
      when prote >= 60 then autor || ', modo proteína'
      else autor || case when con_foto then ' subió una foto' else ' subió una comida' end
    end;
    cuerpo := concat_ws(' · ', case
      when kcal >= 1500 then 'Se la mandó entera'
      when total_dia > meta + 500 then 'Que alguien le saque el plato'
      when hora_local < 5 or prote >= 60 then null
      else case get_byte(decode(md5(p_id::text), 'hex'), 0) % 12
        when 0 then '¿Y vos?'
        when 1 then 'Ya publicó'
        when 2 then 'Mirá antes de que se enfríe'
      end
    end, cuerpo);
    if con_foto then vista := 'imagenes'; end if;
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
    'vista', vista,
    'destinos', coalesce((
      -- A quien mencionan con @ le llega un título propio.
      select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
        'titulo', case when p_tipo = 'mensaje' and position(lower('@' || p.nombre) in lower(cuerpo)) > 0 then autor || ' te mencionó' end
      ))
      from suscripciones_push s join perfiles p on p.id = s.usuario_id
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
    ), '[]'::jsonb)
  );
end;
$$;
