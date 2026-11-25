-- 066: foto de perfil. Cada uno sube la suya (ya recortada en la app) a su carpeta: usuario_id/perfil/archivo.jpg
-- La ven solo los de sus grupos (igual que el chat). Sin foto, queda la inicial de siempre.
-- Ejecutar en el SQL Editor de Supabase, despues de 065. Se puede correr mas de una vez.

alter table public.perfiles add column if not exists foto_path text;

-- Solo una foto de la carpeta propia (nadie pone de perfil la foto de otro).
alter table public.perfiles drop constraint if exists perfiles_foto_propia;
alter table public.perfiles add constraint perfiles_foto_propia
  check (foto_path is null or (foto_path like id::text || '/perfil/%' and char_length(foto_path) <= 200));

-- Ver las fotos de perfil de la gente de tus grupos. Es una politica aparte de "fotos: ver" (se suman), asi no se pisa.
drop policy if exists "fotos: ver de perfil" on storage.objects;
create policy "fotos: ver de perfil" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[2] = 'perfil'
    and public.carpeta_del_grupo((storage.foldername(name))[1])
  );

select 'Listo: foto de perfil.' as resultado;
