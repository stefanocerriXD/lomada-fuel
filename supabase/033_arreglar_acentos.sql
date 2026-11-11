-- Arregla los textos que se rompieron al copiar los SQL anteriores (tildes y emojis con caracteres raros).
-- El portapapeles de Windows leyo el texto como pagina de codigos 850: aca se deshace esa conversion.
-- Recrea las funciones de la base que tienen texto roto y arregla los mensajes ya guardados.
-- Este archivo es solo ASCII a proposito, para que no se pueda romper al copiarlo.
-- Ejecutar en el SQL Editor de Supabase. Se puede correr mas de una vez.

create or replace function pg_temp.reparar(t text) returns text
language plpgsql as $$
declare
  codigos constant int[] := array[199,252,233,226,228,224,229,231,234,235,232,239,238,236,196,197,201,230,198,244,246,242,251,249,255,214,220,248,163,216,215,402,225,237,243,250,241,209,170,186,191,174,172,189,188,161,171,187,9617,9618,9619,9474,9508,193,194,192,169,9571,9553,9559,9565,162,165,9488,9492,9524,9516,9500,9472,9532,227,195,9562,9556,9577,9574,9568,9552,9580,164,240,208,202,203,200,305,205,206,207,9496,9484,9608,9604,166,204,9600,211,223,212,210,245,213,181,254,222,218,219,217,253,221,175,180,173,177,8215,190,182,167,247,184,176,168,183,185,179,178,9632,160];
  b bytea := ''::bytea;
  c int;
  p int;
  i int;
begin
  if t is null then return t; end if;
  for i in 1..length(t) loop
    c := ascii(substr(t, i, 1));
    if c < 128 then
      b := b || set_byte('\x00'::bytea, 0, c);
    else
      p := array_position(codigos, c);
      if p is null then return t; end if;
      b := b || set_byte('\x00'::bytea, 0, 127 + p);
    end if;
  end loop;
  return convert_from(b, 'UTF8');
exception when others then
  -- No era texto roto (por ejemplo, ya estaba bien): queda como estaba.
  return t;
end $$;

create or replace function pg_temp.esta_roto(t text) returns boolean
language sql immutable as $$
  select t ~ ('[' || chr(9516) || chr(9500) || chr(212) || chr(8801) || chr(9532) || ']')
$$;

do $$
declare
  f record;
  definicion text;
  arreglada text;
  funciones int := 0;
  col record;
  filas int;
  textos int := 0;
begin
  -- 1. Funciones (avisos, bot del grupo, la caca, el viaje...).
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    definicion := pg_get_functiondef(f.oid);
    if pg_temp.esta_roto(definicion) then
      arreglada := pg_temp.reparar(definicion);
      if arreglada <> definicion then
        execute arreglada;
        funciones := funciones + 1;
      end if;
    end if;
  end loop;

  -- 2. Textos ya guardados (mensajes del bot, ajustes del grupo, etc.).
  for col in
    select c.table_name, c.column_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type in ('text', 'character varying')
  loop
    execute format('update public.%I set %I = pg_temp.reparar(%I) where pg_temp.esta_roto(%I) and pg_temp.reparar(%I) <> %I',
      col.table_name, col.column_name, col.column_name, col.column_name, col.column_name, col.column_name);
    get diagnostics filas = row_count;
    textos := textos + filas;
  end loop;

  perform set_config('lomada.reparar', format('Funciones arregladas: %s. Textos arreglados: %s.', funciones, textos), false);
end $$;

select current_setting('lomada.reparar', true) as resultado;
