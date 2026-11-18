// Corre los SQL del proyecto en un Postgres real embebido, con un entorno parecido a Supabase.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const raiz = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  create schema auth; create schema storage; create schema extensions;
  create extension pgcrypto schema extensions;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
  alter table storage.objects add column if not exists owner uuid;
  grant usage on schema storage to authenticated;
  grant select on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
  create publication supabase_realtime;
`);

for (const f of ["schema.sql", "002_rediseno.sql", "003_whoop.sql", "004_personal_y_bot.sql", "005_retos_y_habitos.sql", "006_usuarios_y_codigo.sql", "007_importar_y_salud.sql", "008_avisos.sql", "009_perfiles_y_respuestas.sql"]) {
  await db.exec(fs.readFileSync(raiz + f, "utf8"));
  console.log("ok", f);
}

const [U1, U2, U3] = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
await db.exec("insert into grupo_acceso (codigo) values ('Grupo-Prueba')");
const alta = (id, mail, usuario, nombre) => db.exec(`insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ('${id}', '${mail}', extensions.crypt('clave-${usuario}', extensions.gen_salt('bf')), '{"usuario": "${usuario}", "nombre": "${nombre}", "codigo_grupo": "grupo-prueba"}')`);
await alta(U1, 'uno@prueba.test', 'steve', 'Steve');
await alta(U2, 'dos@prueba.test', 'Nahuel.R', 'Nahuel');
await alta(U3, 'tres@prueba.test', 'juan_1', 'Juan');

async function como(uid, sql, params) {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; set prueba.uid = '${uid || ""}';`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

// Semana anterior respecto de hoy, en hora de Buenos Aires
const { rows: [{ lunes, domingo, previo, ahora_dow }] } = await db.query(`
  select (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date - 7)::text as lunes,
         (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date - 1)::text as domingo,
         (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date - 8)::text as previo,
         extract(isodow from now() at time zone 'America/Argentina/Buenos_Aires')::int as ahora_dow`);
console.log("semana a resumir", lunes, domingo, "| hoy es día", ahora_dow);

await db.exec(`
  insert into comidas (usuario_id, tipo, fecha, calorias, proteinas, carbohidratos, grasas) values
    ('${U1}', 'almuerzo', '${lunes}', 12500, 100, 0, 0),
    ('${U1}', 'cena', '${domingo}', 1000, 80, 0, 0),
    ('${U2}', 'almuerzo', '${lunes}', 2000, 400, 0, 0),
    ('${U3}', 'desayuno', '${lunes}', 300, 10, 0, 0),
    ('${U3}', 'almuerzo', (date '${lunes}' + 1), 300, 10, 0, 0),
    ('${U3}', 'cena', (date '${lunes}' + 2), 300, 10, 0, 0),
    ('${U3}', 'cena', '${previo}', 99999, 9999, 0, 0);
`);

// Bot: anónimo no puede
await assert.rejects(() => como(null, "select publicar_resumen_semanal()"), /permission denied/);

await como(U1, "select publicar_resumen_semanal()");
await como(U2, "select publicar_resumen_semanal()"); // segunda vez: no duplica
const { rows: bot } = await db.query("select texto, usuario_id, bot_semana::text from mensajes where bot_semana is not null");
assert.equal(bot.length, 1, "publica una sola vez");
console.log("\n" + bot[0].texto + "\n");
assert.match(bot[0].texto, /Más comió: Steve, 13\.500 kcal/);
assert.match(bot[0].texto, /Más proteína: Nahuel, 400 g/);
assert.match(bot[0].texto, /Más constante: Juan, 3 de 7 días/);
assert.match(bot[0].texto, /Más comidas subidas: Juan, 3/);

// Un usuario no puede escribir como bot
await assert.rejects(() => como(U1, "insert into mensajes (usuario_id, texto, bot_semana) values (null, 'falso', '2020-01-06')"), /row-level security/);
await assert.rejects(() => como(U1, `insert into mensajes (usuario_id, texto) values ('${U2}', 'suplantado')`), /row-level security/);
await assert.rejects(() => db.exec("insert into mensajes (usuario_id, texto) values (null, 'sin autor')"), /mensajes_autor_o_bot/);

