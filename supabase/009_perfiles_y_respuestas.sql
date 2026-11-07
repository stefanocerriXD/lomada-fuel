-- Respuestas a fotos desde el chat, logros divertidos y notificaciones con más onda.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 008_avisos.sql.

-- Un mensaje puede responder a una comida publicada. Si la comida se borra, el mensaje queda.
alter table public.mensajes add column if not exists respuesta_comida uuid references public.comidas(id) on delete set null;

alter table public.medallas drop constraint if exists medallas_codigo_check;
alter table public.medallas add constraint medallas_codigo_check check (codigo in (
  'primera_comida', 'racha_7', 'racha_30', 'comidas_30', 'proteina_7', 'agua_7', 'gano_desafio', 'objetivo', 'fotogenico',
  'milanesa', 'parrillero', 'pizza', 'empanadas', 'pastas', 'mate', 'ensalada', 'dulce',
  'madrugador', 'heladera', 'bomba', 'gordito', 'cuatro', 'fotografo', 'monotematico'
));

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
  meta integer;
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
  select nombre, meta_calorias into autor, meta from perfiles where id = yo;

  if p_tipo = 'mensaje' then
    select texto, creado_en, respuesta_comida is not null into cuerpo, creado, responde from mensajes where id = p_id and usuario_id = yo;
    titulo := autor || case when responde then ' respondió una foto' else '' end;
  elsif p_tipo = 'comida' then
    select descripcion, creado_en, privada, foto_path is not null, coalesce(calorias, 0), coalesce(proteinas, 0), fecha
    into cuerpo, creado, privada_c, con_foto, kcal, prote, dia
    from comidas where id = p_id and usuario_id = yo and tipo <> 'resumen';
    if privada_c then return null; end if;
    select coalesce(sum(calorias), 0) into total_dia from comidas where usuario_id = yo and fecha = dia;
    -- Lo que se destaca va primero. Una de cada cuatro comidas normales lleva un texto distinto.
    titulo := case
      when kcal >= 1500 then autor || ' se mandó ' || replace(to_char(kcal, 'FM9,999'), ',', '.') || ' kcal'
      when total_dia > meta + 500 then autor || ' pasó su meta. Que alguien le saque el plato'
      when hora_local < 5 then autor || ' atacó la heladera'
      when prote >= 60 then autor || ' está en modo proteína'
      else case get_byte(decode(md5(p_id::text), 'hex'), 0) % 12
        when 0 then autor || ' está comiendo. ¿Y vos?'
        when 1 then 'Hay comida nueva. ' || autor || ' ya publicó'
        when 2 then autor || ' subió algo. Mirá antes de que se enfríe'
        else autor || case when con_foto then ' subió una foto' else ' subió una comida' end
      end
    end;
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
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s
      where case when solo_para is null then s.usuario_id <> yo else s.usuario_id = solo_para end
    ), '[]'::jsonb)
  );
end;
$$;

-- Avisa al grupo de un logro que la persona acaba de ganar.
create or replace function public.aviso_medalla(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  nombre_logro text := jsonb_build_object(
    'primera_comida', 'Primer plato', 'racha_7', 'Semana completa', 'racha_30', 'Mes imparable',
    'comidas_30', 'Bien documentado', 'proteina_7', 'Modo proteína', 'agua_7', 'Bien hidratado',
    'gano_desafio', 'Campeón', 'objetivo', 'Objetivo cumplido', 'fotogenico', 'Fotogénico',
    'milanesa', 'Rey de la milanesa', 'parrillero', 'Parrillero', 'pizza', 'Pizza party',
    'empanadas', 'Empanadero', 'pastas', 'Nonno', 'mate', 'Cebador oficial', 'ensalada', 'Conejo',
    'dulce', 'Diente dulce', 'madrugador', 'Madrugador', 'heladera', 'Ataque a la heladera',
    'bomba', 'Bomba calórica', 'gordito', 'Gordito certificado', 'cuatro', 'Cuatro de cuatro',
    'fotografo', 'Fotógrafo gastronómico', 'monotematico', 'Monotemático'
  ) ->> p_codigo;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if nombre_logro is null then return null; end if;
  if not exists (select 1 from medallas where usuario_id = yo and codigo = p_codigo and ganada_en > now() - interval '2 minutes') then
    return null;
  end if;
  select nombre into autor from perfiles where id = yo;

  return jsonb_build_object(
    'titulo', autor || ' desbloqueó un logro',
    'cuerpo', nombre_logro,
    'vista', 'retos',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id <> yo
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.aviso_medalla(text) from public, anon;
grant execute on function public.aviso_medalla(text) to authenticated;
