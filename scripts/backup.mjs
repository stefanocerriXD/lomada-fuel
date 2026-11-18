// Backup de Lomada Fuel en tu compu: toda la base (con las cuentas) y las fotos.
// El plan gratis de Supabase no deja bajar backups, así que se hace con esto.
//
//   npm run backup                      base + fotos (las fotos solo baja las nuevas)
//   npm run backup -- --sin-fotos       solo la base
//   npm run backup -- --restaurar-fotos <carpeta>   vuelve a subir las fotos de un backup
//
// Configuración en .env.backup (NO se sube al repo; ver scripts/LEEME-backup.md):
//   SUPABASE_DB_URL      conexión a la base (Supabase > Connect > Session pooler), con la contraseña
//   SUPABASE_URL         https://xxxx.supabase.co               (solo para las fotos)
//   SUPABASE_SECRET_KEY  clave secreta (service_role)           (solo para las fotos)
//   BACKUP_CARPETA       dónde guardar (por defecto: lomada-backups, al lado del proyecto)
//   BACKUP_GUARDAR       cuántos backups de la base se guardan (por defecto 8)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function leerConfig() {
  const config = {};
  const archivo = path.join(raiz, ".env.backup");
  if (fs.existsSync(archivo)) {
    for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) config[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const k of ["SUPABASE_DB_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "BACKUP_CARPETA", "BACKUP_GUARDAR"]) if (process.env[k]) config[k] = process.env[k];
  return config;
}

const config = leerConfig();
const carpeta = path.resolve(config.BACKUP_CARPETA || path.join(raiz, "..", "lomada-backups"));
const sello = () => new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).replace(" ", "_").replace(/:/g, "").slice(0, 15);

// ---------- La base ----------
// Lo que se guarda: todas las tablas de la app y las cuentas (auth.users e identities, con la contraseña cifrada).
const TABLAS_AUTH = ["users", "identities"];
const POR_SENTENCIA = 500;

function etiqueta(texto) {
  let tag = "$lomada$";
  for (let n = 1; texto.includes(tag); n += 1) tag = `$lomada${n}$`;
  return tag;
}

export async function respaldarBase(url, destino) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  const cliente = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    const { rows: tablas } = await cliente.query(
      `select table_schema s, table_name t from information_schema.tables
        where table_type = 'BASE TABLE' and (table_schema = 'public' or (table_schema = 'auth' and table_name = any($1)))
        order by table_schema = 'auth' desc, table_name = 'users' desc, table_name`,
      [TABLAS_AUTH],
    );
    const salida = fs.createWriteStream(destino, { encoding: "utf8" });
    const escribir = (t) => new Promise((ok) => (salida.write(t) ? ok() : salida.once("drain", ok)));
    const q = (n) => `"${n.replace(/"/g, '""')}"`;
    await escribir(
      `-- Backup de Lomada Fuel, ${new Date().toISOString()}\n` +
      "-- Para restaurar: en un proyecto con las tablas ya creadas (supabase/schema.sql y los 0XX en orden), correr este archivo entero.\n" +
      "-- No pisa lo que ya exista (on conflict do nothing) y no dispara avisos ni triggers mientras carga.\n" +
      "begin;\nset local session_replication_role = replica;\n\n",
    );
    const resumen = {};
    for (const { s, t } of tablas) {
      // Las columnas que se calculan solas (por ejemplo auth.users.confirmed_at) no se insertan.
      const { rows: cols } = await cliente.query(
        "select column_name c from information_schema.columns where table_schema = $1 and table_name = $2 and is_generated = 'NEVER' order by ordinal_position",
        [s, t],
      );
      const lista = cols.map((x) => q(x.c)).join(", ");
      const { rows } = await cliente.query(`select row_to_json(x)::text j from ${q(s)}.${q(t)} x`);
      resumen[`${s}.${t}`] = rows.length;
      await escribir(`-- ${s}.${t}: ${rows.length} filas\n`);
      for (let i = 0; i < rows.length; i += POR_SENTENCIA) {
        const json = `[${rows.slice(i, i + POR_SENTENCIA).map((r) => r.j).join(",\n")}]`;
        const tag = etiqueta(json);
        await escribir(`insert into ${q(s)}.${q(t)} (${lista}) select ${lista} from json_populate_recordset(null::${q(s)}.${q(t)}, ${tag}${json}${tag}) on conflict do nothing;\n`);
      }
      await escribir("\n");
    }
    await escribir("commit;\n");
    await new Promise((ok, mal) => salida.end((e) => (e ? mal(e) : ok())));
    const { rows: fotos } = await cliente.query("select name from storage.objects where bucket_id = 'fotos' order by name").catch(() => ({ rows: [] }));
    return { resumen, fotos: fotos.map((f) => f.name) };
  } finally {
    await cliente.end();
  }
}