// Datos del cuerpo privados
await como(U1, `insert into perfiles_salud (usuario_id, sexo, anio_nacimiento, altura_cm, peso_kg, dias_actividad, peso_objetivo) values ('${U1}', 'masculino', 1998, 178, 82, 4, 76)`);
await como(U1, `insert into pesos (usuario_id, fecha, peso_kg) values ('${U1}', current_date, 82)`);
assert.equal((await como(U1, "select * from perfiles_salud")).rows.length, 1);
assert.equal((await como(U2, "select * from perfiles_salud")).rows.length, 0, "otro amigo no ve la salud ajena");
assert.equal((await como(U2, "select * from pesos")).rows.length, 0, "otro amigo no ve el peso ajeno");
await assert.rejects(() => como(U2, `insert into pesos (usuario_id, fecha, peso_kg) values ('${U1}', current_date - 1, 90)`), /row-level security/);
await assert.rejects(() => como(null, "select * from perfiles_salud"), /permission denied/);
assert.equal((await como(U2, `update perfiles_salud set peso_kg = 200 where usuario_id = '${U1}' returning *`)).rows.length, 0);

// Reacciones
const { rows: [{ id: comida }] } = await db.query(`select id from comidas where usuario_id = '${U1}' limit 1`);
await como(U2, "insert into reacciones (comida_id, usuario_id, emoji) values ($1, $2, '🔥')", [comida, U2]);
await assert.rejects(() => como(U2, "insert into reacciones (comida_id, usuario_id, emoji) values ($1, $2, '🔥')", [comida, U1]), /row-level security/);
await assert.rejects(() => como(U2, "insert into reacciones (comida_id, usuario_id, emoji) values ($1, $2, '💀')", [comida, U2]), /check constraint/);
assert.equal((await como(U3, "select * from reacciones")).rows.length, 1);
assert.equal((await como(U3, `delete from reacciones where usuario_id = '${U2}' returning *`)).rows.length, 0, "no borra la de otro");
assert.equal((await como(U2, `delete from reacciones where usuario_id = '${U2}' returning *`)).rows.length, 1);

// Tokens de WHOOP invisibles para el navegador
await assert.rejects(() => como(U1, "select * from whoop_conexiones"), /permission denied/);


// ---------- 005 ----------
const pruebaDia = "2026-11-02";
const { rows: [{ id: publica }] } = await db.query(`insert into comidas (usuario_id, tipo, fecha, calorias, foto_path) values ('${U1}', 'cena', current_date, 500, '${U1}/publica.jpg') returning id`);
const { rows: [{ id: privada }] } = await db.query(`insert into comidas (usuario_id, tipo, fecha, calorias, proteinas, foto_path, privada) values ('${U1}', 'cena', current_date, 9000, 900, '${U1}/privada.jpg', true) returning id`);
await db.exec(`insert into storage.objects (bucket_id, name) values ('fotos', '${U1}/publica.jpg'), ('fotos', '${U1}/privada.jpg')`);

// Privacidad
assert.equal((await como(U2, "select * from comidas where id = $1", [privada])).rows.length, 0, "un amigo no ve la comida privada");
assert.equal((await como(U1, "select * from comidas where id = $1", [privada])).rows.length, 1, "el dueño sí");
assert.equal((await como(U2, "select * from comidas where id = $1", [publica])).rows.length, 1);
assert.equal((await como(U2, "select name from storage.objects where name like '%privada.jpg'")).rows.length, 0, "un amigo no accede a la foto privada");
assert.equal((await como(U1, "select name from storage.objects where name like '%privada.jpg'")).rows.length, 1);
assert.equal((await como(U2, "select name from storage.objects where name like '%publica.jpg'")).rows.length, 1);

