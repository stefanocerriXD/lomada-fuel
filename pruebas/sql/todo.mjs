import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const fuente = fs.readFileSync(new URL("./base.mjs", import.meta.url), "utf8");
const inicio = fuente.slice(fuente.indexOf("const raiz"), fuente.indexOf("for (const f of ["));
// La parte que arma la base sale de base.mjs; la carpeta de los SQL se pasa desde acá.
const RAIZ = new URL("../../supabase/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const armar = new Function("PGlite", "pgcrypto", "RAIZ", `return (async () => { ${inicio.replace(/const raiz = [^\n]*/, "const raiz = RAIZ;")}; return { raiz, db }; })()`);
const { raiz, db } = await armar(PGlite, pgcrypto, RAIZ);
await db.exec(`
  create schema cron; create table cron.job (jobname text primary key, command text); create function cron.schedule(n text, c text, q text) returns bigint language sql as $$ insert into cron.job values (n, q) on conflict (jobname) do update set command = excluded.command returning 1::bigint $$;
  create schema net; create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer) returns bigint language sql as $$ select 1::bigint $$;
`);
const sinExt = (s) => s.replace("create extension if not exists pg_cron;", "").replace("create extension if not exists pg_net;", "");
for (const f of ["schema.sql", "002_rediseno.sql", "003_whoop.sql", "004_personal_y_bot.sql", "005_retos_y_habitos.sql", "006_usuarios_y_codigo.sql", "007_importar_y_salud.sql", "008_avisos.sql", "009_perfiles_y_respuestas.sql", "010_niveles_y_vivo.sql", "011_comentarios_al_chat.sql", "012_mejoras.sql", "013_recordatorios.sql", "014_totales_sin_doble_conteo.sql", "015_modo_total_y_menciones.sql", "016_match_day.sql", "017_match_day_emojis.sql", "018_chat_completo.sql", "019_audios.sql", "020_mejoras_para_todos.sql", "021_colaciones.sql", "022_objetivo_y_macros.sql", "023_comidas_grupales.sql", "024_recetas_propias.sql", "025_multas.sql", "026_la_caca.sql", "027_mejora_hecha.sql", "028_gana_el_mayor.sql", "029_fiesta.sql", "031_recetas_compartidas.sql"]) {
  await db.exec(sinExt(fs.readFileSync(raiz + f, "utf8")));
}
await db.exec(sinExt(fs.readFileSync(raiz + "026_la_caca.sql", "utf8")));
await db.exec("insert into cron.job values ('lomada-recordatorio', 'select net.http_post(url := ''https://x/api/recordatorio'', headers := ''{}''::jsonb, body := ''{\"tipo\":\"recordatorio\"}''::jsonb, timeout_milliseconds := 20000)') on conflict (jobname) do nothing");
await db.exec(fs.readFileSync(raiz + "032_viaje_floripa.sql", "utf8"));
await db.exec(fs.readFileSync(raiz + "033_arreglar_acentos.sql", "utf8"));

const U = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
const LOMADA = "00000000-0000-4000-8000-00000000a001";
await db.exec("insert into grupo_acceso (codigo) values ('grupo')");
const registrar = (i, nombre, codigo) => db.exec(`insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ('${U[i]}', 'u${i}@p.test', 'x', '{"usuario": "usu${i}", "nombre": "${nombre}", "codigo_grupo": "${codigo}"}')`);
for (const [i, n] of ["Pepo", "Nahuel", "Ramiro"].entries()) await registrar(i, n, "grupo");
const rol = async (uid, f) => { await db.exec(`set prueba.uid = '${uid}'; set role authenticated`); try { return await f(); } finally { await db.exec("reset role; set prueba.uid = ''"); } };
const uno = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const filas = async (sql, p = []) => (await db.query(sql, p)).rows;

// Algo de antes, para ver que queda en Lomada.
await rol(U[0], () => db.query("insert into mensajes (usuario_id, texto) values ($1, 'Mensaje viejo')", [U[0]]));
await db.exec("insert into clave_recordatorio (hash) values (encode(extensions.digest('secreta', 'sha256'), 'hex'))");
for (const [e, u] of [["https://p/0", 0], ["https://p/1", 1], ["https://p/2", 2], ["https://p/3", 3]].slice(0, 3)) await db.query("insert into suscripciones_push (endpoint, usuario_id, p256dh, auth) values ($1, $2, 'a', 'b')", [e, U[u]]);

const sql = fs.readFileSync(raiz + "034_grupos.sql", "utf8");
console.log((await db.exec(sql)).at(-1).rows[0].resultado);
// Lo que va solo en el portapapeles (no en el repositorio).
await db.exec("insert into public.grupos (nombre, codigo, con_bocha) values ('Lomada Viejos', 'viejos1', false) on conflict ((lower(codigo))) do nothing");
await db.exec("update public.perfiles set grupo_id = null where lower(usuario) = 'usu2' or lower(nombre) = 'usu2'");
// Correrlo otra vez no devuelve a nadie a Lomada.
await db.exec(sql);
await db.exec("insert into public.grupos (nombre, codigo, con_bocha) values ('Lomada Viejos', 'VIEJOS1', false) on conflict ((lower(codigo))) do nothing");
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[2]])).grupo_id, null, "sigue afuera");
assert.equal((await uno("select count(*)::int n from grupos")).n, 2);
assert.equal((await uno("select grupo_id from mensajes where texto = 'Mensaje viejo'")).grupo_id, LOMADA);

// Registro con el código nuevo
const viejos = (await uno("select id from grupos where codigo = 'viejos1'")).id;
assert.equal((await uno("select public.revisar_registro('nuevo', 'VIEJOS1') r")).r, "ok");
assert.equal((await uno("select public.revisar_registro('nuevo', 'nada') r")).r, "codigo");
await registrar(3, "Abel", "viejos1");
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[3]])).grupo_id, viejos);
await db.query("insert into suscripciones_push (endpoint, usuario_id, p256dh, auth) values ('https://p/3', $1, 'a', 'b')", [U[3]]);

// Cada uno ve solo su grupo
const nombres = async (u) => (await rol(u, () => filas("select nombre from perfiles order by nombre"))).map((r) => r.nombre);
assert.deepEqual(await nombres(U[0]), ["Nahuel", "Pepo"]);
assert.deepEqual(await nombres(U[3]), ["Abel"]);
assert.deepEqual(await nombres(U[2]), ["Ramiro"], "sin grupo se ve solo a sí mismo");
assert.deepEqual(await rol(U[3], () => filas("select nombre from grupos")), [{ nombre: "Lomada Viejos" }]);
await assert.rejects(rol(U[3], () => filas("select codigo from grupos")), "el código no se lee");

await rol(U[3], () => db.query("insert into mensajes (usuario_id, texto) values ($1, 'Hola viejos')", [U[3]]));
const textos = async (u) => (await rol(u, () => filas("select texto from mensajes order by creado_en"))).map((r) => r.texto);
assert.deepEqual(await textos(U[3]), ["Hola viejos"]);
assert.deepEqual(await textos(U[1]), ["Mensaje viejo"]);
assert.deepEqual(await textos(U[2]), [], "sin grupo no ve el chat");
await assert.rejects(rol(U[3], () => db.query("insert into mensajes (usuario_id, texto, grupo_id) values ($1, 'colado', $2)", [U[3], LOMADA])), "no escribe en otro grupo");
await assert.rejects(rol(U[2], () => db.query("insert into mensajes (usuario_id, texto) values ($1, 'sigo aca?')", [U[2]])), "sin grupo no escribe");

// Nadie se cambia de grupo editando el perfil
await assert.rejects(rol(U[3], () => db.query("update perfiles set grupo_id = $1 where id = $2", [LOMADA, U[3]])), /grupo_bloqueado/);
await rol(U[3], () => db.query("update perfiles set nombre = 'Abel' where id = $1", [U[3]]));
await assert.rejects(rol(U[3], () => db.query("select public.unirme_a_grupo('grupo')")), /ya_tiene_grupo/);

// Comidas y fotos
const hoy = (await uno("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).d;
await rol(U[0], () => db.query("insert into comidas (usuario_id, tipo, fecha, foto_path, calorias) values ($1, 'almuerzo', $2, $3, 500)", [U[0], hoy, `${U[0]}/a.jpg`]));
await rol(U[3], () => db.query("insert into comidas (usuario_id, tipo, fecha, foto_path, calorias) values ($1, 'almuerzo', $2, $3, 400)", [U[3], hoy, `${U[3]}/b.jpg`]));
await db.exec(`insert into storage.objects (bucket_id, name) values ('fotos', '${U[0]}/a.jpg'), ('fotos', '${U[3]}/b.jpg'), ('fotos', '${U[0]}/chat/c.jpg'), ('fotos', '${U[3]}/chat/d.jpg')`);
const archivos = async (u) => (await rol(u, () => filas("select name from storage.objects order by name"))).map((r) => r.name.slice(37));
assert.deepEqual(await archivos(U[1]), ["a.jpg", "chat/c.jpg"]);
assert.deepEqual(await archivos(U[3]), ["b.jpg", "chat/d.jpg"]);
assert.equal((await rol(U[1], () => filas("select * from comidas"))).length, 1);
const comida = (await uno("select id from comidas where usuario_id = $1", [U[0]])).id;
assert.equal((await rol(U[0], () => uno("select public.invitar_a_comida($1, $2) n", [comida, [U[3], U[1]]]))).n, 1, "solo invita a los del grupo");

// Avisos desde la app: solo al grupo de quien los manda
const todos = ["https://p/0", "https://p/1", "https://p/2", "https://p/3"];
assert.deepEqual((await rol(U[0], () => uno("select public.solo_mi_grupo($1) e", [todos]))).e.sort(), ["https://p/0", "https://p/1"]);
assert.deepEqual((await rol(U[3], () => uno("select public.solo_mi_grupo($1) e", [todos]))).e, ["https://p/3"]);
assert.deepEqual((await uno("select public.filtrar_destinos('secreta', 'viaje', $1) e", [todos])).e.sort(), ["https://p/0", "https://p/1"], "el viaje solo para Lomada");
assert.deepEqual((await uno("select public.filtrar_destinos('secreta', 'recordatorio', $1) e", [todos])).e.sort(), ["https://p/0", "https://p/1", "https://p/3"], "sin grupo no recibe");
await assert.rejects(db.query("select public.filtrar_destinos('mala', 'viaje', '{}')"), /clave_invalida/);
const matchday = await uno("select public.destinos_programados('secreta', 'matchday') a");
assert.deepEqual(matchday.a.destinos.map((d) => d.endpoint).sort(), ["https://p/0", "https://p/1"]);

// La caca de cada grupo. Un día para atrás, con todos ya adentro.
const ayer = (await uno("select ($1::date - 1)::text d", [hoy])).d;
await db.query("update grupos set creado_en = now() - interval '20 days'");
await db.query("update perfiles set unido_en = now() - interval '20 days'");
await db.query("update ajustes_grupo set valor = '2026-01-01' where clave = 'multas_desde'");
await db.query("select public.contar_multas($1)", [ayer]);
const bot = async (u) => (await rol(u, () => filas("select texto from mensajes where bot_multas is not null"))).map((r) => r.texto);
const [deLomada] = await bot(U[0]);
const [deViejos] = await bot(U[3]);
console.log(deLomada, "\n---\n", deViejos);
assert.ok(deLomada.includes("Pepo") && deLomada.includes("Nahuel") && deLomada.includes("Bocha") && !deLomada.includes("Ramiro") && !deLomada.includes("Abel"));
assert.ok(deViejos.includes("Abel") && !deViejos.includes("Bocha") && deViejos.includes("no ven las fotos"));
assert.equal((await uno("select count(*)::int n from multas where usuario_id = $1", [U[2]])).n, 0, "sin grupo no suma cacas");
await db.query("select public.contar_multas($1)", [ayer]);
assert.equal((await uno("select count(*)::int n from mensajes where bot_multas is not null")).n, 2, "una vez por grupo");

// Domingo: Bocha Evo solo en Lomada
const domingo = (await uno("select ($1::date - extract(isodow from $1::date)::int)::text d", [hoy])).d;
await db.query("select public.contar_multas($1)", [domingo]);
const evo = await filas("select usuario_id from bocha_evo");
assert.ok(evo.length >= 1 && evo.every((e) => [U[0], U[1]].includes(e.usuario_id)), "el abel no se come al Bocha Evo");
const domViejos = (await rol(U[3], () => filas("select texto from mensajes where bot_multas = $1", [domingo])))[0].texto;
assert.ok(domViejos.includes("Cacas de la semana") && !domViejos.includes("BOCHA"), domViejos);
await rol(U[0], () => db.query("insert into multas (usuario_id, fecha) values ($1, $2) on conflict do nothing", [U[3], hoy]).catch(() => {}));

// Aviso de las 22 con el texto de cada grupo
const caca = (await uno("select public.destinos_caca('secreta', 'caca') a")).a;
const porEndpoint = Object.fromEntries(caca.destinos.map((d) => [d.endpoint, d.cuerpo]));
assert.equal(porEndpoint["https://p/3"], undefined, "el abel ya subió hoy");
assert.equal(porEndpoint["https://p/1"], null, "Nahuel recibe el del Bocha");
assert.ok(!("https://p/2" in porEndpoint), "sin grupo, nada");
await db.query("delete from comidas where usuario_id = $1", [U[3]]);
const caca2 = (await uno("select public.destinos_caca('secreta', 'caca') a")).a;
assert.ok(caca2.destinos.find((d) => d.endpoint === "https://p/3").cuerpo.includes("no vas a ver las fotos"));


// ===== 035 =====
const s035 = fs.readFileSync(raiz + "035_avisos_y_viaje.sql", "utf8");
assert.ok([...s035].every((c) => c.charCodeAt(0) < 128), "solo ASCII");
console.log((await db.exec(s035)).at(-1).rows[0].resultado);
const r2 = (await db.exec(s035)).at(-1).rows[0].resultado;
console.log(r2);
assert.ok(r2.includes("Textos bien"));

await db.exec("delete from comidas; delete from bocha_evo");
const subir = async (u, tipo, privada = false) => {
  const id = (await rol(U[u], () => uno("insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, privada) values ($1, $2, $3, 'Tostadas', 300, $4) returning id", [U[u], tipo, hoy, privada]))).id;
  return (await rol(U[u], () => uno("select public.destinos_aviso('comida', $1) a", [id]))).a;
};
const d1 = await subir(0, "desayuno");
console.log(d1.titulo, "|", d1.cuerpo);
assert.ok(/^☀️ Buen día/.test(d1.cuerpo) && d1.cuerpo.endsWith("· Tostadas"), d1.cuerpo);
assert.deepEqual(d1.destinos.map((d) => d.endpoint), ["https://p/1"], "solo a los del grupo");
const d2 = await subir(1, "desayuno");
assert.ok(!/Buen día/.test(d2.cuerpo), "el segundo desayuno no saluda");
const viejoPrimero = await subir(3, "desayuno");
assert.ok(/Buen día/.test(viejoPrimero.cuerpo), "cada grupo tiene su primer desayuno");
const alm = await subir(1, "almuerzo");
assert.ok(/almorzar|almuerzos/.test(alm.cuerpo), alm.cuerpo);
const col = await subir(0, "colacion");
assert.ok(!/🍽️|☀️|🧉|🌙/.test(col.cuerpo), "las colaciones no");
const mer = await subir(0, "merienda");
const cen = await subir(1, "cena");
console.log(alm.cuerpo, "|", mer.cuerpo, "|", cen.cuerpo);
assert.ok(/🧉/.test(mer.cuerpo) && /🌙/.test(cen.cuerpo));
// Nunca más "¿Y vos?"
for (let i = 0; i < 25; i++) { const a = await subir(i % 2, "colacion"); assert.ok(!a.cuerpo.includes("Y vos"), a.cuerpo); }
const msj = (await rol(U[0], () => uno("insert into mensajes (usuario_id, adjunto_path, texto) values ($1, $2, '') returning id", [U[0], `${U[0]}/chat/a.m4a`]))).id;
assert.equal((await rol(U[0], () => uno("select public.destinos_aviso('mensaje', $1) a", [msj]))).a.cuerpo, "Mandó un audio 🎤");

// Viaje
const v = async (f) => (await uno("select public.destinos_viaje('secreta', 'viaje', $1::date) a", [f])).a;
const arranque = await v("2026-11-13");
console.log(arranque.titulo, "|", arranque.cuerpo);
assert.equal(arranque.titulo, "✈️ Arranca la cuenta regresiva a Floripa");
assert.ok(arranque.cuerpo.includes("Faltan 43 días. Está en Progreso"));
assert.deepEqual(arranque.destinos.map((d) => d.endpoint).sort(), ["https://p/0", "https://p/1"], "solo Lomada");
assert.equal(await v("2026-11-14"), null, "el arranque no se repite");
assert.equal((await v("2026-11-26")).titulo, "🏖️ Falta un mes para Floripa");
assert.equal(await v("2026-11-26"), null, "una sola vez");
assert.equal((await v("2026-12-25")).titulo, "✈️ Mañana nos vamos a Floripa");
assert.equal(await v("2026-12-26"), null);
console.log("035: pruebas pasadas");

// ===== 036: varios grupos =====
const s036 = fs.readFileSync(raiz + "036_varios_grupos.sql", "utf8");
assert.ok([...s036].every((c) => c.charCodeAt(0) < 128), "036 solo ASCII");
console.log((await db.exec(s036)).at(-1).rows[0].resultado);
console.log((await db.exec(s036)).at(-1).rows[0].resultado, "(otra vez)");
const miembros = async (u) => (await filas("select g.nombre from miembros_grupo m join grupos g on g.id = m.grupo_id where m.usuario_id = $1 order by g.nombre", [u])).map((r) => r.nombre);
assert.deepEqual(await miembros(U[0]), ["Lomada"]);
assert.deepEqual(await miembros(U[3]), ["Lomada Viejos"]);
assert.deepEqual(await miembros(U[2]), [], "el que sacaron sigue afuera");
assert.equal((await uno("select count(*)::int n from comidas where grupos is null or cardinality(grupos) = 0 and usuario_id <> $1", [U[2]])).n, 0, "las comidas de antes quedan en su grupo");

// Pepo se suma a los viejos: queda en los dos y pasa a ver el nuevo.
assert.equal((await rol(U[0], () => uno("select public.unirme_a_grupo('viejos1') n"))).n, "Lomada Viejos");
assert.deepEqual(await miembros(U[0]), ["Lomada", "Lomada Viejos"]);
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[0]])).grupo_id, viejos);
assert.deepEqual((await rol(U[0], () => filas("select nombre from grupos order by nombre"))).map((r) => r.nombre), ["Lomada", "Lomada Viejos"]);
assert.deepEqual(await nombres(U[3]), ["Abel", "Pepo"], "los viejos ven a Pepo");
assert.deepEqual(await nombres(U[1]), ["Nahuel", "Pepo"], "y en Lomada sigue");
assert.deepEqual(await nombres(U[0]), ["Abel", "Pepo"], "Pepo ve el grupo que está mirando");

