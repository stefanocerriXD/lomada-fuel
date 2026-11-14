-- 042: fotos en las recetas (subidas o tomadas de una comida ya cargada).
-- Se puede correr mas de una vez. Va despues del 041.
alter table public.recetas_propias add column if not exists fotos text[] not null default '{}';
alter table public.recetas_propias drop constraint if exists recetas_propias_fotos_check;
alter table public.recetas_propias add constraint recetas_propias_fotos_check check (cardinality(fotos) <= 4);

-- Quien puede ver la receta (la propia o la compartida en el grupo) ve sus fotos.
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[2] = 'bocha'
      or ((storage.foldername(name))[2] = 'chat' and public.carpeta_del_grupo((storage.foldername(name))[1]))
      or exists (
        select 1 from public.comidas c
        where (c.foto_path = storage.objects.name or c.postre_foto = storage.objects.name or storage.objects.name = any(c.fotos_extra))
          and (not c.privada or c.usuario_id = auth.uid())
      )
      or exists (
        select 1 from public.invitaciones_comida i join public.comidas c on c.id = i.comida_id
        where (c.foto_path = storage.objects.name or storage.objects.name = any(c.fotos_extra)) and i.para_usuario = auth.uid()
      )
      or exists (select 1 from public.recetas_propias r where storage.objects.name = any(r.fotos))
    )
  );

select 'Listo: fotos en las recetas.' as resultado;