// Comentarios
await como(U2, "insert into comentarios (comida_id, usuario_id, texto) values ($1, $2, 'Qué pinta')", [publica, U2]);
await assert.rejects(() => como(U2, "insert into comentarios (comida_id, usuario_id, texto) values ($1, $2, 'chisme')", [privada, U2]), /row-level security/);
await assert.rejects(() => como(U2, "insert into comentarios (comida_id, usuario_id, texto) values ($1, $2, 'falso')", [publica, U1]), /row-level security/);
assert.equal((await como(U3, "select * from comentarios")).rows.length, 1);
assert.equal((await como(U3, `delete from comentarios where usuario_id = '${U2}' returning *`)).rows.length, 0);

// Favoritas y ayunos privados
await como(U1, `insert into favoritas (usuario_id, nombre) values ('${U1}', 'Milanesa')`);
assert.equal((await como(U2, "select * from favoritas")).rows.length, 0);
await como(U1, `insert into ayunos (usuario_id) values ('${U1}')`);
await assert.rejects(() => como(U1, `insert into ayunos (usuario_id) values ('${U1}')`), /ayuno_en_curso/);
assert.equal((await como(U2, "select * from ayunos")).rows.length, 0);

// Agua visible para desafíos, pero solo editable por su dueño
await como(U1, `insert into agua (usuario_id, fecha, ml) values ('${U1}', '${pruebaDia}', 750)`);
assert.equal((await como(U2, "select * from agua")).rows.length, 1);
assert.equal((await como(U2, `update agua set ml = 1 where usuario_id = '${U1}' returning *`)).rows.length, 0);

// Desafíos
await como(U1, `insert into desafios (tipo, meta, inicio, fin, creado_por) values ('proteina', 120, current_date, current_date + 6, '${U1}')`);
await assert.rejects(() => como(U2, `insert into desafios (tipo, meta, inicio, fin, creado_por) values ('fotos', 5, current_date, current_date + 6, '${U1}')`), /row-level security/);
await assert.rejects(() => como(U1, `insert into desafios (tipo, meta, inicio, fin, creado_por) values ('fotos', 5, current_date, current_date + 90, '${U1}')`), /check constraint/);
assert.equal((await como(U2, "delete from desafios returning *")).rows.length, 0, "no borra el desafío de otro");

// Medallas
await como(U1, `insert into medallas (usuario_id, codigo) values ('${U1}', 'primera_comida')`);
await assert.rejects(() => como(U2, `insert into medallas (usuario_id, codigo) values ('${U1}', 'objetivo')`), /row-level security/);
await assert.rejects(() => como(U1, `insert into medallas (usuario_id, codigo) values ('${U1}', 'inventada')`), /check constraint/);
assert.equal((await como(U2, "select * from medallas")).rows.length, 1);

// Notificaciones
await como(U1, `insert into suscripciones_push (endpoint, usuario_id, p256dh, auth) values ('https://push.test/1', '${U1}', 'a', 'b')`);
assert.equal((await como(U2, "select * from suscripciones_push")).rows.length, 0);
await assert.rejects(() => como(null, "select * from suscripciones_push"), /permission denied/);

// El bot ignora las comidas privadas de la semana pasada
await db.exec(`delete from mensajes where bot_semana is not null; insert into comidas (usuario_id, tipo, fecha, calorias, proteinas, privada) values ('${U3}', 'cena', '${lunes}', 900000, 90000, true)`);
await como(U1, "select publicar_resumen_semanal()");
const { rows: [nuevo] } = await db.query("select texto from mensajes where bot_semana is not null");
assert.match(nuevo.texto, /Más comió: Steve/, "lo privado no entra en los premios");

console.log("005: todas las pruebas pasaron");
// Registro y acceso
const anonimo = (sql, p) => como(null, sql, p);
assert.deepEqual((await db.query("select nombre, usuario from perfiles order by nombre")).rows.map((r) => `${r.nombre}/${r.usuario}`), ["Juan/juan_1", "Nahuel/nahuel.r", "Steve/steve"], "crea el perfil al registrarse");
assert.equal((await db.query("select raw_user_meta_data ? 'codigo_grupo' as tiene from auth.users limit 1")).rows[0].tiene, false, "no guarda el código en la cuenta");

