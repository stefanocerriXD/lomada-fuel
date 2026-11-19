-- 058: avisos del duenio a todos (por ejemplo, "manden sus pedidos de mejora").
-- Desde el Panel del duenio se escribe el aviso, se ve como queda y se manda a todos los que tienen avisos prendidos.
-- Cada uno puede apagarlos en Ajustes > Notificaciones > Anuncios de la app. Uno cada 10 minutos como mucho.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

-- 1. La categoria nueva en las preferencias de cada uno.
alter table public.preferencias_avisos drop constraint if exists preferencias_avisos_apagados_check;
alter table public.preferencias_avisos add constraint preferencias_avisos_apagados_check check (apagados <@ array[
  'mensajes', 'reacciones', 'comidas', 'invitaciones', 'logros', 'recordatorio', 'caca',
  'registros', 'semana', 'informe', 'lomada', 'mejoras', 'grupos', 'anuncios'
]::text[]);

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
    when p_tipo in ('mejora', 'mejora_hecha') then 'mejoras'
    when p_tipo in ('solicitud_grupo', 'grupo_aceptado') then 'grupos'
    when p_tipo = 'anuncio' then 'anuncios'
    else null
  end;
$$;

-- 2. Los anuncios que se mandaron.
create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text not null,
  vista text,
  enviado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table public.anuncios enable row level security;
revoke all on public.anuncios from anon, authenticated;

-- 3. El aviso a todos: solo el duenio, con el texto revisado.
create or replace function public.aviso_anuncio(p_titulo text, p_cuerpo text, p_vista text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_cuerpo text := btrim(coalesce(p_cuerpo, ''));
  v_vista text := coalesce(nullif(btrim(coalesce(p_vista, '')), ''), 'resumen');
begin
  if auth.uid() is null or not public.es_dueno() then raise exception 'no_sos_dueno'; end if;
  if char_length(v_titulo) not between 3 and 70 or char_length(v_cuerpo) not between 3 and 200 then raise exception 'texto_invalido'; end if;
  if v_vista not in ('resumen', 'grupo', 'chat', 'imagenes', 'retos', 'ajustes', 'mejoras') then raise exception 'texto_invalido'; end if;
  if exists (select 1 from anuncios where creado_en > now() - interval '10 minutes') then raise exception 'muy_seguido'; end if;
  insert into anuncios (titulo, cuerpo, vista, enviado_por) values (v_titulo, v_cuerpo, v_vista, auth.uid());
  return jsonb_build_object(
    'titulo', v_titulo,
    'cuerpo', v_cuerpo,
    'vista', v_vista,
    'destinos', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from suscripciones_push s), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.aviso_anuncio(text, text, text) from public, anon;
grant execute on function public.aviso_anuncio(text, text, text) to authenticated;

select 'Listo: avisos a todos desde el Panel del duenio.' as resultado;
