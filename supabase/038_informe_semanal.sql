-- 038: informe semanal de cada uno, los domingos a las 20 (hora argentina).
-- La notificacion lleva los numeros de cada persona y abre el informe completo en la app. No usa IA.

do $$
begin
  if to_regclass('public.miembros_grupo') is null then
    raise exception 'Falta correr antes el SQL de varios grupos (036_varios_grupos.sql)';
  end if;
end $$;

create or replace function public.destinos_informe(p_clave text, p_tipo text, p_hoy date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  hoy date := coalesce(p_hoy, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  desde date := hoy - 6;
begin
  if not exists (select 1 from clave_recordatorio where hash = encode(digest(coalesce(p_clave, ''), 'sha256'), 'hex')) then
    raise exception 'clave_invalida';
  end if;
  if p_tipo <> 'informe' then raise exception 'tipo_invalido'; end if;

  return jsonb_build_object(
    'titulo', U&'\+01F4CA Tu semana',
    'cuerpo', U&'Tu informe semanal est\00E1 listo.',
    'vista', 'informe',
    'destinos', coalesce((
      with por_dia as (
        select c.usuario_id, c.fecha,
               total_del_dia(pf.modo_total, sum(coalesce(c.calorias, 0)) filter (where c.tipo <> 'resumen'), sum(coalesce(c.calorias, 0)) filter (where c.tipo = 'resumen')) as kcal,
               total_del_dia(pf.modo_total, sum(coalesce(c.proteinas, 0)) filter (where c.tipo <> 'resumen'), sum(coalesce(c.proteinas, 0)) filter (where c.tipo = 'resumen')) as proteinas
        from comidas c
        join perfiles pf on pf.id = c.usuario_id
        where c.fecha between desde and hoy
        group by c.usuario_id, c.fecha, pf.modo_total
      ),
      semana as (
        select usuario_id, count(*) as dias, round(avg(kcal)) as kcal, round(avg(proteinas)) as proteinas
        from por_dia
        where kcal > 0
        group by usuario_id
      )
      select jsonb_agg(jsonb_build_object(
        'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
        'cuerpo', format(U&'%s de 7 d\00EDas cargados. Promedio: %s kcal y %s g de prote\00EDna por d\00EDa. Toc\00E1 para ver tu informe completo.',
          w.dias, replace(to_char(w.kcal, 'FM999,999'), ',', '.'), w.proteinas)
      ))
      from suscripciones_push s
      join semana w on w.usuario_id = s.usuario_id
      where exists (select 1 from miembros_grupo m where m.usuario_id = s.usuario_id)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.destinos_informe(text, text, date) from public;
grant execute on function public.destinos_informe(text, text, date) to anon;

-- Domingo 23 UTC = domingo 20 en Argentina.
do $$
declare
  pedido text;
begin
  select command into pedido from cron.job where jobname = 'lomada-recordatorio';
  if pedido is null then raise exception 'falta el recordatorio de las 21'; end if;
  perform cron.schedule('lomada-informe', '0 23 * * 0', replace(pedido, '{"tipo":"recordatorio"}', '{"tipo":"informe"}'));
end $$;

select 'Listo: informe semanal programado para los domingos a las 20.' as resultado;
