-- Pedidos de mejoras: cada persona ve los suyos y quien administra ve todos.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 011_comentarios_al_chat.sql.

create table if not exists public.administradores (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade
);

create table if not exists public.mejoras (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 3 and 1000),
  hecha boolean not null default false,
  creado_en timestamptz not null default now()
);

alter table public.administradores enable row level security;
alter table public.mejoras enable row level security;
revoke all on public.administradores, public.mejoras from anon, authenticated;
grant select on public.administradores to authenticated;
grant select, insert on public.mejoras to authenticated;
grant update (hecha) on public.mejoras to authenticated;

-- Sin depender de las políticas de la tabla, que solo muestran la fila propia.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from administradores where usuario_id = auth.uid());
$$;
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

create policy "administradores: ver propio" on public.administradores for select to authenticated using (usuario_id = auth.uid());
create policy "mejoras: ver" on public.mejoras for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
create policy "mejoras: crear propias" on public.mejoras for insert to authenticated with check (usuario_id = auth.uid());
create policy "mejoras: marcar" on public.mejoras for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Avisa solo a quien administra, y solo de un pedido propio y recién creado.
create or replace function public.aviso_mejora(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  yo uuid := auth.uid();
  autor text;
  pedido text;
begin
  if yo is null then raise exception 'sin_sesion'; end if;
  select texto into pedido from mejoras where id = p_id and usuario_id = yo and creado_en > now() - interval '2 minutes';
  if pedido is null then return null; end if;
  select nombre into autor from perfiles where id = yo;

  return jsonb_build_object(
    'titulo', autor || ' pidió una mejora',
    'cuerpo', left(pedido, 120),
    'vista', 'ajustes',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from suscripciones_push s join administradores a on a.usuario_id = s.usuario_id
      where s.usuario_id <> yo
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.aviso_mejora(uuid) from public, anon;
grant execute on function public.aviso_mejora(uuid) to authenticated;