const registro = (mail, meta) => db.exec(`insert into auth.users (email, raw_user_meta_data) values ('${mail}', '${JSON.stringify(meta)}')`);
await assert.rejects(() => registro("a@prueba.test", { usuario: "nuevo" }), /codigo_invalido/);
await assert.rejects(() => registro("a@prueba.test", { usuario: "nuevo", codigo_grupo: "mal" }), /codigo_invalido/);
await assert.rejects(() => registro("a@prueba.test", { usuario: "STEVE", codigo_grupo: "grupo-prueba" }), /usuario_ocupado/);
await assert.rejects(() => registro("a@prueba.test", { usuario: "no vale!", codigo_grupo: "grupo-prueba" }), /usuario_invalido/);
assert.equal((await db.query("select count(*)::int as n from auth.users")).rows[0].n, 3, "no crea cuentas inválidas");

const revisar = async (u, c) => (await anonimo("select revisar_registro($1, $2) as r", [u, c])).rows[0].r;
assert.equal(await revisar("nuevo", "mal"), "codigo");
assert.equal(await revisar("steve", "mal"), "codigo", "sin código no revela si un usuario existe");
assert.equal(await revisar("Steve", "GRUPO-PRUEBA"), "usuario_ocupado");
assert.equal(await revisar("a", " grupo-prueba "), "usuario_invalido");
assert.equal(await revisar("nuevo_1", "grupo-prueba"), "ok");

const ingreso = async (u, c) => (await anonimo("select mail_de_ingreso($1, $2) as m", [u, c])).rows[0].m;
assert.equal(await ingreso("Steve", "clave-steve"), "uno@prueba.test", "entra con mayúsculas o minúsculas");
assert.equal(await ingreso("steve", "mala"), null, "clave mala no revela el mail");
assert.equal(await ingreso("nadie", "mala"), null);
assert.equal(await ingreso("steve", null), null);
assert.equal(await ingreso("steve", "clave-steve"), "uno@prueba.test", "un acierto limpia las fallas");
for (let i = 0; i < 4; i += 1) await ingreso("steve", "mala");
assert.equal(await ingreso("steve", "mala"), null);
await assert.rejects(() => ingreso("steve", "clave-steve"), /demasiados_intentos/, "bloquea tras 5 fallas");
await db.exec("update intentos_ingreso set bloqueado_hasta = now() - interval '1 minute' where usuario = 'steve'");
assert.equal(await ingreso("steve", "clave-steve"), "uno@prueba.test", "desbloquea al pasar el tiempo");

await assert.rejects(() => anonimo("select * from grupo_acceso"), /permission denied/);
await assert.rejects(() => como(U1, "select * from grupo_acceso"), /permission denied/);
await assert.rejects(() => anonimo("select * from intentos_ingreso"), /permission denied/);
await assert.rejects(() => como(U1, "update grupo_acceso set codigo = 'x'"), /permission denied/);
console.log("006: todas las pruebas pasaron");


// ---------- 007 ----------
const { rows: [{ hoy }] } = await db.query("select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as hoy");
const token = (await como(U2, "select crear_token_salud() as t")).rows[0].t;
assert.equal(token.length, 48);
await assert.rejects(() => anonimoSalud("no-existe"), /token_invalido/);
async function anonimoSalud(t, f = hoy, kcal = 1650, peso = 81.5) {
  return como(null, "select registrar_salud($1, $2::date, $3, 120.55, 180, 60, $4) as r", [t, f, kcal, peso]);
}
assert.equal((await anonimoSalud(token)).rows[0].r, "ok");
await db.exec(`update perfiles set comidas_privadas = false where id = '${U2}'`);
await como(U2, `insert into perfiles_salud (usuario_id, sexo, anio_nacimiento, altura_cm, peso_kg, dias_actividad, peso_objetivo) values ('${U2}', 'masculino', 1998, 178, 90, 4, 76)`);
await anonimoSalud(token, hoy, 1800, 80.2); // Se puede mandar varias veces por día.
const resumen = (await db.query(`select * from comidas where usuario_id = '${U2}' and tipo = 'resumen'`)).rows;
assert.equal(resumen.length, 1, "un solo resumen por día");
assert.equal(resumen[0].calorias, 1800);
assert.equal(Number(resumen[0].proteinas), 120.6);
assert.equal(Number((await db.query(`select peso_kg from perfiles_salud where usuario_id = '${U2}'`)).rows[0].peso_kg), 80.2);
assert.equal((await db.query(`select * from pesos where usuario_id = '${U2}'`)).rows.length, 1);
await assert.rejects(() => anonimoSalud(token, "2020-01-01"), /fecha_invalida/);
await assert.rejects(() => anonimoSalud(token, hoy, 999999), /valores_invalidos/);
await assert.rejects(() => anonimoSalud(token, hoy, -5), /valores_invalidos/);