// Publicar en todos, solo en el actual, o elegir.
const publicar = async (desc, grupos) => (await rol(U[0], () => uno(`insert into comidas (usuario_id, tipo, fecha, descripcion, calorias${grupos ? ", grupos" : ""}) values ($1, 'cena', $2, $3, 500${grupos ? ", $4" : ""}) returning id, grupos`, grupos ? [U[0], hoy, desc, grupos] : [U[0], hoy, desc])));
const ve = async (u, desc) => (await rol(U[u], () => filas("select 1 from comidas where descripcion = $1", [desc]))).length === 1;
const enTodos = await publicar("En todos");
assert.equal(enTodos.grupos.length, 2);
assert.ok(await ve(1, "En todos") && await ve(3, "En todos"));
await rol(U[0], () => db.query("update perfiles set publicar_en = 'actual' where id = $1", [U[0]]));
await publicar("Solo actual");
assert.ok(!(await ve(1, "Solo actual")) && await ve(3, "Solo actual"));
const elegida = await publicar("Elegida", [LOMADA, "00000000-0000-4000-8000-0000000000ff"]);
assert.deepEqual(elegida.grupos, [LOMADA], "solo grupos propios");
assert.ok(await ve(1, "Elegida") && !(await ve(3, "Elegida")));
await rol(U[1], () => db.query("insert into comidas (usuario_id, tipo, fecha, descripcion, grupos) values ($1, 'cena', $2, 'Colada', $3)", [U[1], hoy, [viejos]]));
assert.equal((await uno("select grupos from comidas where descripcion = 'Colada'")).grupos[0], LOMADA, "no se publica en un grupo ajeno");
// Editar en qué grupos está.
await rol(U[0], () => db.query("update comidas set grupos = $1 where id = $2", [[viejos], elegida.id]));
assert.ok(!(await ve(1, "Elegida")) && await ve(3, "Elegida"));

// Cambiar el grupo que se ve
await assert.rejects(rol(U[3], () => db.query("select public.cambiar_grupo($1)", [LOMADA])), /no_es_tu_grupo/);
await rol(U[0], () => db.query("select public.cambiar_grupo($1)", [LOMADA]));
assert.deepEqual(await nombres(U[0]), ["Nahuel", "Pepo"]);
await rol(U[0], () => db.query("insert into mensajes (usuario_id, texto) values ($1, 'Hola Lomada')", [U[0]]));
assert.ok((await textos(U[1])).includes("Hola Lomada") && !(await textos(U[3])).includes("Hola Lomada"));

// Avisos: la comida en los dos grupos llega a los dos; el mensaje, a su grupo.
const nueva = (await rol(U[0], () => uno("insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, grupos) values ($1, 'merienda', $2, 'Mate', 100, $3) returning id", [U[0], hoy, [LOMADA, viejos]]))).id;
const aviso = (await rol(U[0], () => uno("select public.destinos_aviso('comida', $1) a", [nueva]))).a;
assert.deepEqual(aviso.destinos.map((d) => d.endpoint).sort(), ["https://p/1", "https://p/3"]);
const mv = (await rol(U[3], () => uno("insert into mensajes (usuario_id, texto) values ($1, 'Che') returning id", [U[3]]))).id;
const av = (await rol(U[3], () => uno("select public.destinos_aviso('mensaje', $1) a", [mv]))).a;
assert.deepEqual(av.destinos.map((d) => [d.endpoint, d.titulo]), [["https://p/0", "Abel en Lomada Viejos"]], "Pepo ve de qué grupo es");
assert.deepEqual((await rol(U[3], () => uno("select public.solo_mi_grupo($1) e", [todos]))).e.sort(), ["https://p/0", "https://p/3"]);

// La caca: Pepo aparece en los dos grupos.
await db.exec("delete from multas; delete from mensajes where bot_multas is not null; update miembros_grupo set unido_en = now() - interval '20 days'");
const anteayer = (await uno("select ($1::date - 2)::text d", [hoy])).d;
await db.query("select public.contar_multas($1)", [anteayer]);
const bots = await filas("select g.nombre, m.texto from mensajes m join grupos g on g.id = m.grupo_id where m.bot_multas = $1 order by g.nombre", [anteayer]);
assert.ok(bots[0].texto.includes("Pepo") && bots[1].texto.includes("Pepo") && bots[1].texto.includes("Abel"), JSON.stringify(bots));
assert.ok(!bots[1].texto.includes("Bocha"));

// Salir de un grupo y que te saquen.
await rol(U[0], () => db.query("select public.cambiar_grupo($1)", [viejos]));
await rol(U[0], () => db.query("select public.salir_de_grupo($1)", [viejos]));
assert.deepEqual(await miembros(U[0]), ["Lomada"]);
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[0]])).grupo_id, LOMADA, "pasa a ver el que le queda");
assert.ok(!(await ve(3, "En todos")), "sus comidas dejan de verse en ese grupo");
assert.equal((await rol(U[0], () => uno("select public.unirme_a_grupo('viejos1') n"))).n, "Lomada Viejos", "si se fue solo, puede volver");
await db.query("delete from miembros_grupo where usuario_id = $1 and grupo_id = $2", [U[1], LOMADA]);
await assert.rejects(rol(U[1], () => db.query("select public.unirme_a_grupo('grupo')")), /codigo_invalido/, "si lo sacaron, no vuelve");
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[1]])).grupo_id, null);
await db.query("select public.destinos_programados('secreta', 'semana')");
await db.query("select public.destinos_caca('secreta', 'caca')");
assert.ok((await uno("select public.destinos_viaje('secreta', 'viaje', '2026-12-11') a")).a.titulo.includes("15 días"));
// Borrar una cuenta no se traba.
await db.query("delete from auth.users where id = $1", [U[3]]);
console.log("036: pruebas pasadas");

// 038: informe semanal
const s038 = fs.readFileSync(raiz + "038_informe_semanal.sql", "utf8");
assert.ok(/^[\x00-\x7f]*$/.test(s038), "038 solo ASCII");
console.log((await db.exec(s038)).at(-1).rows[0].resultado);
await db.exec(s038);
assert.ok((await uno("select command from cron.job where jobname = 'lomada-informe'")).command.includes('"tipo":"informe"'));
// Pepo: dos dias de la semana, 2000 y 1500 kcal (la privada tambien cuenta para el suyo).
const diaInforme = (await uno("select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text d")).d;
await db.exec("alter table comidas disable trigger user");
await db.query("delete from comidas");
await db.query("insert into comidas (usuario_id, tipo, fecha, calorias, proteinas, privada) values ($1, 'almuerzo', $2::date, 1200, 80, false), ($1, 'cena', $2::date, 800, 40, true), ($1, 'cena', $2::date - 3, 1500, 60, false), ($1, 'cena', $2::date - 9, 9000, 1, false)", [U[0], diaInforme]);
await db.exec("alter table comidas enable trigger user");
const inf = (await uno("select public.destinos_informe('secreta', 'informe') a")).a;
console.log(inf.titulo, "|", inf.destinos.map((d) => d.cuerpo));
assert.equal(inf.vista, "informe");
assert.equal(inf.destinos.length, 1, "solo quien cargo algo");
assert.equal(inf.destinos[0].cuerpo, "2 de 7 días cargados. Promedio: 1.750 kcal y 90 g de proteína por día. Tocá para ver tu informe completo.");
await assert.rejects(db.query("select public.destinos_informe('mala', 'informe')"), /clave_invalida/);
await assert.rejects(rol(U[0], () => db.query("select public.destinos_informe('secreta', 'informe')")));
console.log("038: pruebas pasadas");



// ===== 039: eliminar mensajes =====
const s039 = fs.readFileSync(raiz + "039_mensajes_y_fotos.sql", "utf8");
assert.ok([...s039].every((c) => c.charCodeAt(0) < 128), "039 solo ASCII");
console.log((await db.exec(s039)).at(-1).rows[0].resultado);
await db.exec(s039); // Se puede correr dos veces.
const m1 = (await rol(U[0], () => db.query("insert into mensajes (usuario_id, texto, adjunto_path) values ($1, 'Me equivoqué', $2) returning id", [U[0], `${U[0]}/chat/foto.jpg`]))).rows[0].id;
await rol(U[1], () => db.query("insert into reacciones_mensajes (mensaje_id, usuario_id, emoji) values ($1, $2, '😂')", [m1, U[1]]));
// Otro no lo puede borrar.
await assert.rejects(rol(U[1], () => db.query("select public.eliminar_mensaje($1)", [m1])), /no_se_puede_eliminar/);
// El autor sí; devuelve el adjunto para borrar el archivo.
const r = await rol(U[0], () => uno("select public.eliminar_mensaje($1) as adjunto", [m1]));
assert.equal(r.adjunto, `${U[0]}/chat/foto.jpg`);
const borrado = await uno("select texto, adjunto_path, eliminado_en from mensajes where id = $1", [m1]);
assert.equal(borrado.texto, ""); assert.equal(borrado.adjunto_path, null); assert.ok(borrado.eliminado_en);
assert.equal((await uno("select count(*)::int as n from reacciones_mensajes where mensaje_id = $1", [m1])).n, 0);
// Dos veces, no.
await assert.rejects(rol(U[0], () => db.query("select public.eliminar_mensaje($1)", [m1])), /no_se_puede_eliminar/);
// Más de 4 horas, no.
const m2 = (await rol(U[0], () => db.query("insert into mensajes (usuario_id, texto) values ($1, 'Viejo') returning id", [U[0]]))).rows[0].id;
await db.query("update mensajes set creado_en = now() - interval '5 hours' where id = $1", [m2]);
await assert.rejects(rol(U[0], () => db.query("select public.eliminar_mensaje($1)", [m2])), /no_se_puede_eliminar/);
// Sin sesión, no.
await assert.rejects(db.query("set role anon").then(() => db.query("select public.eliminar_mensaje($1)", [m2])).finally(() => db.exec("reset role")));
// Mensajes nuevos vacíos siguen sin poder mandarse.
await assert.rejects(rol(U[0], () => db.query("insert into mensajes (usuario_id, texto) values ($1, '')", [U[0]])));
// Reacciones nuevas a las comidas.
const comidaGuiso = (await rol(U[0], () => db.query("insert into comidas (usuario_id, tipo, descripcion, calorias) values ($1, 'almuerzo', 'Guiso', 500) returning id", [U[0]]))).rows[0].id;
for (const e of ["\u{1F92E}", "\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}", "\u{1F525}"]) await rol(U[1], () => db.query("insert into reacciones (comida_id, usuario_id, emoji) values ($1, $2, $3)", [comidaGuiso, U[1], e]));
assert.equal((await uno("select count(*)::int as n from reacciones where comida_id = $1", [comidaGuiso])).n, 3);
// Fotos extra: hasta 3 más.
await rol(U[0], () => db.query("update comidas set fotos_extra = $2 where id = $1", [comidaGuiso, ["a/1.jpg", "a/2.jpg", "a/3.jpg"]]));
assert.equal((await uno("select cardinality(fotos_extra) as n from comidas where id = $1", [comidaGuiso])).n, 3);
await assert.rejects(rol(U[0], () => db.query("update comidas set fotos_extra = $2 where id = $1", [comidaGuiso, ["1", "2", "3", "4"]])));
console.log("039: pruebas pasadas");

