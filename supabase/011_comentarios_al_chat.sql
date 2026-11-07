-- Las respuestas a una foto ahora van al chat: los comentarios que ya existían pasan ahí.
-- Ejecutar UNA vez en el SQL Editor de Supabase, después de 010_niveles_y_vivo.sql.
insert into public.mensajes (usuario_id, texto, respuesta_comida, creado_en)
select k.usuario_id, k.texto, k.comida_id, k.creado_en
from public.comentarios k
join public.comidas c on c.id = k.comida_id
where not c.privada
  and not exists (
    select 1 from public.mensajes m
    where m.usuario_id = k.usuario_id and m.respuesta_comida = k.comida_id and m.texto = k.texto
  );