// Otro día con solo peso no pisa las calorías de hoy
await como(null, "select registrar_salud($1, ($2::date - 1), null, null, null, null, 85)", [token, hoy]);
assert.equal(Number((await db.query(`select peso_kg from perfiles_salud where usuario_id = '${U2}'`)).rows[0].peso_kg), 80.2, "un peso viejo no pisa el último");

// El token no se puede leer ni usar para otra persona
assert.equal((await como(U1, "select usuario_id from tokens_salud")).rows.length, 0);
assert.equal((await como(U2, "select usuario_id from tokens_salud")).rows.length, 1);
await assert.rejects(() => como(U2, "select token_hash from tokens_salud"), /permission denied/);
await assert.rejects(() => como(null, "select crear_token_salud()"), /permission denied/);
await assert.rejects(() => como(U1, "select registrar_salud($1, current_date)", [token]), /permission denied/);
const otroToken = (await como(U2, "select crear_token_salud() as t")).rows[0].t;
await assert.rejects(() => anonimoSalud(token), /token_invalido/, "el token viejo deja de servir");
assert.equal((await anonimoSalud(otroToken)).rows[0].r, "ok");

// Un resumen importado a mano también vale y se reemplaza con el Atajo
await assert.rejects(() => como(U2, `insert into comidas (usuario_id, tipo, fecha, calorias) values ('${U2}', 'resumen', '${hoy}', 100)`), /duplicate key/);
await como(U1, `insert into comidas (usuario_id, tipo, fecha, calorias) values ('${U1}', 'resumen', '${hoy}', 100)`);
await assert.rejects(() => como(U1, `insert into comidas (usuario_id, tipo, fecha) values ('${U1}', 'otro', '${hoy}')`), /comidas_tipo_check/);
console.log("007: todas las pruebas pasaron");