// ---------- Las fotos (Storage) ----------
function cabeceras(clave) {
  // Las claves nuevas (sb_secret_...) van solo en apikey; las viejas (JWT) también como Bearer.
  return clave.startsWith("sb_") ? { apikey: clave } : { apikey: clave, authorization: `Bearer ${clave}` };
}

async function enParalelo(lista, cuantos, tarea) {
  let i = 0;
  const hilos = Array.from({ length: Math.min(cuantos, lista.length) }, async () => {
    while (i < lista.length) await tarea(lista[i++]);
  });
  await Promise.all(hilos);
}

export async function bajarFotos(nombres, destino) {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: clave } = config;
  if (!url || !clave) return console.log("Fotos: falta SUPABASE_URL o SUPABASE_SECRET_KEY en .env.backup, se saltean.");
  const faltan = nombres.filter((n) => !fs.existsSync(path.join(destino, n)));
  console.log(`Fotos: ${nombres.length} en total, ${faltan.length} nuevas para bajar.`);
  let bajadas = 0;
  const fallidas = [];
  await enParalelo(faltan, 6, async (nombre) => {
    try {
      const r = await fetch(`${url}/storage/v1/object/fotos/${nombre.split("/").map(encodeURIComponent).join("/")}`, { headers: cabeceras(clave) });
      if (!r.ok) throw new Error(String(r.status));
      const archivo = path.join(destino, nombre);
      fs.mkdirSync(path.dirname(archivo), { recursive: true });
      fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()));
      bajadas += 1;
      if (bajadas % 100 === 0) console.log(`  ${bajadas} de ${faltan.length}…`);
    } catch (e) {
      fallidas.push(`${nombre} (${e.message})`);
    }
  });
  console.log(`Fotos: ${bajadas} bajadas${fallidas.length ? `, ${fallidas.length} fallaron: ${fallidas.slice(0, 5).join(", ")}` : ""}.`);
}

export async function restaurarFotos(origen) {
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: clave } = config;
  if (!url || !clave) throw new Error("Falta SUPABASE_URL o SUPABASE_SECRET_KEY en .env.backup.");
  const archivos = [];
  const recorrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(ruta);
      else archivos.push(path.relative(origen, ruta).split(path.sep).join("/"));
    }
  };
  recorrer(origen);
  const tipo = (n) => ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", webm: "audio/webm", mp4: "audio/mp4", m4a: "audio/mp4", ogg: "audio/ogg" })[n.split(".").pop().toLowerCase()] || "application/octet-stream";
  let subidas = 0;
  await enParalelo(archivos, 6, async (nombre) => {
    const r = await fetch(`${url}/storage/v1/object/fotos/${nombre.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: { ...cabeceras(clave), "content-type": tipo(nombre), "x-upsert": "true" },
      body: fs.readFileSync(path.join(origen, nombre)),
    });
    if (r.ok) subidas += 1;
    else console.log(`  No se pudo subir ${nombre}: ${r.status}`);
  });
  console.log(`Listo: ${subidas} de ${archivos.length} archivos subidos.`);
}

// Se guardan los últimos N backups de la base (las fotos son una sola carpeta que se completa).
function borrarViejos() {
  const guardar = Math.max(1, Number(config.BACKUP_GUARDAR) || 8);
  const viejos = fs.readdirSync(carpeta).filter((n) => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort().slice(0, -guardar);
  for (const n of viejos) fs.rmSync(path.join(carpeta, n), { recursive: true, force: true });
  if (viejos.length) console.log(`Se borraron ${viejos.length} backups viejos (quedan los últimos ${guardar}).`);
}

async function main() {
  const i = args.indexOf("--restaurar-fotos");
  if (i >= 0) return restaurarFotos(path.resolve(args[i + 1] || path.join(carpeta, "fotos")));

  if (!config.SUPABASE_DB_URL) {
    console.error("Falta SUPABASE_DB_URL. Copiá scripts/env.backup.ejemplo a .env.backup y completalo (ver scripts/LEEME-backup.md).");
    process.exit(1);
  }
  const destino = path.join(carpeta, sello());
  fs.mkdirSync(destino, { recursive: true });
  console.log(`Base → ${destino}`);
  const { resumen, fotos } = await respaldarBase(config.SUPABASE_DB_URL, path.join(destino, "datos.sql"));
  const filas = Object.values(resumen).reduce((a, b) => a + b, 0);
  fs.writeFileSync(path.join(destino, "resumen.json"), JSON.stringify({ fecha: new Date().toISOString(), tablas: resumen, fotos: fotos.length }, null, 2));
  console.log(`Base: ${Object.keys(resumen).length} tablas, ${filas} filas, ${resumen["auth.users"] ?? 0} cuentas.`);
  if (!args.includes("--sin-fotos")) await bajarFotos(fotos, path.join(carpeta, "fotos"));
  borrarViejos();
  console.log("Backup terminado.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`El backup falló: ${e.message}`);
    process.exit(1);
  });
}
