-- 045: capturas de MyFitnessPal que manda el Atajo (toque atras del iPhone).
-- La foto no se guarda: la IA lee el texto y se guarda solo eso. Al tocar + la app lo une con la comida de Apple Salud.

do $$
begin
  if to_regclass('public.tokens_salud') is null then
    raise exception 'Falta correr antes el SQL de Apple Salud (007_importar_y_salud.sql)';
  end if;
end $$;

create table if not exists public.salud_capturas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  texto text not null check (char_length(texto) between 1 and 12000),
  creado_en timestamptz not null default now()
);
create index if not exists salud_capturas_dia on public.salud_capturas (usuario_id, fecha, creado_en desc);

-- Privadas: cada uno ve (y puede borrar) solo las suyas. Se escriben solo por la funcion del Atajo.
alter table public.salud_capturas enable row level security;
revoke all on public.salud_capturas from anon, authenticated;
grant select, delete on public.salud_capturas to authenticated;
drop policy if exists "salud_capturas: propias" on public.salud_capturas;
create policy "salud_capturas: propias" on public.salud_capturas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- La llave del Atajo es valida? (para no gastar la IA con pedidos de cualquiera)
create or replace function public.llave_salud_valida(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (select 1 from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex'));
$$;

revoke all on function public.llave_salud_valida(text) from public;
grant execute on function public.llave_salud_valida(text) to anon;

-- Guarda el texto leido. Se quedan las de los ultimos 3 dias (alcanza para cargar la comida).
create or replace function public.guardar_captura_salud(p_token text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  dueno uuid;
  nueva uuid;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select usuario_id into dueno from tokens_salud where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'token_invalido'; end if;
  if p_texto is null or char_length(btrim(p_texto)) = 0 or char_length(p_texto) > 12000 then
    raise exception 'valores_invalidos';
  end if;

  insert into salud_capturas (usuario_id, fecha, texto) values (dueno, hoy, p_texto) returning id into nueva;
  delete from salud_capturas where usuario_id = dueno and creado_en < now() - interval '3 days';
  return nueva;
end;
$$;

revoke all on function public.guardar_captura_salud(text, text) from public;
grant execute on function public.guardar_captura_salud(text, text) to anon;

select 'Listo: capturas de MyFitnessPal activadas.' as resultado;