// ---------- 008 ----------
await db.exec("delete from suscripciones_push");
await db.exec(`insert into suscripciones_push (endpoint, usuario_id, p256dh, auth) values ('https://p/1', '${U1}', 'a', 'b'), ('https://p/2', '${U2}', 'a', 'b'), ('https://p/3', '${U3}', 'a', 'b')`);
const aviso = async (uid, tipo, id) => (await como(uid, "select destinos_aviso($1, $2) as a", [tipo, id])).rows[0].a;
const m1 = (await db.query(`insert into mensajes (usuario_id, texto) values ('${U1}', 'Hola grupo') returning id`)).rows[0].id;
let a = await aviso(U1, "mensaje", m1);
assert.equal(a.titulo, "Steve");
assert.equal(a.cuerpo, "Hola grupo");
assert.equal(a.vista, "chat");
assert.deepEqual(a.destinos.map((d) => d.endpoint).sort(), ["https://p/2", "https://p/3"], "avisa a todos menos a quien escribió");
assert.equal(await aviso(U2, "mensaje", m1), null, "nadie puede avisar en nombre de otro");
const fotoId = (await db.query(`insert into comidas (usuario_id, tipo, fecha, foto_path, descripcion) values ('${U1}', 'cena', current_date, 'x.jpg', 'Milanesa') returning id`)).rows[0].id;
a = await aviso(U1, "comida", fotoId);
assert.match(a.titulo, /Steve/);
assert.equal(a.cuerpo, "Milanesa");
assert.equal(a.destinos.length, 2);
const secreta = (await db.query(`insert into comidas (usuario_id, tipo, fecha, privada) values ('${U1}', 'cena', current_date, true) returning id`)).rows[0].id;
assert.equal(await aviso(U1, "comida", secreta), null, "una comida privada no avisa");
const vieja = (await db.query(`insert into mensajes (usuario_id, texto, creado_en) values ('${U1}', 'viejo', now() - interval '1 hour') returning id`)).rows[0].id;
assert.equal(await aviso(U1, "mensaje", vieja), null, "no se reenvía lo viejo");
const k1 = (await db.query(`insert into comentarios (comida_id, usuario_id, texto) values ('${fotoId}', '${U2}', 'Qué rico') returning id`)).rows[0].id;
a = await aviso(U2, "comentario", k1);
assert.equal(a.titulo, "Nahuel comentó tu comida");
assert.deepEqual(a.destinos.map((d) => d.endpoint), ["https://p/1"], "el comentario le avisa al dueño");
const k2 = (await db.query(`insert into comentarios (comida_id, usuario_id, texto) values ('${fotoId}', '${U1}', 'Mío') returning id`)).rows[0].id;
assert.equal(await aviso(U1, "comentario", k2), null, "comentar lo propio no avisa");
await assert.rejects(() => como(null, "select destinos_aviso('mensaje', $1)", [m1]), /permission denied/);
await assert.rejects(() => aviso(U1, "otro", m1), /tipo_invalido/);
await como(U1, "select borrar_suscripciones($1)", [["https://p/3"]]);
assert.equal((await db.query("select count(*)::int as n from suscripciones_push")).rows[0].n, 2);
await assert.rejects(() => como(null, "select borrar_suscripciones($1)", [["https://p/1"]]), /permission denied/);
console.log("008: todas las pruebas pasaron");

console.log("SQL: todas las pruebas pasaron");

// ---------- 009: respuestas, logros y avisos ----------
{
  const rol = async (uid, f) => { await db.exec(`set prueba.uid = '${uid}'; set role authenticated`); try { return await f(); } finally { await db.exec("reset role; set prueba.uid = ''"); } };
  const uno = async (sql, p = []) => (await db.query(sql, p)).rows[0];
  const c1 = "aaaaaaaa-0000-4000-8000-000000000001";
  const c2 = "aaaaaaaa-0000-4000-8000-000000000002";
  await rol(U1, async () => {
    await db.query("insert into comidas (id, usuario_id, tipo, fecha, descripcion, foto_path, calorias, proteinas, carbohidratos, grasas) values ($1, $2, 'cena', current_date - 3, 'Asado', 'a.jpg', 1600, 30, 1, 1)", [c1, U1]);
    const a = (await uno("select public.destinos_aviso('comida', $1) d", [c1])).d;
    assert.equal(a.titulo, "Steve se mandó 1.600 kcal");
    assert.equal(a.vista, "imagenes");
    await db.query("insert into comidas (id, usuario_id, tipo, fecha, calorias, proteinas, carbohidratos, grasas) values ($1, $2, 'cena', current_date - 4, 300, 70, 1, 1)", [c2, U1]);
    const b = (await uno("select public.destinos_aviso('comida', $1) d", [c2])).d;
    assert.equal(b.vista, "chat");
    assert.match(b.titulo, /Steve/);
    const m = await uno("insert into mensajes (usuario_id, texto, respuesta_comida) values ($1, 'Qué lindo', $2) returning id", [U1, c1]);
    const r = (await uno("select public.destinos_aviso('mensaje', $1) d", [m.id])).d;
    assert.equal(r.titulo, "Steve respondió una foto");
    assert.equal(r.vista, "chat");
    await db.query("delete from comidas where id = $1", [c1]);
    assert.equal((await uno("select respuesta_comida from mensajes where id = $1", [m.id])).respuesta_comida, null, "el mensaje queda sin la comida");
  });

  console.log("009: todas las pruebas pasaron");
}
