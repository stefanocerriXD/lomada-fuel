-- Desafíos, medallas, comentarios, favoritas, agua, ayuno, notificaciones y comidas privadas.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 004_personal_y_bot.sql.

-- Privacidad: una comida privada solo la ve quien la cargó, incluida su foto.
alter table public.comidas add column if not exists privada boolean not null default false;
alter table public.perfiles add column if not exists comidas_privadas boolean not null default false;

drop policy if exists "comidas: ver" on public.comidas;
create policy "comidas: ver" on public.comidas for select to authenticated
  using (usuario_id = auth.uid() or not privada);

drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.comidas c where c.foto_path = storage.objects.name and not c.privada)
    )
  );

-- Comentarios en las comidas del muro.
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  comida_id uuid not null references public.comidas(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 300),
  creado_en timestamptz not null default now()
);
create index if not exists comentarios_comida on public.comentarios (comida_id, creado_en);

-- Comidas guardadas para repetir con un toque.
create table if not exists public.favoritas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 200),
  alimentos jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  unique (usuario_id, nombre)
);

-- Agua por día. El grupo la ve porque se usa en los desafíos.
create table if not exists public.agua (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  ml integer not null default 0 check (ml between 0 and 15000),
  primary key (usuario_id, fecha)
);

-- Ayunos. Cada persona tiene como máximo uno en curso.
create table if not exists public.ayunos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  inicio timestamptz not null default now(),
  fin timestamptz,
  meta_horas smallint not null default 16 check (meta_horas between 12 and 24),
  check (fin is null or fin >= inicio)
);
create unique index if not exists ayuno_en_curso on public.ayunos (usuario_id) where fin is null;

-- Desafíos entre amigos. Participa todo el grupo.
create table if not exists public.desafios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('proteina', 'constancia', 'agua', 'fotos')),
  meta numeric(7,1) not null check (meta > 0),
  inicio date not null,
  fin date not null,
  creado_por uuid not null references public.perfiles(id) on delete cascade,
  creado_en timestamptz not null default now(),
  check (fin >= inicio and fin - inicio <= 29)
);

-- Medallas ganadas.
create table if not exists public.medallas (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  codigo text not null check (codigo in ('primera_comida', 'racha_7', 'racha_30', 'comidas_30', 'proteina_7', 'agua_7', 'gano_desafio', 'objetivo', 'fotogenico')),
  ganada_en timestamptz not null default now(),
  primary key (usuario_id, codigo)
);

-- Dispositivos que aceptaron notificaciones.
create table if not exists public.suscripciones_push (
  endpoint text primary key,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);

revoke all on public.comentarios, public.favoritas, public.agua, public.ayunos, public.desafios, public.medallas, public.suscripciones_push from anon, authenticated;
grant select, insert, delete on public.comentarios to authenticated;
grant select, insert, update, delete on public.favoritas to authenticated;
grant select, insert, update, delete on public.agua to authenticated;
grant select, insert, update, delete on public.ayunos to authenticated;
grant select, insert, delete on public.desafios to authenticated;
grant select, insert on public.medallas to authenticated;
grant select, insert, update, delete on public.suscripciones_push to authenticated;
grant select, delete on public.suscripciones_push to service_role;
grant select on public.comentarios, public.comidas, public.mensajes, public.perfiles to service_role;

alter table public.comentarios enable row level security;
alter table public.favoritas enable row level security;
alter table public.agua enable row level security;
alter table public.ayunos enable row level security;
alter table public.desafios enable row level security;
alter table public.medallas enable row level security;
alter table public.suscripciones_push enable row level security;

create policy "comentarios: ver" on public.comentarios for select to authenticated
  using (exists (select 1 from public.comidas c where c.id = comida_id));
create policy "comentarios: crear propios" on public.comentarios for insert to authenticated
  with check (usuario_id = auth.uid() and exists (select 1 from public.comidas c where c.id = comida_id));
create policy "comentarios: borrar propios" on public.comentarios for delete to authenticated
  using (usuario_id = auth.uid());

create policy "favoritas: solo propias" on public.favoritas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "agua: ver" on public.agua for select to authenticated using (true);
create policy "agua: crear propia" on public.agua for insert to authenticated with check (usuario_id = auth.uid());
create policy "agua: editar propia" on public.agua for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "agua: borrar propia" on public.agua for delete to authenticated using (usuario_id = auth.uid());

create policy "ayunos: solo propios" on public.ayunos for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy "desafios: ver" on public.desafios for select to authenticated using (true);
create policy "desafios: crear" on public.desafios for insert to authenticated with check (creado_por = auth.uid());
create policy "desafios: borrar propios" on public.desafios for delete to authenticated using (creado_por = auth.uid());

create policy "medallas: ver" on public.medallas for select to authenticated using (true);
create policy "medallas: ganar propias" on public.medallas for insert to authenticated with check (usuario_id = auth.uid());

create policy "push: solo propias" on public.suscripciones_push for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

alter publication supabase_realtime add table public.comentarios;

-- El bot no cuenta las comidas privadas.
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
    where c.fecha between inicio and fin and not c.privada
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
