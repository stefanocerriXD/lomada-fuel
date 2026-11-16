-- 043: registros del dia. Cada uno elige cuales usar (creatina, gym, magnesio) y los tilda.
-- Son privados: cada uno ve y toca solo los suyos.
-- A las 20 (Argentina) avisa a quien tenga alguno sin tildar.

-- 1. Lo tildado: una fila por dia y por registro.
create table if not exists public.registros_diarios (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  codigo text not null check (codigo in ('creatina', 'gym', 'magnesio')),
  creado_en timestamptz not null default now(),
  primary key (usuario_id, fecha, codigo)
);

alter table public.registros_diarios enable row level security;
revoke all on public.registros_diarios from anon, authenticated;
grant select, insert, delete on public.registros_diarios to authenticated;

drop policy if exists "registros: propios" on public.registros_diarios;
create policy "registros: propios" on public.registros_diarios for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 2. Cuales usa cada uno y si quiere el aviso.
create table if not exists public.registros_config (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  activos text[] not null default '{}' check (activos <@ array['creatina', 'gym', 'magnesio']::text[]),
  aviso boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.registros_config enable row level security;
revoke all on public.registros_config from anon, authenticated;
grant select, insert, update on public.registros_config to authenticated;

drop policy if exists "registros config: propia" on public.registros_config;
create policy "registros config: propia" on public.registros_config for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 3. El aviso de las 20: solo lo que falta tildar hoy.
create or replace function public.destinos_registros(p_clave text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'registros' then return null; end if;

  return jsonb_build_object(
    'titulo', 'Registros de hoy',
    'cuerpo', U&'Tild\00E1 lo que hiciste hoy.',
    'vista', 'resumen',
    'destinos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
        'titulo', case when f.tomar is not null then U&'\00BFYa tomaste ' || f.tomar || '?' else U&'\00BFFuiste al gym hoy? \+01F3CB\FE0F' end,
        'cuerpo', case
          when f.tomar is not null and f.gym then U&'Tildalo en Lomada Fuel para no olvidarte. Y si fuiste al gym, marcalo tambi\00E9n.'
          when f.tomar is not null then 'Tildalo en Lomada Fuel para no olvidarte.'
          else U&'Marcalo en Lomada Fuel y sosten\00E9 la racha.'
        end))
      from suscripciones_push s
      join (
        -- Lo que le falta a cada uno: "la creatina y el magnesio" y si falta el gym.
        select rc.usuario_id,
               string_agg(case c.codigo when 'creatina' then 'la creatina' when 'magnesio' then 'el magnesio' end, ' y ' order by c.orden) as tomar,
               bool_or(c.codigo = 'gym') as gym
        from registros_config rc
        cross join lateral unnest(rc.activos) with ordinality as c(codigo, orden)
        where rc.aviso
          and not exists (
            select 1 from registros_diarios r
            where r.usuario_id = rc.usuario_id and r.fecha = hoy and r.codigo = c.codigo
          )
        group by rc.usuario_id
      ) f on f.usuario_id = s.usuario_id
    ), '[]'::jsonb)
  );
end;
$$;

-- La llama el reloj con la clave (como la caca y el informe).
revoke all on function public.destinos_registros(text, text) from public;
grant execute on function public.destinos_registros(text, text) to anon;

-- 4. Todos los dias a las 20 de Argentina (23 UTC), con el mismo pedido que el recordatorio de las 21.
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-registros', '0 23 * * *', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"registros"}'));
end $$;

select 'Listo: registros del dia (creatina, gym, magnesio) con aviso a las 20.' as resultado;
