-- Conexión con WHOOP: ejecutar UNA vez en el SQL Editor de Supabase, después de 002_rediseno.sql.

-- Tokens de acceso. Solo el servidor los lee: la app del navegador no tiene ningún permiso.
create table if not exists public.whoop_conexiones (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expira_en timestamptz not null,
  sincronizado_en timestamptz,
  creado_en timestamptz not null default now()
);

-- Un resumen por persona y por día. Cada uno ve solo los suyos.
create table if not exists public.whoop_dias (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  recuperacion smallint,
  hrv numeric(6,1),
  fc_reposo smallint,
  sueno_porcentaje smallint,
  sueno_horas numeric(4,1),
  strain numeric(4,1),
  calorias_quemadas integer,
  primary key (usuario_id, fecha)
);

alter table public.whoop_conexiones enable row level security;
alter table public.whoop_dias enable row level security;

revoke all on public.whoop_conexiones from anon, authenticated;
revoke all on public.whoop_dias from anon, authenticated;

grant select, insert, update, delete on public.whoop_conexiones to service_role;
grant select, insert, update, delete on public.whoop_dias to service_role;
grant select on public.whoop_dias to authenticated;

create policy "whoop_dias: ver propios" on public.whoop_dias for select to authenticated
  using (usuario_id = auth.uid());