// ===== 040: avisos y postre =====
const s040 = fs.readFileSync(raiz + "040_avisos_y_postre.sql", "utf8");
assert.ok([...s040].every((c) => c.charCodeAt(0) < 128), "040 solo ASCII");
console.log((await db.exec(s040)).at(-1).rows[0].resultado);
await db.exec(s040);
assert.ok((await uno("select command from cron.job where jobname = 'lomada-bocha-evo'")).command.includes("anuncio_caca"));
await db.query("insert into miembros_grupo (usuario_id, grupo_id) values ($1, $2) on conflict do nothing", [U[1], LOMADA]);
await db.query("update perfiles set grupo_id = $2 where id = $1", [U[1], LOMADA]);
await rol(U[0], () => db.query("select public.cambiar_grupo($1)", [LOMADA]));

// Aviso de comida: el titulo de la comida, sin frases.
const c40 = (await rol(U[0], () => uno("insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, foto_path) values ($1, 'almuerzo', $2, 'Milanesa con pure', 2000, 'x/1.jpg') returning id", [U[0], hoy]))).id;
const a40 = (await rol(U[0], () => uno("select public.destinos_aviso('comida', $1) a", [c40]))).a;
assert.equal(a40.titulo, "Pepo \u00B7 Almuerzo");
assert.equal(a40.cuerpo, "Milanesa con pure");
assert.equal(a40.vista, "imagenes");
const c41 = (await rol(U[0], () => uno("insert into comidas (usuario_id, tipo, fecha, calorias) values ($1, 'cena', $2, 300) returning id", [U[0], hoy]))).id;
assert.equal((await rol(U[0], () => uno("select public.destinos_aviso('comida', $1) a", [c41]))).a.cuerpo, "Cena");

// Postre: sin postre no avisa; con postre, el nombre.
assert.equal((await rol(U[0], () => uno("select public.destinos_aviso('postre', $1) a", [c40]))).a, null);
await db.query("update comidas set creado_en = now() - interval '3 hours' where id = $1", [c40]);
await rol(U[0], () => db.query("update comidas set postre_nombre = 'Flan con dulce de leche', postre_foto = 'x/2.jpg', postre_en = '2000-01-01' where id = $1", [c40]));
const pe = await uno("select postre_en > now() - interval '1 minute' as reciente from comidas where id = $1", [c40]);
assert.ok(pe.reciente, "la hora la pone la base");
const ap = (await rol(U[0], () => uno("select public.destinos_aviso('postre', $1) a", [c40]))).a;
assert.equal(ap.titulo, "Pepo sum\u00F3 postre \u{1F36E}");
assert.equal(ap.cuerpo, "Flan con dulce de leche");
assert.ok(ap.destinos.length > 0);
// Otro no puede avisar el postre ajeno.
assert.equal((await rol(U[1], () => uno("select public.destinos_aviso('postre', $1) a", [c40]))).a, null);
// Sin nombre, dice de qué comida.
await rol(U[0], () => db.query("update comidas set postre_nombre = null, postre_en = now() where id = $1", [c40]));
assert.equal((await rol(U[0], () => uno("select public.destinos_aviso('postre', $1) a", [c40]))).a.cuerpo, "Postre de su almuerzo");
await assert.rejects(rol(U[0], () => db.query("update comidas set postre_nombre = repeat('a', 81) where id = $1", [c40])));
// Mensajes siguen igual.
await db.exec("delete from bocha_evo"); // la semana cambia segun el dia en que se corre
const m40 = (await rol(U[1], () => uno("insert into mensajes (usuario_id, texto) values ($1, 'hola @pepo') returning id", [U[1]]))).id;
const am = (await rol(U[1], () => uno("select public.destinos_aviso('mensaje', $1) a", [m40]))).a;
assert.equal(am.cuerpo, "hola @pepo");

// La caca: solo los nuevos.
await db.exec("delete from multas; delete from bocha_evo; delete from mensajes where bot_multas is not null; delete from comidas; update miembros_grupo set unido_en = now() - interval '40 days'; update grupos set creado_en = now() - interval '40 days'");
// Un domingo40 y los días antes.
const domingo40 = (await uno("select (date_trunc('week', now())::date - 1)::text d")).d;
const dias40 = (await filas("select (($1::date - g))::text d from generate_series(6, 0, -1) g", [domingo40])).map((r) => r.d);
const lomadaBot = async (d) => (await uno("select texto from mensajes where bot_multas = $1 and grupo_id = $2", [d, LOMADA]))?.texto;
// Día 1: nadie subió: Pepo y Nahuel nuevos.
await db.query("select public.contar_multas($1)", [dias40[0]]);
let t1 = await lomadaBot(dias40[0]);
assert.ok(t1.includes("Pepo") && t1.includes("Nahuel"), t1);
// Día 2: Pepo sigue sin subir, Nahuel sube: no hay nuevos, no hay mensaje.
await rol(U[1], () => db.query("insert into comidas (usuario_id, tipo, fecha, foto_path) values ($1, 'cena', $2, 'n/1.jpg')", [U[1], dias40[1]]));
await db.query("select public.contar_multas($1)", [dias40[1]]);
assert.equal(await lomadaBot(dias40[1]), undefined, "el que ya tenía caca no se repite");
// Día 3: Nahuel vuelve a caer (nuevo de nuevo), Pepo no se nombra.
await db.query("select public.contar_multas($1)", [dias40[2]]);
t1 = await lomadaBot(dias40[2]);
assert.ok(t1.includes("Nahuel") && !t1.includes("Pepo"), t1);
// Día 4: todos suben.
for (const u of [0, 1]) await rol(U[u], () => db.query("insert into comidas (usuario_id, tipo, fecha, foto_path) values ($1, 'cena', $2, 'z/1.jpg')", [U[u], dias40[3]]));
await db.query("select public.contar_multas($1)", [dias40[3]]);
assert.ok((await lomadaBot(dias40[3])).includes("todos subieron"));
for (const d of dias40.slice(4, 6)) {
  await rol(U[1], () => db.query("insert into comidas (usuario_id, tipo, fecha, foto_path) values ($1, 'cena', $2, 'z/1.jpg')", [U[1], d]));
  await db.query("select public.contar_multas($1)", [d]);
}
assert.ok((await lomadaBot(dias40[4])).includes("Pepo"), "Pepo nuevo el día 5");
assert.equal(await lomadaBot(dias40[5]), undefined);
// Domingo: Pepo sigue, Nahuel sube: no hay nuevos, pero sí el Bocha Evo para Pepo.
await rol(U[1], () => db.query("insert into comidas (usuario_id, tipo, fecha, foto_path) values ($1, 'cena', $2, 'z/1.jpg')", [U[1], dias40[6]]));
await db.query("select public.contar_multas($1)", [dias40[6]]);
const tDom = await lomadaBot(dias40[6]);
assert.ok(tDom.includes("BOCHA EVO para Pepo (6") && !tDom.includes("Cacas de la semana") && !tDom.includes("Nahuel"), tDom);
// El grupo sin Bocha no anuncia nada el domingo40 si no hay nuevos.
const viejosBot = await uno("select texto from mensajes where bot_multas = $1 and grupo_id = $2", [dias40[6], viejos]);
assert.ok(!viejosBot || !viejosBot.texto.includes("BOCHA"), JSON.stringify(viejosBot));

// El aviso del lunes del Bocha Evo.
await db.exec("update bocha_evo set semana = date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date");
const ev = (await uno("select public.destinos_caca('secreta', 'anuncio_caca') a")).a;
console.log(JSON.stringify(ev.destinos.map((d) => [d.endpoint, d.titulo, d.cuerpo])));
const paraPepo = ev.destinos.find((d) => d.endpoint === "https://p/0");
assert.equal(paraPepo.titulo, "\u{1F4A9} Te cay\u00F3 el BOCHA EVO");
assert.equal(paraPepo.cuerpo, null);
assert.ok(ev.destinos.some((d) => d.cuerpo && d.cuerpo.startsWith("A Pepo:")));
await db.exec("delete from bocha_evo");
assert.equal((await uno("select public.destinos_caca('secreta', 'anuncio_caca') a")).a, null, "sin Bocha Evo no avisa");
await assert.rejects(db.query("select public.destinos_caca('mala', 'anuncio_caca')"), /clave_invalida/);
console.log("040: pruebas pasadas");
await rol(U[0], () => db.query("insert into medallas (usuario_id, codigo) values ($1, 'fotografo:2')", [U[0]]));
const amd = (await rol(U[0], () => uno("select public.aviso_medalla('fotografo:2', $1) a", ["Lleg\u00F3 a Oro \u{1F947}"]))).a;
assert.equal(amd.titulo, "Pepo subi\u00F3 de categor\u00EDa");
assert.equal(amd.cuerpo, "Lleg\u00F3 a Oro \u{1F947}");
console.log("040 medalla: ok");

// ===== 041 completo =====
const s041 = fs.readFileSync(raiz + "041_gol_de_la_noche.sql", "utf8");
assert.ok(/^[\x00-\x7f]*$/.test(s041), "041 solo ASCII");
console.log((await db.exec(s041)).at(-1).rows[0].resultado);
await db.exec(s041);

// Gol
const f41 = (await rol(U[0], () => uno("insert into comidas (usuario_id, tipo, fecha, calorias, gol, foto_path, fotos_extra, grupos) values ($1, 'fiesta', $2, 400, false, $3, $4, $5) returning id, gol", [U[0], hoy, `${U[0]}/noche1.jpg`, [`${U[0]}/noche2.jpg`], [LOMADA]])));
assert.equal(f41.gol, false);
await rol(U[0], () => db.query("update comidas set gol = true where id = $1", [f41.id]));
assert.equal((await rol(U[1], () => uno("select gol from comidas where id = $1", [f41.id]))).gol, true, "el grupo lo ve");

// Fotos extra: ahora el grupo las ve.
await db.exec(`insert into storage.objects (bucket_id, name) values ('fotos', '${U[0]}/noche1.jpg'), ('fotos', '${U[0]}/noche2.jpg'), ('fotos', '${U[0]}/suelta.jpg')`);
const ve41 = async (u) => (await rol(u, () => filas("select name from storage.objects where name like '%noche%' or name like '%suelta%' order by name"))).map((r) => r.name.split("/")[1]);
assert.deepEqual(await ve41(U[1]), ["noche1.jpg", "noche2.jpg"], "la extra se ve; la suelta no");

// Salida: Pepo invita a Nahuel.
await rol(U[0], () => db.query("update comidas set salida = id, salida_con = $2 where id = $1", [f41.id, [U[1]]]));
const as = (await rol(U[0], () => uno("select public.aviso_salida($1) a", [f41.id]))).a;
assert.equal(as.vista, "fiesta");
assert.deepEqual(as.destinos.map((d) => d.endpoint), ["https://p/1"]);
assert.match(as.titulo, /Pepo te sum/);
// Nahuel se suma: ya no le llega.
await rol(U[1], () => db.query("insert into comidas (usuario_id, tipo, fecha, calorias, salida) values ($1, 'fiesta', $2, 190, $3)", [U[1], hoy, f41.id]));
assert.equal((await rol(U[0], () => uno("select public.aviso_salida($1) a", [f41.id]))).a.destinos.length, 0);
// Otro no puede usar la salida ajena para avisar.
assert.equal((await rol(U[1], () => uno("select public.aviso_salida($1) a", [f41.id]))).a, null);

// Reacciones: solo al dueño.
await rol(U[1], () => db.query("insert into reacciones (comida_id, usuario_id, emoji) values ($1, $2, '\u{1F525}')", [f41.id, U[1]]));
const ar = (await rol(U[1], () => uno("select public.aviso_reaccion('comida', $1, '\u{1F525}') a", [f41.id]))).a;
assert.deepEqual(ar.destinos.map((d) => d.endpoint), ["https://p/0"]);
assert.match(ar.titulo, /^Nahuel reaccionó \u{1F525} a tu foto$/u);
// Sin reacción propia no avisa; a uno mismo tampoco.
assert.equal((await rol(U[1], () => uno("select public.aviso_reaccion('comida', $1, '\u{1F602}') a", [f41.id]))).a, null);
await rol(U[0], () => db.query("insert into reacciones (comida_id, usuario_id, emoji) values ($1, $2, '\u{1F525}')", [f41.id, U[0]]));
assert.equal((await rol(U[0], () => uno("select public.aviso_reaccion('comida', $1, '\u{1F525}') a", [f41.id]))).a, null);
// Mensaje
const msg41 = (await rol(U[0], () => uno("insert into mensajes (usuario_id, texto) values ($1, 'quien sale hoy') returning id", [U[0]]))).id;
await rol(U[1], () => db.query("insert into reacciones_mensajes (mensaje_id, usuario_id, emoji) values ($1, $2, '\u{1F602}')", [msg41, U[1]]));
const arm = (await rol(U[1], () => uno("select public.aviso_reaccion('mensaje', $1, '\u{1F602}') a", [msg41]))).a;
assert.equal(arm.cuerpo, "quien sale hoy");
assert.equal(arm.vista, "chat");
assert.deepEqual(arm.destinos.map((d) => d.endpoint), ["https://p/0"]);
await assert.rejects(rol(U[1], () => db.query("select public.aviso_reaccion('otra', $1, 'x')", [msg41])), /tipo_invalido/);
console.log("041: pruebas pasadas");

