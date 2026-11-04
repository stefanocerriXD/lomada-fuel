-- Esquema de Comidas entre amigos. Ejecutar en el SQL Editor de Supabase (proyecto personal).

-- Perfiles: un registro por usuario, con el nombre que ven los amigos.
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  creado_en timestamptz not null default now()
);

-- Comidas: una fila por comida subida. Los macros pueden ser editados por el dueño.
create table if not exists public.comidas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null check (tipo in ('desayuno', 'almuerzo', 'merienda', 'cena')),
  fecha date not null default current_date,
  foto_path text,
  descripcion text,
  calorias integer,
  proteinas numeric(6,1),
  carbohidratos numeric(6,1),
  grasas numeric(6,1),
  macros_editados boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Mensajes del chat del grupo.
create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  creado_en timestamptz not null default now()
);

-- Desde el 30/10/2026 Supabase no da permisos automáticos a las tablas nuevas de public.
-- Solo se le dan a authenticated (nunca a anon): el front habla directo y las políticas RLS de abajo acotan el acceso.
grant select, insert, update on public.perfiles to authenticated;
grant select, insert, update, delete on public.comidas to authenticated;
grant select, insert on public.mensajes to authenticated;

-- Seguridad: solo usuarios logueados ven datos, y cada uno solo modifica lo suyo.
alter table public.perfiles enable row level security;
alter table public.comidas enable row level security;
alter table public.mensajes enable row level security;

-- Perfiles: todos los logueados ven los nombres; cada uno edita el suyo.
create policy "perfiles: ver" on public.perfiles for select to authenticated using (true);
create policy "perfiles: crear propio" on public.perfiles for insert to authenticated with check (id = auth.uid());
create policy "perfiles: editar propio" on public.perfiles for update to authenticated using (id = auth.uid());

-- Comidas: todos los amigos ven las comidas; solo el dueño crea, edita o borra las suyas.
create policy "comidas: ver" on public.comidas for select to authenticated using (true);
create policy "comidas: crear propias" on public.comidas for insert to authenticated with check (usuario_id = auth.uid());
create policy "comidas: editar propias" on public.comidas for update to authenticated using (usuario_id = auth.uid());
create policy "comidas: borrar propias" on public.comidas for delete to authenticated using (usuario_id = auth.uid());

-- Mensajes: todos leen y escriben solo como ellos mismos.
create policy "mensajes: ver" on public.mensajes for select to authenticated using (true);
create policy "mensajes: enviar propios" on public.mensajes for insert to authenticated with check (usuario_id = auth.uid());

-- Realtime para el chat.
alter publication supabase_realtime add table public.mensajes;

-- Storage: bucket privado "fotos". Cada uno sube solo a su carpeta (usuario_id/archivo).
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false)
  on conflict (id) do nothing;

create policy "fotos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
create policy "fotos: subir propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: borrar propias" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
