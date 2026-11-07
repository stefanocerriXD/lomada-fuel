-- Logros por niveles y actualización en vivo de todo lo que comparte el grupo.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 009_perfiles_y_respuestas.sql.

-- Un logro por nivel ("mate:2"). Lo ganado antes pasa al nivel equivalente.
alter table public.medallas drop constraint if exists medallas_codigo_check;

insert into public.medallas (usuario_id, codigo, ganada_en)
select m.usuario_id, c.nuevo, m.ganada_en
from public.medallas m
join (values
  ('primera_comida', 'comidas:1'), ('comidas_30', 'comidas:2'),
  ('racha_7', 'racha:1'), ('racha_30', 'racha:3'),
  ('proteina_7', 'proteina:1'), ('agua_7', 'agua:1'),
  ('gano_desafio', 'reto:1'), ('gano_desafio', 'victoria:legado'),
  ('fotogenico', 'fotogenico:1'), ('milanesa', 'milanesa:1'), ('parrillero', 'parrillero:1'),
  ('pizza', 'pizza:1'), ('empanadas', 'empanadas:1'), ('pastas', 'pastas:1'), ('mate', 'mate:1'),
  ('ensalada', 'ensalada:1'), ('dulce', 'dulce:1'), ('madrugador', 'madrugador:1'),
  ('heladera', 'heladera:1'), ('bomba', 'bomba:1'), ('gordito', 'gordito:1'),
  ('cuatro', 'cuatro:1'), ('fotografo', 'fotografo:1'), ('monotematico', 'monotematico:1')
) as c(viejo, nuevo) on c.viejo = m.codigo
on conflict do nothing;

delete from public.medallas where codigo !~ ':';

alter table public.medallas add constraint medallas_codigo_check check (codigo ~ '^[a-z_]+:[0-9a-z-]+$');

-- Avisa al grupo de un nivel que la persona acaba de ganar. Solo funciona con un logro propio y reciente.
drop function if exists public.aviso_medalla(text);
create or replace function public.aviso_medalla(p_codigo text, p_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  if not exists (select 1 from medallas where usuario_id = yo and codigo = p_codigo and ganada_en > now() - interval '2 minutes') then
    return null;
  end if;
  select nombre into autor from perfiles where id = yo;

  return jsonb_build_object(
    'titulo', autor || ' subió de nivel',
    'cuerpo', left(coalesce(p_nombre, 'Logro nuevo'), 60),
    'vista', 'retos',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s where s.usuario_id <> yo
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.aviso_medalla(text, text) from public, anon;
grant execute on function public.aviso_medalla(text, text) to authenticated;

-- Todo lo que el grupo comparte se actualiza en vivo. Se suma solo lo que todavía no está.
do $$
declare
  tabla text;
begin
  foreach tabla in array array['comidas', 'mensajes', 'reacciones', 'comentarios', 'medallas', 'desafios', 'agua', 'perfiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tabla) then
      execute format('alter publication supabase_realtime add table public.%I', tabla);
    end if;
  end loop;
end;
$$;