// ===== 042: fotos de recetas =====
const s042 = fs.readFileSync(raiz + "042_fotos_de_recetas.sql", "utf8");
assert.ok(/^[\x00-\x7f]*$/.test(s042), "042 solo ASCII");
console.log((await db.exec(s042)).at(-1).rows[0].resultado);
await db.exec(s042);
await rol(U[0], () => db.query("insert into recetas_propias (usuario_id, nombre, compartida, fotos) values ($1, 'Budin', true, $2), ($1, 'Secreta', false, $3)", [U[0], [`${U[0]}/recetas/budin.jpg`], [`${U[0]}/recetas/secreta.jpg`]]));
await db.exec(`insert into storage.objects (bucket_id, name) values ('fotos', '${U[0]}/recetas/budin.jpg'), ('fotos', '${U[0]}/recetas/secreta.jpg')`);
const veRecetas = async (u) => (await rol(u, () => filas("select name from storage.objects where name like '%/recetas/%' order by name"))).map((r) => r.name.split("/").pop());
assert.deepEqual(await veRecetas(U[1]), ["budin.jpg"], "la compartida se ve; la secreta no");
assert.deepEqual(await veRecetas(U[0]), ["budin.jpg", "secreta.jpg"], "las propias, todas");
await assert.rejects(rol(U[0], () => db.query("update recetas_propias set fotos = $1 where nombre = 'Budin'", [["1", "2", "3", "4", "5"]])), "hasta 4");
// Lo de antes sigue: las fotos extra de comidas.
assert.deepEqual(await ve41(U[1]), ["noche1.jpg", "noche2.jpg"]);
console.log("042: pruebas pasadas");

// ===== 043: registros del dia =====
const s043 = fs.readFileSync(raiz + "043_registros_diarios.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s043), "043 solo ASCII");
console.log((await db.exec(s043)).at(-1).rows[0].resultado);
await db.exec(s043);
assert.ok((await uno("select command from cron.job where jobname = 'lomada-registros'")).command.includes('"tipo":"registros"'));
const hoy43 = (await uno("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).d;
// Pepo: creatina y gym; Nahuel: magnesio sin aviso; Ramiro: gym
await rol(U[0], () => db.query("insert into registros_config (usuario_id, activos) values ($1, '{creatina,gym}')", [U[0]]));
await rol(U[1], () => db.query("insert into registros_config (usuario_id, activos, aviso) values ($1, '{magnesio}', false)", [U[1]]));
await rol(U[2], () => db.query("insert into registros_config (usuario_id, activos) values ($1, '{gym}')", [U[2]]));
await assert.rejects(rol(U[0], () => db.query("insert into registros_config (usuario_id, activos) values ($1, '{gym}')", [U[1]])), "no la de otro");
await assert.rejects(rol(U[0], () => db.query("update registros_config set activos = '{proteina}' where usuario_id = $1", [U[0]])), "solo los conocidos");
await rol(U[0], () => db.query("insert into registros_diarios (usuario_id, fecha, codigo) values ($1, $2, 'gym')", [U[0], hoy43]));
await assert.rejects(rol(U[0], () => db.query("insert into registros_diarios (usuario_id, fecha, codigo) values ($1, $2, 'gym')", [U[1], hoy43])), "no por otro");
// Privados: Nahuel no ve lo de Pepo
assert.equal((await rol(U[1], () => uno("select count(*)::int n from registros_diarios"))).n, 0);
assert.equal((await rol(U[1], () => uno("select count(*)::int n from registros_config"))).n, 1);
assert.equal((await rol(U[0], () => uno("select count(*)::int n from registros_diarios"))).n, 1);
// El aviso
const av43 = (await uno("select public.destinos_registros('secreta', 'registros') a")).a;
const por = Object.fromEntries(av43.destinos.map((d) => [d.endpoint, d]));
console.log(av43.destinos.map((d) => `${d.endpoint}: ${d.titulo} | ${d.cuerpo}`));
assert.equal(por["https://p/0"].titulo, "\u00BFYa tomaste la creatina?", "el gym ya lo tildo");
assert.equal(por["https://p/1"], undefined, "Nahuel sin aviso");
assert.match(por["https://p/2"].titulo, /Fuiste al gym/);
await rol(U[0], () => db.query("insert into registros_diarios (usuario_id, fecha, codigo) values ($1, $2, 'creatina')", [U[0], hoy43]));
await rol(U[1], () => db.query("update registros_config set aviso = true, activos = '{creatina,magnesio,gym}' where usuario_id = $1", [U[1]]));
const av43b = (await uno("select public.destinos_registros('secreta', 'registros') a")).a;
const por2 = Object.fromEntries(av43b.destinos.map((d) => [d.endpoint, d]));
assert.equal(por2["https://p/0"], undefined, "Pepo ya tildo todo");
assert.equal(por2["https://p/1"].titulo, "\u00BFYa tomaste la creatina y el magnesio?");
assert.match(por2["https://p/1"].cuerpo, /gym/);
await assert.rejects(db.query("select public.destinos_registros('mala', 'registros')"), /clave_invalida/);
assert.equal((await uno("select public.destinos_registros('secreta', 'otro') a")).a, null);
// Borrar el tilde
await rol(U[0], () => db.query("delete from registros_diarios where usuario_id = $1 and codigo = 'creatina'", [U[0]]));
assert.equal((await rol(U[0], () => uno("select count(*)::int n from registros_diarios"))).n, 1);
console.log("043: pruebas pasadas");

// ===== 044: mejora hecha desde la base =====
const s044 = fs.readFileSync(raiz + "044_mejora_hecha_desde_la_base.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s044), "044 solo ASCII y sin nulos");
await db.exec("create table net.pedidos (cuerpo jsonb); create or replace function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer) returns bigint language sql as $$ insert into net.pedidos values (body) returning 1::bigint $$;");
console.log((await db.exec(s044)).at(-1).rows[0].resultado);
await db.exec(s044);
const mj1 = (await rol(U[1], () => uno("insert into mejoras (usuario_id, texto) values ($1, 'Quiero ver la creatina') returning id", [U[1]]))).id;
const mj0 = (await rol(U[0], () => uno("insert into mejoras (usuario_id, texto) values ($1, 'La mia') returning id", [U[0]]))).id;
await db.exec("insert into administradores (usuario_id) values ('" + U[0] + "') on conflict do nothing");
// Pepo (admin) marca la de Nahuel desde la app: sale el pedido con el id.
await rol(U[0], () => db.query("update mejoras set hecha = true where id = $1", [mj1]));
let ped = (await filas("select cuerpo from net.pedidos")).map((r) => r.cuerpo);
assert.deepEqual(ped, [{ tipo: "mejora_hecha", id: mj1 }]);
// La propia no se avisa a uno mismo; volver a guardar hecha tampoco repite.
await rol(U[0], () => db.query("update mejoras set hecha = true where id in ($1, $2)", [mj0, mj1]));
assert.equal((await filas("select cuerpo from net.pedidos")).length, 1);
// Desde el SQL Editor (sin sesion) tambien avisa, incluso la propia.
await db.query("update mejoras set hecha = false where id = $1", [mj0]);
await db.query("update mejoras set hecha = true where id = $1", [mj0]);
assert.equal((await filas("select cuerpo from net.pedidos")).length, 2);
// Destinos: solo a quien la pidio
const d44 = (await uno("select public.destinos_mejora_hecha('secreta', 'mejora_hecha', $1) a", [mj1])).a;
assert.deepEqual(d44.destinos.map((d) => d.endpoint), ["https://p/1"]);
assert.match(d44.titulo, /Ya est\u00E1 tu mejora/);
assert.equal(d44.cuerpo, "Quiero ver la creatina");
await assert.rejects(db.query("select public.destinos_mejora_hecha('mala', 'mejora_hecha', $1)", [mj1]), /clave_invalida/);
await db.query("update mejoras set hecha = false where id = $1", [mj1]);
assert.equal((await uno("select public.destinos_mejora_hecha('secreta', 'mejora_hecha', $1) a", [mj1])).a, null, "si se reabrio, nada");
// La app ya no manda el suyo
assert.equal((await rol(U[0], () => uno("select public.aviso_mejora_hecha($1) a", [mj1]))).a, null);
// Nahuel no puede marcar
await rol(U[1], () => db.query("update mejoras set hecha = true where id = $1", [mj1]));
assert.equal((await uno("select hecha from mejoras where id = $1", [mj1])).hecha, false);
console.log("044: pruebas pasadas");

// ===== 045: capturas de MyFitnessPal =====
const s045 = fs.readFileSync(raiz + "045_capturas_de_myfitnesspal.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s045), "045 solo ASCII y sin nulos");
console.log((await db.exec(s045)).at(-1).rows[0].resultado);
await db.exec(s045);
await db.exec("delete from tokens_salud");
await db.query("insert into tokens_salud (usuario_id, token_hash) values ($1, encode(extensions.digest('llave0', 'sha256'), 'hex')), ($2, encode(extensions.digest('llave1', 'sha256'), 'hex'))", [U[0], U[1]]);
assert.equal((await uno("select public.llave_salud_valida('llave0') v")).v, true);
assert.equal((await uno("select public.llave_salud_valida('otra') v")).v, false);
await db.query("set role anon");
const idc = (await uno("select public.guardar_captura_salud('llave0', $1) id", ["Cena 650\nMilanesa\n200 g 480 kcal"])).id;
await db.query("reset role");
assert.ok(idc);
await assert.rejects(db.query("select public.guardar_captura_salud('mala', 'x')"), /token_invalido/);
await assert.rejects(db.query("select public.guardar_captura_salud('llave0', '   ')"), /valores_invalidos/);
await assert.rejects(db.query("select public.guardar_captura_salud('llave0', $1)", ["x".repeat(12001)]), /valores_invalidos/);
// Privadas
assert.equal((await rol(U[0], () => uno("select count(*)::int n from salud_capturas"))).n, 1);
assert.equal((await rol(U[1], () => uno("select count(*)::int n from salud_capturas"))).n, 0);
await assert.rejects(rol(U[0], () => db.query("insert into salud_capturas (usuario_id, fecha, texto) values ($1, current_date, 'x')", [U[0]])), "no se escribe a mano");
await rol(U[1], () => db.query("delete from salud_capturas"));
assert.equal((await uno("select count(*)::int n from salud_capturas")).n, 1, "Nahuel no borra la de otro");
// Las viejas se borran solas
await db.query("update salud_capturas set creado_en = now() - interval '4 days'");
await db.query("select public.guardar_captura_salud('llave0', 'Cena 1')");
assert.equal((await uno("select count(*)::int n from salud_capturas")).n, 1);
await rol(U[0], () => db.query("delete from salud_capturas"));
assert.equal((await uno("select count(*)::int n from salud_capturas")).n, 0, "la propia se puede borrar");
console.log("045: pruebas pasadas");

// ===== 046: crear grupos y admin que acepta =====
const s046 = fs.readFileSync(raiz + "046_crear_grupos_y_admin.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s046), "046 solo ASCII y sin nulos");
console.log("antes:", JSON.stringify(await filas("select g.nombre, array_agg(p.nombre order by m.unido_en) gente from grupos g left join miembros_grupo m on m.grupo_id = g.id left join perfiles p on p.id = m.usuario_id group by g.nombre")));
console.log((await db.exec(s046)).at(-1).rows[0].resultado);
await db.exec(s046);
await db.exec("delete from net.pedidos");
const pedidos46 = async () => (await filas("select cuerpo from net.pedidos")).map((r) => r.cuerpo);
assert.equal((await uno("select creado_por from grupos where id = $1", [LOMADA])).creado_por, U[0], "Lomada: el admin de la app");
console.log("admin de viejos:", (await uno("select creado_por from grupos where codigo = 'viejos1'")).creado_por);

// Crear un grupo
const nuevoG = (await rol(U[2], () => uno("select public.crear_grupo('  Los   Pibés ') g"))).g;
assert.equal(nuevoG.nombre, "Los Pibés");
assert.match(nuevoG.codigo, /^lospibes-\d{4}$/);
const pibes = nuevoG.id;
assert.equal((await uno("select con_bocha from grupos where id = $1", [pibes])).con_bocha, false, "sin Bocha");
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[2]])).grupo_id, pibes, "pasa a verlo");
assert.deepEqual((await rol(U[2], () => uno("select public.grupos_que_administro() g"))).g, [pibes]);
await assert.rejects(rol(U[2], () => db.query("select public.crear_grupo('x')")), /nombre_invalido/);
await rol(U[2], () => db.query("select public.crear_grupo('Dos')"));
await rol(U[2], () => db.query("select public.crear_grupo('Tres')"));
await assert.rejects(rol(U[2], () => db.query("select public.crear_grupo('Cuatro')")), /demasiados_grupos/);
await rol(U[2], () => db.query("select public.cambiar_grupo($1)", [pibes]));

// Pedir entrar: queda pendiente y avisa al admin
const pedido1 = (await rol(U[1], () => uno("select public.pedir_entrar_a_grupo($1) r", [nuevoG.codigo.toUpperCase()]))).r;
assert.equal(pedido1.estado, "pendiente");
assert.equal(pedido1.nombre, "Los Pibés");
assert.equal((await uno("select count(*)::int n from miembros_grupo where usuario_id = $1 and grupo_id = $2", [U[1], pibes])).n, 0, "todavia no entra");
assert.equal((await rol(U[1], () => uno("select public.pedir_entrar_a_grupo($1) r", [nuevoG.codigo]))).r.estado, "pendiente", "no duplica");
const p46 = await pedidos46();
assert.equal(p46.length, 1);
assert.equal(p46[0].tipo, "solicitud_grupo");
const sol1 = p46[0].id;
assert.deepEqual((await rol(U[1], () => filas("select nombre from public.mis_solicitudes()"))).map((r) => r.nombre), ["Los Pibés"]);
await assert.rejects(rol(U[1], () => db.query("select * from solicitudes_grupo")), /permission denied/, "la tabla no se lee directo");
await assert.rejects(rol(U[2], () => db.query("insert into miembros_grupo (usuario_id, grupo_id) values ($1, $2)", [U[1], pibes])), "no se mete a mano");
await assert.rejects(rol(U[1], () => db.query("insert into miembros_grupo (usuario_id, grupo_id) values ($1, $2)", [U[1], pibes])), "ni uno mismo");
await assert.rejects(rol(U[1], () => db.query("select public.pedir_entrar_a_grupo('nada-0000')")), /codigo_invalido/);
// La funcion vieja tambien pide (no mete directo)
assert.equal((await rol(U[0], () => uno("select public.unirme_a_grupo($1) r", [nuevoG.codigo]))).r, "Los Pibés");
assert.equal((await uno("select count(*)::int n from miembros_grupo where usuario_id = $1 and grupo_id = $2", [U[0], pibes])).n, 0);

// Solo el admin ve y responde
await assert.rejects(rol(U[0], () => db.query("select * from public.solicitudes_de_grupo($1)", [pibes])), /no_sos_admin/);
await assert.rejects(rol(U[1], () => db.query("select public.responder_solicitud($1, true)", [sol1])), /no_sos_admin/);
await assert.rejects(rol(U[1], () => db.query("select public.codigo_de_grupo($1)", [pibes])), /no_sos_admin/);
assert.equal((await rol(U[2], () => uno("select public.codigo_de_grupo($1) c", [pibes]))).c, nuevoG.codigo);
assert.deepEqual((await rol(U[2], () => filas("select nombre from public.solicitudes_de_grupo($1)", [pibes]))).map((r) => r.nombre), ["Nahuel", "Pepo"]);
assert.equal((await rol(U[2], () => uno("select public.pedidos_pendientes() n"))).n, 2);
assert.equal((await rol(U[1], () => uno("select public.pedidos_pendientes() n"))).n, 0);

// Aviso al admin
const dS = (await uno("select public.destinos_grupo('secreta', 'solicitud_grupo', $1) a", [sol1])).a;
assert.deepEqual(dS.destinos.map((d) => d.endpoint), ["https://p/2"]);
assert.match(dS.titulo, /Nahuel quiere entrar a Los Pibés/);
await assert.rejects(db.query("select public.destinos_grupo('mala', 'solicitud_grupo', $1)", [sol1]), /clave_invalida/);
assert.equal((await uno("select public.destinos_grupo('secreta', 'grupo_aceptado', $1) a", [sol1])).a, null, "todavia no lo aceptaron");

// Aceptar
await db.exec("delete from net.pedidos");
const vistaNahuel = (await uno("select grupo_id from perfiles where id = $1", [U[1]])).grupo_id;
await rol(U[2], () => db.query("select public.responder_solicitud($1, true)", [sol1]));
assert.equal((await uno("select count(*)::int n from miembros_grupo where usuario_id = $1 and grupo_id = $2", [U[1], pibes])).n, 1, "entro");
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U[1]])).grupo_id, vistaNahuel, "sigue viendo el suyo");
assert.deepEqual(await pedidos46(), [{ tipo: "grupo_aceptado", id: sol1 }]);
const dA = (await uno("select public.destinos_grupo('secreta', 'grupo_aceptado', $1) a", [sol1])).a;
assert.deepEqual(dA.destinos.map((d) => d.endpoint), ["https://p/1"]);
assert.match(dA.titulo, /Ya estás en Los Pibés/);
await assert.rejects(rol(U[2], () => db.query("select public.responder_solicitud($1, true)", [sol1])), /sin_pedido/, "no se responde dos veces");
assert.equal((await rol(U[1], () => uno("select public.pedir_entrar_a_grupo($1) r", [nuevoG.codigo]))).r.estado, "ya_estas");
assert.ok((await rol(U[1], () => filas("select nombre from grupos"))).some((r) => r.nombre === "Los Pibés"), "Nahuel ve el grupo");

