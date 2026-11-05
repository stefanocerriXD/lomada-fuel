-- Perfil físico, objetivo, peso, reacciones y bot semanal.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 002_rediseno.sql.

-- Datos del cuerpo. Son privados: cada persona ve solo los suyos.
create table if not exists public.perfiles_salud (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  sexo text not null check (sexo in ('masculino', 'femenino')),
  anio_nacimiento smallint not null check (anio_nacimiento between 1930 and 2015),
  altura_cm numeric(4,1) not null check (altura_cm between 120 and 230),
  peso_kg numeric(5,1) not null check (peso_kg between 30 and 300),
  dias_actividad smallint not null check (dias_actividad between 0 and 7),
  peso_objetivo numeric(5,1) not null check (peso_objetivo between 30 and 300),
  ritmo numeric(3,2) not null default 0.5 check (ritmo between 0.1 and 1),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.pesos (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  peso_kg numeric(5,1) not null check (peso_kg between 30 and 300),
  primary key (usuario_id, fecha)
);

-- Reacciones a las comidas del muro.
create table if not exists public.reacciones (
  comida_id uuid not null references public.comidas(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '🤤', '😂', '👏', '🐷')),
  creado_en timestamptz not null default now(),
  primary key (comida_id, usuario_id, emoji)
);

revoke all on public.perfiles_salud from anon, authenticated;
revoke all on public.pesos from anon, authenticated;
revoke all on public.reacciones from anon, authenticated;
grant select, insert, update, delete on public.perfiles_salud to authenticated;
grant select, insert, update, delete on public.pesos to authenticated;
grant select, insert, delete on public.reacciones to authenticated;

alter table public.perfiles_salud enable row level security;
alter table public.pesos enable row level security;
alter table public.reacciones enable row level security;

create policy "salud: solo propia" on public.perfiles_salud for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "pesos: solo propios" on public.pesos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "reacciones: ver" on public.reacciones for select to authenticated using (true);
create policy "reacciones: crear propias" on public.reacciones for insert to authenticated with check (usuario_id = auth.uid());
create policy "reacciones: borrar propias" on public.reacciones for delete to authenticated using (usuario_id = auth.uid());

alter publication supabase_realtime add table public.reacciones;

-- Los mensajes del bot no tienen autor y guardan a qué semana corresponden.
alter table public.mensajes alter column usuario_id drop not null;
alter table public.mensajes add column if not exists bot_semana date unique;
alter table public.mensajes add constraint mensajes_autor_o_bot check (usuario_id is not null or bot_semana is not null);

-- Publica el resumen de la semana anterior (lunes a domingo). Si ya está publicado, no hace nada.
create or replace function public.publicar_resumen_semanal()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  fin date := date_trunc('week', ahora)::date - 1;
  inicio date := fin - 6;
  mas_comio record;
  mas_proteina record;
  mas_constante record;
  mas_comidas record;
  total integer;
  miles constant text := 'FM999G999';
begin
  if auth.uid() is null then return; end if;
  -- El lunes espera a las 9, para contar lo que se cargue tarde el domingo.
  if extract(isodow from ahora) = 1 and extract(hour from ahora) < 9 then return; end if;
  if exists (select 1 from mensajes where bot_semana = inicio) then return; end if;

  create temporary table semana on commit drop as
    select p.nombre,
           sum(coalesce(c.calorias, 0))::integer as kcal,
           round(sum(coalesce(c.proteinas, 0)))::integer as proteinas,
           count(*)::integer as comidas,
           count(distinct c.fecha)::integer as dias
    from comidas c
    join perfiles p on p.id = c.usuario_id
    where c.fecha between inicio and fin
    group by p.id, p.nombre;

  select count(*) into total from semana;
  if total = 0 then
    drop table semana;
    return;
  end if;

  select * into mas_comio from semana order by kcal desc, nombre limit 1;
  select * into mas_proteina from semana order by proteinas desc, nombre limit 1;
  select * into mas_constante from semana order by dias desc, comidas desc, nombre limit 1;
  select * into mas_comidas from semana order by comidas desc, nombre limit 1;

  insert into mensajes (usuario_id, texto, bot_semana)
  values (
    null,
    format(E'🏆 Premios de la semana (%s al %s)\n\n🍽️ Más comió: %s, %s kcal\n💪 Más proteína: %s, %s g\n📅 Más constante: %s, %s de 7 días\n📸 Más comidas subidas: %s, %s',
      to_char(inicio, 'DD/MM'), to_char(fin, 'DD/MM'),
      mas_comio.nombre, replace(to_char(mas_comio.kcal, miles), ',', '.'),
      mas_proteina.nombre, replace(to_char(mas_proteina.proteinas, miles), ',', '.'),
      mas_constante.nombre, mas_constante.dias,
      mas_comidas.nombre, mas_comidas.comidas),
    inicio
  )
  on conflict (bot_semana) do nothing;

  drop table semana;
end;
$$;

revoke all on function public.publicar_resumen_semanal() from public, anon;
grant execute on function public.publicar_resumen_semanal() to authenticated;