// Rechazar
const sol0 = (await rol(U[2], () => uno("select id from public.solicitudes_de_grupo($1)", [pibes]))).id;
await rol(U[2], () => db.query("select public.responder_solicitud($1, false)", [sol0]));
assert.equal((await uno("select count(*)::int n from miembros_grupo where usuario_id = $1 and grupo_id = $2", [U[0], pibes])).n, 0);
assert.equal((await uno("select estado from solicitudes_grupo where id = $1", [sol0])).estado, "rechazada");
assert.deepEqual(await rol(U[0], () => filas("select * from public.mis_solicitudes()")), []);
// Puede volver a pedir y cancelar
await rol(U[0], () => db.query("select public.pedir_entrar_a_grupo($1)", [nuevoG.codigo]));
await rol(U[0], () => db.query("select public.cancelar_solicitud($1)", [pibes]));
assert.deepEqual(await rol(U[0], () => filas("select * from public.mis_solicitudes()")), []);

// Sacar a alguien: no vuelve con el codigo
await assert.rejects(rol(U[1], () => db.query("select public.sacar_de_grupo($1, $2)", [pibes, U[2]])), /no_sos_admin/);
await assert.rejects(rol(U[2], () => db.query("select public.sacar_de_grupo($1, $2)", [pibes, U[2]])), /no_a_vos/);
await rol(U[2], () => db.query("select public.sacar_de_grupo($1, $2)", [pibes, U[1]]));
assert.equal((await uno("select count(*)::int n from miembros_grupo where usuario_id = $1 and grupo_id = $2", [U[1], pibes])).n, 0);
await assert.rejects(rol(U[1], () => db.query("select public.pedir_entrar_a_grupo($1)", [nuevoG.codigo])), /codigo_invalido/);

// Registrarse: con codigo queda el pedido; sin codigo, sin grupo; inventar el grupo no sirve
const U4 = "55555555-5555-4555-8555-555555555555", U5 = "66666666-6666-4666-8666-666666666666", U6 = "77777777-7777-4777-8777-777777777777";
assert.equal((await uno("select public.revisar_registro('nuevo4', '') r")).r, "ok");
assert.equal((await uno("select public.revisar_registro('nuevo4', $1) r", [nuevoG.codigo])).r, "ok");
assert.equal((await uno("select public.revisar_registro('nuevo4', 'nada') r")).r, "codigo");
await db.exec("delete from net.pedidos");
await db.query("insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, 'u4@p.test', 'x', $2)", [U4, JSON.stringify({ usuario: "nuevo4", nombre: "Cuatro", codigo_grupo: nuevoG.codigo })]);
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U4])).grupo_id, null, "sin grupo hasta que acepten");
assert.deepEqual((await rol(U4, () => filas("select nombre from public.mis_solicitudes()"))).map((r) => r.nombre), ["Los Pibés"]);
assert.equal((await pedidos46())[0].tipo, "solicitud_grupo");
await db.query("insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, 'u5@p.test', 'x', $2)", [U5, JSON.stringify({ usuario: "nuevo5", nombre: "Cinco", grupo_id: LOMADA, grupo_pedido: LOMADA })]);
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U5])).grupo_id, null, "no se mete inventando el grupo");
assert.equal((await uno("select count(*)::int n from miembros_grupo where usuario_id = $1", [U5])).n, 0);
assert.equal((await uno("select count(*)::int n from solicitudes_grupo where usuario_id = $1", [U5])).n, 0);
await assert.rejects(db.query("insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, 'u6@p.test', 'x', $2)", [U6, JSON.stringify({ usuario: "nuevo6", nombre: "Seis", codigo_grupo: "nada" })]), /codigo_invalido/);
// Aceptado sin grupo: pasa a ver ese
const sol4 = (await rol(U[2], () => filas("select id, nombre from public.solicitudes_de_grupo($1)", [pibes]))).find((r) => r.nombre === "Cuatro").id;
await rol(U[2], () => db.query("select public.responder_solicitud($1, true)", [sol4]));
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U4])).grupo_id, pibes);
// Cinco crea el suyo
const g5 = (await rol(U5, () => uno("select public.crear_grupo('Cinco FC') g"))).g;
assert.equal((await uno("select grupo_id from perfiles where id = $1", [U5])).grupo_id, g5.id);

// Salir: si se va el admin, queda el que mas lleva; si no queda nadie, se borra
await rol(U[2], () => db.query("select public.salir_de_grupo($1)", [pibes]));
assert.equal((await uno("select creado_por from grupos where id = $1", [pibes])).creado_por, U4, "Cuatro administra");
await rol(U4, () => db.query("select public.salir_de_grupo($1)", [pibes]));
assert.equal((await uno("select count(*)::int n from grupos where id = $1", [pibes])).n, 0, "grupo vacio se borra");
console.log("046: pruebas pasadas");

// ===== 047: aviso de espacio =====
const s047 = fs.readFileSync(raiz + "047_aviso_de_espacio.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s047), "047 solo ASCII y sin nulos");
const colsObj = (await filas("select column_name from information_schema.columns where table_schema = 'storage' and table_name = 'objects'")).map((r) => r.column_name);
console.log("storage.objects:", colsObj.join(","));
if (!colsObj.includes("metadata")) await db.exec("alter table storage.objects add column metadata jsonb");
if (!colsObj.includes("created_at")) await db.exec("alter table storage.objects add column created_at timestamptz default now()");
console.log((await db.exec(s047)).at(-1).rows[0].resultado);
await db.exec(s047);
assert.ok((await uno("select command from cron.job where jobname = 'lomada-uso'")).command.includes('{"tipo":"uso"}'));
// Solo admins ven el uso
const uso0 = (await rol(U[0], () => uno("select public.uso_de_la_app() u"))).u;
assert.equal(uso0.fotos_limite, 1073741824);
await assert.rejects(rol(U[1], () => db.query("select public.uso_de_la_app()")), /no_sos_admin/);
await assert.rejects(rol(U[1], () => db.query("select * from uso_avisos")), /permission denied/);
// Sin llenar: nada que avisar
assert.equal((await uno("select public.destinos_uso('secreta', 'uso') a")).a, null);
await assert.rejects(db.query("select public.destinos_uso('mala', 'uso')"), /clave_invalida/);
// Fotos al 72%: avisa una vez
const nombreCol = colsObj.includes("bucket_id") ? "bucket_id, name, metadata" : "name, metadata";
const valores = colsObj.includes("bucket_id") ? "'fotos', 'u/grande.jpg', $1" : "'u/grande.jpg', $1";
await db.query(`insert into storage.objects (${nombreCol}) values (${valores})`, [{ size: Math.round(1073741824 * 0.72) }]);
const a1 = (await uno("select public.destinos_uso('secreta', 'uso') a")).a;
console.log(a1.titulo, "|", a1.cuerpo);
assert.match(a1.titulo, /las fotos al 7[12]% \(737 de 1024 MB\)/);
assert.deepEqual(a1.destinos.map((d) => d.endpoint), ["https://p/0"], "solo al admin");
assert.equal((await uno("select public.destinos_uso('secreta', 'uso') a")).a, null, "no repite");
// Sube a 96%: avisa de nuevo y urgente
await db.query("update storage.objects set metadata = $1 where name = 'u/grande.jpg'", [{ size: Math.round(1073741824 * 0.96) }]);
const a2 = (await uno("select public.destinos_uso('secreta', 'uso') a")).a;
assert.match(a2.titulo, /9[56]%/);
assert.match(a2.cuerpo, /reducir ya/);
// Se libera: baja sin avisar, y si vuelve a subir avisa otra vez
await db.query("delete from storage.objects where name = 'u/grande.jpg'");
assert.equal((await uno("select public.destinos_uso('secreta', 'uso') a")).a, null);
assert.equal((await uno("select nivel from uso_avisos where clave = 'fotos'")).nivel, 0);
// IA sin cupo: un aviso por dia
await db.exec("delete from net.pedidos");
await db.query("set role anon");
await db.query("select public.anotar_ia_sin_cupo()");
await db.query("select public.anotar_ia_sin_cupo()");
await db.query("reset role");
assert.deepEqual((await filas("select cuerpo from net.pedidos")).map((r) => r.cuerpo), [{ tipo: "ia_sin_cupo" }]);
const a3 = (await uno("select public.destinos_uso('secreta', 'ia_sin_cupo') a")).a;
assert.match(a3.titulo, /La IA gratis llegó al límite/);
assert.ok((await rol(U[0], () => uno("select public.uso_de_la_app() u"))).u.ia_sin_cupo, "queda la fecha");
await db.query("update uso_avisos set fecha = fecha - 1 where clave = 'ia'");
await db.query("select public.anotar_ia_sin_cupo()");
assert.equal((await filas("select cuerpo from net.pedidos")).length, 2, "otro dia, otro aviso");
console.log("047: pruebas pasadas");

// ===== 048: duenio, mejoras por grupo, avisos a medida =====
const s048 = fs.readFileSync(raiz + "048_dueno_mejoras_y_avisos.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s048), "048 solo ASCII y sin nulos");
const r048 = (await db.exec(s048)).at(-1).rows[0].resultado;
console.log(r048);
assert.match(r048, /Duenio: Pepo/);
await db.exec(s048);
assert.equal((await uno("select count(*)::int n from dueno_app")).n, 1, "no se duplica");
// Solo el duenio
assert.equal((await rol(U[0], () => uno("select public.es_dueno() d"))).d, true);
assert.equal((await rol(U[1], () => uno("select public.es_dueno() d"))).d, false);
await assert.rejects(rol(U[1], () => db.query("select public.uso_de_la_app()")), /no_sos_dueno/);
await assert.rejects(rol(U[1], () => db.query("select * from public.admin_usuarios()")), /no_sos_dueno/);
await assert.rejects(rol(U[1], () => db.query("select public.admin_insights()")), /no_sos_dueno/);
await assert.rejects(rol(U[1], () => db.query("select * from dueno_app")), /permission denied/);
// Otro administrador de la app (no duenio) tampoco ve el espacio
await db.exec("insert into administradores (usuario_id) values ('" + U[1] + "') on conflict do nothing");
await assert.rejects(rol(U[1], () => db.query("select public.uso_de_la_app()")), /no_sos_dueno/);
await db.query("delete from administradores where usuario_id = $1", [U[1]]);
// Panel
const usuarios = await rol(U[0], () => filas("select * from public.admin_usuarios()"));
console.log("usuarios:", usuarios.map((u) => `${u.nombre} [${u.grupos}] ${u.comidas}`).join(" | "));
assert.ok(usuarios.length >= 4);
assert.ok(usuarios.some((u) => u.nombre === "Cinco" && u.grupos.includes("Cinco FC")));
const ins = (await rol(U[0], () => uno("select public.admin_insights() i"))).i;
console.log("insights:", JSON.stringify({ ...ins, por_dia: ins.por_dia.length, por_hora: ins.por_hora.length }));
assert.equal(ins.por_dia.length, 14);
assert.equal(ins.por_hora.length, 24);
assert.ok(ins.usuarios >= 4);
assert.ok(Array.isArray(ins.grupos_lista));
// Avisos de espacio: solo al duenio
await db.query("insert into storage.objects (bucket_id, name, metadata) values ('fotos', 'u/grande2.jpg', $1)", [{ size: Math.round(1073741824 * 0.8) }]);
await db.query("delete from uso_avisos where clave = 'fotos'");
const au = (await uno("select public.destinos_uso('secreta', 'uso') a")).a;
assert.deepEqual(au.destinos.map((d) => d.endpoint), ["https://p/0"]);
assert.match(au.cuerpo, /Panel del dueño/);
await db.query("delete from storage.objects where name = 'u/grande2.jpg'");

// Mejoras por grupo
const gV = (await uno("select id from grupos where codigo = 'viejos1'")).id;
await db.query("insert into miembros_grupo (usuario_id, grupo_id) values ($1, $2) on conflict do nothing", [U[1], gV]);
await db.exec("set prueba.uid = '" + U[1] + "'; set lomada.cambiar_grupo = 'si'");
await db.query("update perfiles set grupo_id = $1 where id = $2", [gV, U[1]]);
await db.exec("reset lomada.cambiar_grupo; set prueba.uid = ''");
const mV = (await rol(U[1], () => uno("insert into mejoras (usuario_id, texto) values ($1, 'Pedido desde Viejos') returning id, grupo_id", [U[1]])));
assert.equal(mV.grupo_id, gV, "queda en el grupo que estaba viendo");
await db.query("update perfiles set grupo_id = $1 where id = $2", [LOMADA, U[1]]).catch(async () => {
  await db.exec("set lomada.cambiar_grupo = 'si'"); await db.query("update perfiles set grupo_id = $1 where id = $2", [LOMADA, U[1]]); await db.exec("reset lomada.cambiar_grupo");
});
// Un tercero de Lomada (Cuatro no, ya salio; usamos a Pepo como duenio y a otro de Lomada)
const U7 = "88888888-8888-4888-8888-888888888888";
await db.query("insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, 'u7@p.test', 'x', $2)", [U7, JSON.stringify({ usuario: "siete", nombre: "Siete" })]);
await db.query("insert into miembros_grupo (usuario_id, grupo_id) values ($1, $2)", [U7, LOMADA]);
await db.exec("set lomada.cambiar_grupo = 'si'"); await db.query("update perfiles set grupo_id = $1 where id = $2", [LOMADA, U7]); await db.exec("reset lomada.cambiar_grupo");
const textos7 = (await rol(U7, () => filas("select texto from mejoras"))).map((r) => r.texto);
assert.ok(!textos7.includes("Pedido desde Viejos"), "lo pedido en Viejos no se ve en Lomada aunque lo haya pedido alguien de Lomada");
assert.ok(textos7.includes("Quiero ver la creatina"), "lo pedido en Lomada si");
assert.ok((await rol(U[1], () => filas("select texto from mejoras"))).some((r) => r.texto === "Pedido desde Viejos"), "lo propio siempre");
assert.ok((await rol(U[0], () => filas("select texto from mejoras"))).some((r) => r.texto === "Pedido desde Viejos"), "el duenio ve todo");

// Avisos a medida
await rol(U7, () => db.query("insert into preferencias_avisos (usuario_id, apagados) values ($1, '{mensajes,recordatorio}')", [U7]));
await assert.rejects(rol(U7, () => db.query("update preferencias_avisos set apagados = '{cualquiera}' where usuario_id = $1", [U7])), "solo categorias validas");
await assert.rejects(rol(U7, () => db.query("insert into preferencias_avisos (usuario_id) values ($1)", [U[1]])), "no se tocan las de otro");
assert.equal((await rol(U[1], () => filas("select * from preferencias_avisos"))).length, 0, "no se ven las de otro");
await db.query("insert into suscripciones_push (endpoint, usuario_id, p256dh, auth) values ('https://p/7', $1, 'a', 'b')", [U7]);
const eps = ["https://p/0", "https://p/7"];
assert.deepEqual((await rol(U[0], () => uno("select public.filtrar_preferencias('mensaje', $1) f", [eps]))).f, ["https://p/0"]);
assert.deepEqual((await rol(U[0], () => uno("select public.filtrar_preferencias('reaccion', $1) f", [eps]))).f.sort(), eps);
assert.deepEqual((await uno("select public.filtrar_destinos('secreta', 'recordatorio', $1) f", [eps])).f, ["https://p/0"]);
assert.deepEqual((await uno("select public.filtrar_destinos('secreta', 'informe', $1) f", [eps])).f.sort(), eps);
assert.deepEqual((await uno("select public.filtrar_destinos('secreta', 'uso', $1) f", [eps])).f.sort(), eps, "los del duenio no se apagan por categoria");
await assert.rejects(db.query("select public.filtrar_destinos('mala', 'informe', $1)", [eps]), /clave_invalida/);
console.log("048: pruebas pasadas");

// ===== 049: la cacona =====
const s049 = fs.readFileSync(raiz + "049_la_cacona.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s049));
console.log((await db.exec(s049)).at(-1).rows[0].resultado);
await db.exec(s049);
const dc = (await uno("select public.destinos_caca('secreta', 'caca') a")).a;
const textos049 = JSON.stringify(dc);
assert.ok(!/\bcaca\b/.test(textos049), "sin caca en el aviso");
if (dc?.destinos?.some((d) => d.cuerpo)) assert.match(textos049, /maldici\u00F3n de la cacona/);
await db.exec("delete from mensajes where bot_multas is not null");
await db.query("select public.contar_multas()");
const bot049 = (await filas("select texto from mensajes where bot_multas is not null order by creado_en desc limit 3")).map((r) => r.texto).join(" | ");
console.log("bot:", bot049.slice(0, 200));
assert.ok(!/\bcacas?\b/.test(bot049), "el bot no dice caca");
console.log("049: pruebas pasadas");

// ===== 050: tope de IA por persona =====
const s050 = fs.readFileSync(raiz + "050_tope_de_ia.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s050));
console.log((await db.exec(s050)).at(-1).rows[0].resultado);
await db.exec(s050);
const ia1 = async (sumar) => (await rol(U[1], () => uno("select public.usar_ia($1) r", [sumar]))).r;
let e1 = await ia1(false);
assert.deepEqual([e1.permitido, e1.usos, e1.quedan, e1.tope], [true, 0, 25, 25]);
for (let i = 0; i < 24; i++) await ia1(true);
e1 = await ia1(false);
assert.deepEqual([e1.permitido, e1.quedan], [true, 1]);
await ia1(true);
e1 = await ia1(false);
assert.deepEqual([e1.permitido, e1.usos, e1.quedan], [false, 25, 0], "llego al tope");
// Con la llave del Atajo cuenta lo mismo
await db.query("set role anon");
const ek = (await uno("select public.usar_ia_con_llave('llave1', false) r")).r;
await assert.rejects(db.query("select public.usar_ia_con_llave('mala', false)"), /token_invalido/);
await assert.rejects(db.query("select public.usar_ia(false)"), /permission denied/, "sin sesion no");
await db.query("reset role");
assert.equal(ek.permitido, false);
// El duenio no tiene tope
for (let i = 0; i < 30; i++) await rol(U[0], () => db.query("select public.usar_ia(true)"));
const e0 = (await rol(U[0], () => uno("select public.usar_ia(false) r"))).r;
assert.deepEqual([e0.permitido, e0.usos, e0.tope], [true, 30, null]);
// Cada uno ve solo lo suyo y no lo puede tocar
assert.equal((await rol(U[1], () => filas("select * from uso_ia"))).length, 1);
await assert.rejects(rol(U[1], () => db.query("update uso_ia set usos = 0")), "no se baja el contador");
await assert.rejects(rol(U[1], () => db.query("select public.uso_ia_de($1, false)", [U[1]])), /permission denied/);
// Al dia siguiente arranca de cero
await db.query("update uso_ia set fecha = fecha - 1");
assert.equal((await ia1(false)).permitido, true);
console.log("050: pruebas pasadas");

// ===== 051: dia a dia =====
const s051 = fs.readFileSync(raiz + "051_dia_a_dia.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s051));
console.log((await db.exec(s051)).at(-1).rows[0].resultado);
await db.exec(s051);
await assert.rejects(db.query("insert into perfiles_salud (usuario_id, sexo, anio_nacimiento, altura_cm, peso_kg, dias_actividad, peso_objetivo, ritmo, dia_a_dia) values ($1, 'masculino', 1998, 178, 80, 4, 76, 0.5, 'volando')", [U[2]]), /check/);
console.log("051: pruebas pasadas");

// ===== 052: viaje y Match Day de cada uno =====
const s052 = fs.readFileSync(raiz + "052_viaje_y_matchday_propios.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s052));
console.log((await db.exec(s052)).at(-1).rows[0].resultado);
await db.exec(s052);
const hoy52 = (await uno("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).d;
const mas = async (n) => (await uno(`select ($1::date + ${n})::text d`, [hoy52])).d;
const en30 = await mas(30); const en10 = await mas(10);
const dow = Number((await uno("select extract(dow from $1::date)::int d", [hoy52])).d);

const sembrados = (await filas("select usuario_id, viaje_destino, match_activo, viaje_avisados from motivacion order by usuario_id")).map((r) => r.usuario_id);
console.log("sembrados:", sembrados.length);
assert.ok(sembrados.includes(U[0]) && sembrados.includes(U[1]), "los de la Lomada arrancan con Floripa");
assert.ok(!sembrados.includes(U[2]), "los que no son de la Lomada no");

// Cada uno arma lo suyo (y no puede tocar los avisos ya mandados ni lo de otro).
await rol(U[2], () => db.query("insert into motivacion (usuario_id, viaje_destino, viaje_fecha, viaje_avisados, match_activo, match_dia, match_hora, match_nombre) values ($1, 'Bariloche', $2, '{30,15,7,2,1,0,arranque}', true, $3, 18, 'padel')", [U[2], en30, dow]));
assert.deepEqual((await uno("select viaje_avisados from motivacion where usuario_id = $1", [U[2]])).viaje_avisados, []);
assert.equal((await rol(U[2], () => filas("select * from motivacion"))).length, 1, "ve solo lo suyo");
await assert.rejects(rol(U[2], () => db.query("insert into motivacion (usuario_id, viaje_destino, viaje_fecha) values ($1, 'X', $2)", [U[1], hoy52])), "no carga el de otro");
await rol(U[2], () => db.query("update motivacion set viaje_destino = 'Bariloche' where usuario_id = $1", [U[1]]));
assert.equal((await uno("select viaje_destino from motivacion where usuario_id = $1", [U[1]])).viaje_destino, "Floripa", "no cambia el de otro");
await db.query("set role anon");
await assert.rejects(db.query("select * from motivacion"), /permission denied/);
await db.query("reset role");

const viaje52 = async (fecha) => (await uno("select public.destinos_viaje('secreta', 'viaje', $1::date) r", [fecha])).r;
const de52 = (r, ep) => r?.destinos?.find((d) => d.endpoint === ep);
let v52 = await viaje52(hoy52);
console.log("viaje hoy:", de52(v52, "https://p/2")?.titulo);
assert.match(de52(v52, "https://p/2").titulo, /Falta un mes para Bariloche/);
assert.equal(de52((await viaje52(hoy52)), "https://p/2"), undefined, "no se repite");
assert.equal(de52((await viaje52(await mas(1))), "https://p/2"), undefined, "el arranque ya cuenta como mandado");
// Cambia el viaje: arranca de nuevo, con el destino nuevo.
await rol(U[2], () => db.query("update motivacion set viaje_destino = 'Mendoza', viaje_fecha = $2, viaje_avisados = '{}' where usuario_id = $1", [U[2], en10]));
v52 = await viaje52(hoy52);
assert.match(de52(v52, "https://p/2").titulo, /Arranca tu cuenta regresiva a Mendoza/);
assert.match(de52(v52, "https://p/2").cuerpo, /Faltan 10 d/);
assert.match(de52(await viaje52(await mas(3)), "https://p/2").titulo, /ltima semana para Mendoza/);
assert.match(de52(await viaje52(await mas(10)), "https://p/2").titulo, /Hoy viaj.s a Mendoza/);
// Los de la Lomada: mismo texto de siempre con Floripa.
// Se copiaron los avisos de Floripa que ya habian salido; para probar, se limpian.
const yaSalidos = (await filas("select clave from avisos_viaje")).map((r) => r.clave).sort();
assert.deepEqual([...(await uno("select viaje_avisados from motivacion where usuario_id = $1", [U[0]])).viaje_avisados].sort(), yaSalidos);
await db.query("update motivacion set viaje_avisados = '{}' where usuario_id = any($1)", [[U[0], U[1]]]);
const vispera = await viaje52("2026-12-25");
assert.match(de52(vispera, "https://p/0").titulo, /Ma.ana te vas a Floripa/);
assert.ok(de52(vispera, "https://p/1"));
assert.equal(de52(vispera, "https://p/2"), undefined, "otro viaje no recibe este");
// Sacar el viaje
await rol(U[2], () => db.query("update motivacion set viaje_destino = null, viaje_fecha = null where usuario_id = $1", [U[2]]));
assert.equal(de52(await viaje52(await mas(5)), "https://p/2"), undefined);

// Match Day: a las 9 del dia si juega a la tarde; la noche anterior si juega temprano.
const match52 = async (tipo, fecha) => (await uno("select public.destinos_match('secreta', $1, $2::date) r", [tipo, fecha])).r;
let m52 = await match52("matchday", hoy52);
assert.match(de52(m52, "https://p/2").cuerpo, /Hoy a las 18 hay padel/);
assert.equal(de52(await match52("matchday", await mas(1)), "https://p/2"), undefined, "otro dia no");
const prog52 = (await uno("select public.destinos_programados('secreta', 'matchday') r")).r;
assert.ok(de52(prog52, "https://p/2"), "el reloj de siempre llega a la funcion nueva");
await rol(U[2], () => db.query("update motivacion set match_hora = 9 where usuario_id = $1", [U[2]]));
assert.equal(de52(await match52("matchday", hoy52), "https://p/2"), undefined, "si juega temprano no avisa a las 9");
const previa52 = await match52("matchday_previa", await mas(-1));
assert.match(de52(previa52, "https://p/2").titulo, /Ma.ana es MATCH DAY/);
assert.match(de52(previa52, "https://p/2").cuerpo, /Ma.ana a las 9 hay padel/);
const domingo52 = await match52("matchday", "2026-11-22");
assert.ok(de52(domingo52, "https://p/0") && de52(domingo52, "https://p/1"), "la Lomada sigue con el domingo");
await rol(U[2], () => db.query("update motivacion set match_activo = false where usuario_id = $1", [U[2]]));
assert.equal(de52(await match52("matchday_previa", await mas(-1)), "https://p/2"), undefined, "apagado no avisa");
await assert.rejects(db.query("select public.destinos_match('mala', 'matchday')"), /clave_invalida/);

// Filtro: el viaje y el Match Day ya no dependen del grupo; el anuncio de la cacona sigue siendo de la Lomada.
const fil52 = async (tipo) => (await uno("select public.filtrar_destinos('secreta', $1, array['https://p/0','https://p/1','https://p/2']) r", [tipo])).r.sort();
assert.deepEqual(await fil52("viaje"), ["https://p/0", "https://p/1", "https://p/2"]);
assert.deepEqual(await fil52("matchday_previa"), ["https://p/0", "https://p/1", "https://p/2"]);
assert.deepEqual(await fil52("anuncio_caca"), ["https://p/0", "https://p/1"], "sin grupo o en otro grupo, no");
assert.equal((await uno("select public.categoria_aviso('matchday_previa') c")).c, "lomada");
await db.query("insert into preferencias_avisos (usuario_id, apagados) values ($1, '{lomada}') on conflict (usuario_id) do update set apagados = '{lomada}'", [U[2]]);
assert.deepEqual(await fil52("viaje"), ["https://p/0", "https://p/1"], "el que lo apaga no lo recibe");
// Relojes
const jobs52 = Object.fromEntries((await filas("select jobname, command from cron.job")).map((r) => [r.jobname, r.command]));
assert.match(jobs52["lomada-matchday"], /"tipo":"matchday"/);
assert.match(jobs52["lomada-matchday-previa"], /"tipo":"matchday_previa"/);
console.log("052: pruebas pasadas");

// ===== 053: registros a medida y recordatorios propios =====
await db.exec("create or replace function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname = n returning true $$;");
const s053 = fs.readFileSync(raiz + "053_registros_y_recordatorios.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s053));
console.log((await db.exec(s053)).at(-1).rows[0].resultado);
await db.exec(s053);
const hoy53 = (await uno("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).d;
const dow53 = Number((await uno("select extract(dow from $1::date)::int d", [hoy53])).d);
const propios = async (cuando) => (await uno("select public.destinos_propios('secreta', 'propios', $1::timestamptz) r", [cuando])).r;
const de53 = (r, ep) => r?.destinos?.find((d) => d.endpoint === ep);

// El aviso de las 20 se paso a recordatorio (U0 lo tenia prendido; U1 no).
const migrados = await filas("select usuario_id, hora, minuto, solo_si_falta from recordatorios order by usuario_id");
assert.ok(migrados.some((r) => r.usuario_id === U[0]));
assert.ok(migrados.every((r) => r.hora === 20 && r.minuto === 0 && r.solo_si_falta));
await db.query("delete from recordatorios where usuario_id <> $1", [U[0]]);
assert.equal((await uno("select count(*)::int n from registros_config where aviso")).n, 0);

// Registros propios: futbol y uno escrito ("Yoga").
await rol(U[0], () => db.query(`update registros_config set activos = '{creatina,gym,futbol,p-yoga}', personalizados = '[{"codigo":"p-yoga","nombre":"Yoga","tipo":"actividad"}]' where usuario_id = $1`, [U[0]]));
await rol(U[0], () => db.query("insert into registros_diarios (usuario_id, fecha, codigo) values ($1, $2, 'futbol')", [U[0], hoy53]));
await assert.rejects(rol(U[0], () => db.query("insert into registros_diarios (usuario_id, fecha, codigo) values ($1, $2, 'Mal Codigo')", [U[0], hoy53])), /check/);

let r53 = await propios(`${hoy53} 20:05:00-03`);
console.log("20 h:", de53(r53, "https://p/0")?.titulo, "|", de53(r53, "https://p/0")?.cuerpo);
assert.match(de53(r53, "https://p/0").cuerpo, /^Te falta: creatina(, gym)?, Yoga\.$/);
assert.ok(!/futbol|f.tbol/.test(de53(r53, "https://p/0").cuerpo), "lo tildado no aparece");
assert.equal(de53(await propios(`${hoy53} 20:10:00-03`), "https://p/0"), undefined, "no se repite en la misma franja");
assert.equal(de53(await propios(`${hoy53} 20:20:00-03`), "https://p/0"), undefined, "otra franja: no es su hora");

// Uno a las 21:30 "solo si falta": con todo tildado, no avisa.
await rol(U[0], () => db.query("insert into recordatorios (usuario_id, hora, minuto, solo_si_falta, ultimo_envio) values ($1, 21, 30, true, now())", [U[0]]));
assert.equal((await uno("select ultimo_envio from recordatorios where usuario_id = $1 and hora = 21", [U[0]])).ultimo_envio, null, "ultimo_envio lo maneja la base");
for (const c of ["creatina", "gym", "p-yoga"]) await rol(U[0], () => db.query("insert into registros_diarios (usuario_id, fecha, codigo) values ($1, $2, $3) on conflict do nothing", [U[0], hoy53, c]));
assert.equal(de53(await propios(`${hoy53} 21:31:00-03`), "https://p/0"), undefined, "todo tildado: no molesta");

// U2 (sin grupo): "Tomar agua" a las 8:15 solo hoy; le llega igual.
await rol(U[2], () => db.query("insert into recordatorios (usuario_id, hora, minuto, dias, texto) values ($1, 8, 15, $2, 'Tomar agua')", [U[2], [dow53]]));
r53 = await propios(`${hoy53} 08:16:00-03`);
assert.equal(de53(r53, "https://p/2").titulo, "Tomar agua");
assert.match(de53(r53, "https://p/2").cuerpo, /abrir Lomada Fuel/);
assert.deepEqual((await uno("select public.filtrar_destinos('secreta', 'propios', array['https://p/2']) r")).r, ["https://p/2"]);
const otroDia = (await uno("select ($1::date + 1)::text d", [hoy53])).d;
assert.equal(de53(await propios(`${otroDia} 08:16:00-03`), "https://p/2"), undefined, "otro dia de la semana no");

// Cada uno ve lo suyo; maximo 10.
assert.equal((await rol(U[2], () => filas("select * from recordatorios"))).length, 1);
for (let i = 0; i < 9; i++) await rol(U[2], () => db.query("insert into recordatorios (usuario_id, hora) values ($1, 9)", [U[2]]));
await assert.rejects(rol(U[2], () => db.query("insert into recordatorios (usuario_id, hora) values ($1, 9)", [U[2]])), /maximo_recordatorios/);
await assert.rejects(rol(U[2], () => db.query("insert into recordatorios (usuario_id, hora) values ($1, 9)", [U[1]])), "no carga para otro");
await assert.rejects(rol(U[2], () => db.query("insert into recordatorios (usuario_id, hora, minuto) values ($1, 9, 10)", [U[2]])), /check|maximo/);
await assert.rejects(db.query("select public.destinos_propios('mala', 'propios')"), /clave_invalida/);
assert.equal((await uno("select public.categoria_aviso('propios') c")).c, "registros");
const jobs53 = (await filas("select jobname, command from cron.job")).map((r) => r.jobname);
assert.ok(jobs53.includes("lomada-propios") && !jobs53.includes("lomada-registros"));
console.log("053: pruebas pasadas");

// ===== 054: catalogo de productos compartido =====
const s054 = fs.readFileSync(raiz + "054_catalogo_de_productos.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s054), "054 en ASCII");
console.log((await db.exec(s054)).at(-1).rows[0].resultado);
await db.exec(s054);
const guardar54 = (u, codigo, nombre, marca, por100, fuente = "usuario") =>
  rol(u, () => uno("select * from public.guardar_producto($1, $2, $3, $4::jsonb, null, $5)", [codigo, nombre, marca, JSON.stringify(por100), fuente]));
const buscar54 = (u, t) => rol(u, () => filas("select * from public.buscar_productos($1)", [t]));

// Uno lo carga de la etiqueta (U2, sin grupo); otro de OTRO grupo lo encuentra por codigo y por nombre.
let p54 = await guardar54(U[2], "7790040613300", "Alfajor Guaymallén Blanco", "Guaymallén", { kcal: 424, p: 5, c: 66, g: 15 }, "etiqueta");
assert.equal(p54.indice, "alfajor guaymallen blanco guaymallen");
const porCodigo = await rol(U[0], () => filas("select nombre, marca, usuarios from productos where codigo = '7790040613300'"));
assert.equal(porCodigo[0].nombre, "Alfajor Guaymallén Blanco");
await assert.rejects(rol(U[0], () => filas("select creado_por from productos")), /permission denied/, "no se ve quien lo cargo");
assert.equal((await buscar54(U[0], "alfajores guaymallen")).length, 1, "sin tildes y en plural");
assert.equal((await buscar54(U[0], "guay")).length, 1, "por el comienzo de la marca");
assert.equal((await buscar54(U[0], "alfajor oreo")).length, 0, "todas las palabras");

// Otro lo usa: cuenta personas y no le cambia los valores.
p54 = await guardar54(U[0], "7790040613300", "Otro nombre", "", { kcal: 100, p: 1, c: 1, g: 1 }, "usuario");
assert.deepEqual([p54.usuarios, p54.veces, Number(p54.por100.kcal), p54.nombre], [2, 2, 424, "Alfajor Guaymallén Blanco"]);
p54 = await guardar54(U[0], "7790040613300", "x", "", { kcal: 100, p: 1, c: 1, g: 1 }, "usuario");
assert.deepEqual([p54.usuarios, p54.veces], [2, 3], "la misma persona no suma dos veces");

// Cargado a mano por uno solo: lo corrige una etiqueta.
await guardar54(U[1], "7791234567895", "Yogur raro", "Marca X", { kcal: 999 > 950 ? 90 : 0, p: 3, c: 10, g: 2 }, "usuario");
p54 = await guardar54(U[2], "7791234567895", "Yogur raro", "Marca X", { kcal: 62, p: 4, c: 8, g: 1.5 }, "etiqueta");
assert.deepEqual([Number(p54.por100.kcal), p54.fuente], [62, "etiqueta"]);

// Sin codigo: se junta por nombre y marca.
await guardar54(U[1], null, "Barrita Cereal Mix", "Mix", { kcal: 380, p: 6, c: 70, g: 9 });
p54 = await guardar54(U[2], "", "barrita cereal mix", "MIX", { kcal: 380, p: 6, c: 70, g: 9 });
assert.equal(p54.usuarios, 2);

// Lo que no entra
await assert.rejects(guardar54(U[1], "123", "X", "", { kcal: 100, p: 1, c: 1, g: 1 }), /codigo_invalido/);
await assert.rejects(guardar54(U[1], null, "X", "", { kcal: 2000, p: 1, c: 1, g: 1 }), /valores_invalidos/);
await assert.rejects(guardar54(U[1], null, "X", "", { kcal: 300, p: 60, c: 60, g: 1 }), /valores_invalidos/);
await assert.rejects(guardar54(U[1], null, "", "", { kcal: 300, p: 6, c: 6, g: 1 }), /falta_nombre/);
await assert.rejects(rol(U[1], () => db.query("insert into productos (nombre, por100) values ('Directo', '{}')")), /permission denied/, "solo con la funcion");
await db.query("set role anon");
await assert.rejects(db.query("select * from public.buscar_productos('alfajor')"), /permission denied/);
await db.query("reset role");
let creados54 = (await uno("select count(*)::int n from productos where creado_por = $1", [U[1]])).n;
for (; creados54 < 60; creados54++) await guardar54(U[1], null, `Spam ${creados54}`, "", { kcal: 100, p: 1, c: 1, g: 1 });
await assert.rejects(guardar54(U[1], null, "Spam de mas", "", { kcal: 100, p: 1, c: 1, g: 1 }), /demasiados_productos/);
console.log("054: pruebas pasadas");

// ===== 055: borrar mi cuenta =====
const s055 = fs.readFileSync(raiz + "055_borrar_mi_cuenta.sql", "utf8");
assert.ok(/^[\x01-\x7f]*$/.test(s055), "055 en ASCII");
console.log((await db.exec(s055)).at(-1).rows[0].resultado);
await db.exec(s055);

// Cuantas filas tiene cada uno en cada tabla que apunta a un perfil.
const refs55 = await filas(`
  select k.table_name t, k.column_name c
    from information_schema.key_column_usage k
    join information_schema.referential_constraints rc on rc.constraint_name = k.constraint_name and rc.constraint_schema = k.constraint_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = rc.unique_constraint_name and ccu.constraint_schema = rc.unique_constraint_schema
   where k.table_schema = 'public' and ccu.table_name = 'perfiles'`);
const filasDe55 = async (u) => {
  const r = {};
  for (const { t, c } of refs55) {
    const n = (await uno(`select count(*)::int n from public.${t} where ${c} = $1`, [u])).n;
    if (n) r[`${t}.${c}`] = n;
  }
  return r;
};

// Nahuel (U[1]) tiene de todo; arma un grupo con Pepo y se va.
const antes55 = await filasDe55(U[1]);
console.log("Nahuel antes:", JSON.stringify(antes55));
assert.ok(Object.keys(antes55).length >= 5, "tiene datos para borrar");
const grupo55 = (await uno("insert into grupos (nombre, codigo, creado_por) values ('De Nahuel', 'nahuel-55', $1) returning id", [U[1]])).id;
await db.query("insert into miembros_grupo (usuario_id, grupo_id, unido_en) values ($1, $3, now() - interval '2 days'), ($2, $3, now() - interval '1 day')", [U[1], U[0], grupo55]);
const deOtros55 = (await uno("select count(*)::int n from comidas where usuario_id <> $1", [U[1]])).n;
await db.query("insert into intentos_ingreso (usuario, fallas) values ('usu1', 2) on conflict do nothing");

// Sin confirmar, el duenio, o sin sesion: no.
await assert.rejects(rol(U[1], () => db.query("select public.borrar_mi_cuenta('si')")), /falta_confirmar/);
await assert.rejects(rol(U[0], () => db.query("select public.borrar_mi_cuenta('BORRAR')")), /es_dueno/);
await db.query("set role anon");
await assert.rejects(db.query("select public.borrar_mi_cuenta('BORRAR')"), /permission denied/);
await db.query("reset role");

assert.equal((await rol(U[1], () => uno("select public.borrar_mi_cuenta('BORRAR') r"))).r, "ok");
assert.deepEqual(await filasDe55(U[1]), {}, "no queda nada suyo");
assert.equal((await uno("select count(*)::int n from auth.users where id = $1", [U[1]])).n, 0);
assert.equal((await uno("select count(*)::int n from perfiles where id = $1", [U[1]])).n, 0);
assert.equal((await uno("select count(*)::int n from intentos_ingreso where usuario = 'usu1'")).n, 0);
assert.equal((await uno("select creado_por from grupos where id = $1", [grupo55])).creado_por, U[0], "el grupo pasa a Pepo");
assert.equal((await uno("select count(*)::int n from comidas where usuario_id <> $1", [U[1]])).n, deOtros55, "lo de los demas queda");
assert.ok((await uno("select count(*)::int n from productos")).n > 0, "el catalogo queda (sin autor)");
console.log("055: pruebas pasadas");
// ===== backup: bajar toda la base, vaciarla y restaurarla =====
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
const { respaldarBase } = await import("../../scripts/backup.mjs");
await db.query("insert into storage.objects (bucket_id, name) values ('fotos', 'u/a.jpg'), ('fotos', 'u/chat/b.webm')").catch((e) => console.log("storage:", e.message));
// Un texto con comillas, el separador y saltos de línea, para ver que viaja entero.
await db.query("update comidas set descripcion = $1 where id = (select id from comidas limit 1)", ["Raro: 'comillas' \"dobles\" $lomada$ y\nsalto ñandú 💩"]);
const contar = async () => {
  const t = await filas(`select table_schema s, table_name t from information_schema.tables where table_type = 'BASE TABLE' and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users','identities'))) order by 1, 2`);
  const r = {};
  for (const { s, t: n } of t) r[`${s}.${n}`] = (await uno(`select count(*)::int n from "${s}"."${n}"`)).n;
  return r;
};
const antesB = await contar();
const raro = (await uno("select id, descripcion from comidas where descripcion like 'Raro:%'"));
const servidor = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await servidor.start();
const archivo = (await import("node:path")).join((await import("node:os")).tmpdir(), `lomada-backup-prueba-${process.pid}.sql`);
const { resumen, fotos } = await respaldarBase("postgres://postgres:postgres@127.0.0.1:5433/postgres", archivo);
await servidor.stop();
assert.deepEqual(resumen, antesB, "cuenta todas las filas");
assert.ok(fotos.includes("u/a.jpg") && fotos.includes("u/chat/b.webm"), "lista las fotos");
console.log("filas respaldadas:", Object.values(resumen).reduce((a, b) => a + b, 0), "| tamano:", fs.statSync(archivo).size, "bytes");

// Se vacia todo y se restaura con el archivo.
const publicas = Object.keys(antesB).filter((k) => k.startsWith("public.")).map((k) => `public."${k.slice(7)}"`);
await db.exec(`truncate ${publicas.join(", ")}, auth.users cascade`);
assert.equal((await uno("select count(*)::int n from comidas")).n, 0);
await db.exec(fs.readFileSync(archivo, "utf8"));
assert.deepEqual(await contar(), antesB, "vuelve todo");
assert.deepEqual(await uno("select id, descripcion from comidas where descripcion like 'Raro:%'"), raro, "el texto raro viaja entero");
// Correrlo dos veces no duplica.
await db.exec(fs.readFileSync(archivo, "utf8"));
assert.deepEqual(await contar(), antesB, "no duplica");
// Despues de restaurar, la app sigue andando: los triggers vuelven a estar activos.
assert.equal((await uno("show session_replication_role")).session_replication_role, "origin");
fs.rmSync(archivo, { force: true });
console.log("backup: pruebas pasadas");

// ===== 056: Apple Salud sincroniza dia por dia =====
{
  // El 037 (comidas sueltas de Apple Salud) no estaba en la cadena: va antes del 056.
  await db.exec(fs.readFileSync(raiz + "037_comidas_de_salud.sql", "utf8"));
  const s056 = fs.readFileSync(raiz + "056_sincronizar_salud.sql", "utf8");
  assert.ok(/^[\x01-\x7f]*$/.test(s056), "056 en ASCII");
  console.log((await db.exec(s056)).at(-1).rows[0].resultado);
  await db.exec(s056);
  const hoy = (await uno("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).d;
  const dia = async (n) => (await uno("select ($1::date + $2::int)::text d", [hoy, n])).d;
  const [ayer, hace3, hace5, hace10] = [await dia(-1), await dia(-3), await dia(-5), await dia(-10)];
  const e = (fecha, hora, kcal) => ({ momento: `${fecha}T${hora}:00-03:00`, kcal, p: 10, c: 20, g: 5 });
  await db.exec("delete from tokens_salud");
  await db.query("insert into tokens_salud (usuario_id, token_hash) values ($1, encode(extensions.digest('llave56', 'sha256'), 'hex'))", [U[0]]);
  await db.query("delete from comidas where usuario_id = $1 and tipo = 'resumen'", [U[0]]);
  await db.query("delete from salud_comidas where usuario_id = $1", [U[0]]);
  const sincronizar = async (entradas) => {
    await db.query("set role anon");
    try { return (await db.query("select public.sincronizar_salud('llave56', $1::jsonb, $2::date, $3::date) r", [JSON.stringify(entradas), hace5, hoy])).rows[0].r; }
    finally { await db.query("reset role"); }
  };
  const total = async (fecha) => (await uno("select calorias, descripcion from comidas where usuario_id = $1 and tipo = 'resumen' and fecha = $2", [U[0], fecha]))?.calorias ?? null;
  const sueltas = async (fecha) => (await filas("select kcal from salud_comidas where usuario_id = $1 and fecha = $2 order by momento", [U[0], fecha])).map((x) => x.kcal);

  // Un resumen importado a mano y una comida vieja fuera de la ventana: no se tocan.
  await db.query("insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, proteinas, carbohidratos, grasas, alimentos) values ($1, 'resumen', $2, 'Resumen importado', 1800, 1, 1, 1, '[]')", [U[0], hace3]);
  await db.query("insert into salud_comidas (usuario_id, fecha, momento, kcal, proteinas, carbohidratos, grasas) values ($1, $2, $3, 400, 1, 1, 1)", [U[0], hace10, `${hace10}T12:00:00-03:00`]);

  // 1. Hoy almuerzo y cena; ayer una cena.
  let r56 = await sincronizar([e(hoy, "13:00", 500), e(hoy, "21:10", 650), e(ayer, "21:00", 700), e(hace3, "13:00", 300)]);
  assert.equal(r56[hoy], 1150);
  assert.deepEqual([await total(hoy), await total(ayer)], [1150, 700]);
  assert.equal(await total(hace3), 1800, "el resumen importado a mano no se pisa");

  // 2. La cena de hoy se paso a ayer en MyFitnessPal (el caso del 19/11).
  await sincronizar([e(hoy, "13:00", 500), e(ayer, "21:00", 700), e(ayer, "22:30", 650)]);
  assert.deepEqual([await total(hoy), await total(ayer)], [500, 1350], "hoy baja y ayer sube");
  assert.deepEqual(await sueltas(hoy), [500], "la cena ya no figura hoy");
  assert.deepEqual(await sueltas(ayer), [700, 650]);

  // 3. Hoy quedo vacio: el total de hoy se va (antes quedaba el de ayer como de hoy).
  await sincronizar([e(ayer, "21:00", 700), e(ayer, "22:30", 650)]);
  assert.equal(await total(hoy), null, "hoy sin nada");
  assert.deepEqual(await sueltas(hoy), []);
  assert.equal(await total(ayer), 1350);
  assert.deepEqual(await sueltas(hace10), [400], "fuera de la ventana no se toca");
  assert.equal(await total(hace3), 1800);

  // Permisos y errores
  await db.query("set role anon");
  await assert.rejects(db.query("select public.sincronizar_salud('mala', '[]', $1::date, $2::date)", [hace5, hoy]), /token_invalido/);
  await assert.rejects(db.query("select public.sincronizar_salud('llave56', '[]', $1::date, $2::date)", [hace10 + "x".slice(1), await dia(-20)]), /fecha_invalida/);
  await db.query("reset role");
  await assert.rejects(rol(U[0], () => db.query("select public.sincronizar_salud('llave56', '[]', $1::date, $2::date)", [hace5, hoy])), /permission denied/);
  console.log("056: pruebas pasadas");
}

// ===== 057: tus comidas de Lomada pasan a Apple Salud =====
{
  const s057 = fs.readFileSync(raiz + "057_comidas_a_salud.sql", "utf8");
  assert.ok(/^[\x01-\x7f]*$/.test(s057), "057 en ASCII");
  console.log((await db.exec(s057)).at(-1).rows[0].resultado);
  await db.exec(s057);
  const hoy = (await uno("select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d")).d;
  const ayer = (await uno("select ($1::date - 1)::text d", [hoy])).d;
  const pedir = async (marcar = true) => {
    await db.query("set role anon");
    try { return (await db.query("select public.comidas_para_salud('llave56', $1) r", [marcar])).rows[0].r; }
    finally { await db.query("reset role"); }
  };
  await db.query("delete from comidas where usuario_id = $1 and tipo <> 'resumen'", [U[0]]);
  const comida = (tipo, fecha, kcal, alimentos = [], creado = null) => db.query(
    "insert into comidas (usuario_id, tipo, fecha, descripcion, calorias, proteinas, carbohidratos, grasas, alimentos, creado_en) values ($1, $2, $3, $4, $5, 30, 50, 10, $6::jsonb, coalesce($7::timestamptz, now())) returning id",
    [U[0], tipo, fecha, `${tipo} ${kcal}`, kcal, JSON.stringify(alimentos), creado]);
  await comida("almuerzo", hoy, 650, [{ nombre: "Milanesa", fuente: "tipico" }], `${hoy}T13:05:00-03:00`);
  await comida("cena", hoy, 500, [{ nombre: "Cena de Apple Salud", fuente: "importado", salud_id: "x" }]);
  await comida("merienda", hoy, 300, [{ nombre: "Importado", fuente: "importado" }]);
  await comida("cena", ayer, 800, [{ nombre: "Asado", fuente: "tipico" }], `${ayer}T22:10:00-03:00`);

  // Probar (sin marcar) no cuenta como mandado.
  assert.equal((await pedir(false)).length, 1);
  // La primera vez: solo lo de hoy cargado en Lomada (ni lo de Salud ni lo importado, ni lo de ayer).
  let r57 = await pedir();
  assert.deepEqual(r57.map((c) => [c.nombre, c.kcal, c.fecha]), [["almuerzo 650", 650, `${hoy}T13:05:00-03:00`]]);
  assert.equal((await pedir()).length, 0, "una sola vez");
  // Una comida nueva de hoy y una de ayer cargada hoy (va con la hora tipica de la cena).
  await comida("colacion", hoy, 200, [{ nombre: "Banana", fuente: "tipico" }], `${hoy}T16:40:00-03:00`);
  r57 = await pedir();
  assert.deepEqual(r57.map((c) => [c.kcal, c.fecha]), [[200, `${hoy}T16:40:00-03:00`]], "ayer no, porque se empezo hoy");
  // Al dia siguiente (simulado corriendo la primera exportacion un dia para atras) entra lo que quedo de ayer.
  await db.query("update salud_exportadas set fecha = fecha - 1 where usuario_id = $1", [U[0]]);
  r57 = await pedir();
  assert.deepEqual(r57.map((c) => [c.kcal, c.fecha]), [[800, `${ayer}T22:10:00-03:00`]]);

  // Lo que mando Lomada vuelve con el Atajo de MyFitnessPal: no se cuenta como llegado de Salud.
  await db.query("delete from salud_comidas where usuario_id = $1", [U[0]]);
  await db.query("set role anon");
  const hace5 = (await db.query("select ($1::date - 5)::text d", [hoy])).rows[0].d;
  await db.query("select public.sincronizar_salud('llave56', $1::jsonb, $2::date, $3::date)", [JSON.stringify([
    { momento: `${hoy}T13:05:00-03:00`, kcal: 650, p: 30, c: 50, g: 10 },
    { momento: `${hoy}T08:30:00-03:00`, kcal: 400, p: 20, c: 40, g: 10 },
  ]), hace5, hoy]);
  await db.query("reset role");
  assert.deepEqual((await filas("select kcal from salud_comidas where usuario_id = $1 and fecha = $2", [U[0], hoy])).map((x) => x.kcal), [400], "solo lo de MyFitnessPal");
  await assert.rejects(rol(U[0], () => db.query("select public.comidas_para_salud('llave56')")), /permission denied/);
  console.log("057: pruebas pasadas");
}

// ===== 059: los ultimos envios del Atajo de Apple Salud =====
{
  const s059 = fs.readFileSync(raiz + "059_envios_de_salud.sql", "utf8");
  assert.ok(/^[\x01-\x7f]*$/.test(s059), "059 en ASCII");
  console.log((await db.exec(s059)).at(-1).rows[0].resultado);
  await db.exec(s059);
  await db.query("set role anon");
  for (let i = 0; i < 12; i++) await db.query("select public.registrar_envio_salud('llave56', $1::jsonb)", [JSON.stringify({ n: i })]);
  await assert.rejects(db.query("select public.registrar_envio_salud('mala', '{}')"), /token_invalido/);
  await db.query("reset role");
  const envios = await filas("select resumen from salud_envios where usuario_id = $1 order by creado_en desc", [U[0]]);
  assert.equal(envios.length, 10, "quedan los ultimos 10");
  assert.equal((await rol(U[0], () => filas("select * from salud_envios"))).length, 10, "cada uno ve los suyos");
  console.log("059: pruebas pasadas");
}

// ===== 060: el duenio responde los pedidos de mejora =====
{
  const s060 = fs.readFileSync(raiz + "060_respuesta_a_mejoras.sql", "utf8");
  assert.ok(/^[\x01-\x7f]*$/.test(s060), "060 en ASCII");
  console.log((await db.exec(s060)).at(-1).rows[0].resultado);
  await db.exec(s060);
  const otro = (await uno("select id from perfiles where id not in (select usuario_id from dueno_app) limit 1")).id;
  const pedido = (await rol(otro, () => uno("insert into mejoras (usuario_id, texto) values ($1, 'Que la app me cocine') returning id", [otro]))).id;
  // Solo el duenio responde.
  await assert.rejects(rol(otro, () => db.query("select public.responder_mejora($1, 'yo mismo', false)", [pedido])), /no_sos_dueno/);
  await assert.rejects(rol(otro, () => db.query("select public.aviso_respuesta_mejora($1)", [pedido])), /no_sos_dueno/);
  await assert.rejects(rol(U[0], () => db.query("select public.responder_mejora($1, '  ', true)", [pedido])), /texto_invalido/, "no va necesita explicacion");
  await rol(U[0], () => db.query("select public.responder_mejora($1, 'No se puede: la app no tiene manos', true)", [pedido]));
  const r = await uno("select respuesta, no_va, respondida_en from mejoras where id = $1", [pedido]);
  assert.equal(r.respuesta, "No se puede: la app no tiene manos");
  assert.equal(r.no_va, true);
  assert.ok(r.respondida_en);
  const aviso = (await rol(U[0], () => uno("select public.aviso_respuesta_mejora($1) a", [pedido]))).a;
  assert.equal(aviso.titulo, "Sobre tu pedido de mejora");
  assert.equal(aviso.vista, "mejoras");
  assert.ok(Array.isArray(aviso.destinos));
  // Quien lo pidio ve la respuesta; pero no la puede cambiar a mano.
  assert.equal((await rol(otro, () => uno("select respuesta from mejoras where id = $1", [pedido]))).respuesta, "No se puede: la app no tiene manos");
  await assert.rejects(rol(otro, () => db.query("update mejoras set respuesta = 'trucho' where id = $1", [pedido])), /permission denied/);
  // Respuesta normal: otro titulo. Vieja (mas de 2 minutos): ya no avisa.
  await rol(U[0], () => db.query("select public.responder_mejora($1, 'Lo vemos para la proxima', false)", [pedido]));
  assert.match((await rol(U[0], () => uno("select public.aviso_respuesta_mejora($1) a", [pedido]))).a.titulo, /Te respondieron/);
  await db.query("update mejoras set respondida_en = now() - interval '5 minutes' where id = $1", [pedido]);
  assert.equal((await rol(U[0], () => uno("select public.aviso_respuesta_mejora($1) a", [pedido]))).a, null);
  // Borrar la respuesta.
  await rol(U[0], () => db.query("select public.responder_mejora($1, '', false)", [pedido]));
  assert.equal((await uno("select respuesta from mejoras where id = $1", [pedido])).respuesta, null);
  assert.equal((await uno("select public.categoria_aviso('mejora_respuesta') c")).c, "mejoras");
  assert.equal((await uno("select public.categoria_aviso('anuncio') c")).c, "anuncios");
  console.log("060: pruebas pasadas");
}
