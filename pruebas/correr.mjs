// Corre todas las pruebas: la base (SQL en Postgres embebido) y la app (con Supabase simulado, en Chrome).
//   npm run pruebas            todo
//   npm run pruebas -- sql     solo la base
//   npm run pruebas -- app     solo la app
//   npm run pruebas -- chat    solo las pruebas de la app cuyo nombre tenga "chat"
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");
const app = path.join(aqui, "app");
const filtro = process.argv[2] || "";
const PUERTO = 5199;

// Pruebas que quedaron viejas: la app cambió después y hay que actualizarlas (por ahora, ninguna).
// Se corren igual y se muestran, pero no hacen fallar la corrida. Al arreglar una, sacarla de acá.
const VIEJAS = new Set([]);

function correr(archivo, cwd) {
  return new Promise((listo) => {
    const inicio = Date.now();
    const hijo = spawn(process.execPath, [archivo], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    hijo.on("close", (codigo) => listo({ ok: codigo === 0, salida, segundos: Math.round((Date.now() - inicio) / 1000) }));
  });
}

// La foto de prueba y las imágenes del Bocha se dibujan acá (no se guardan fotos reales en el repo).
async function generarArchivos() {
  const dir = path.join(app, "archivos");
  const faltan = ["foto-original.jpg", "bocha.webp", "bocha-evo.webp"].filter((f) => !fs.existsSync(path.join(dir, f)));
  if (!faltan.length) return;
  const b = await chromium.launch({ channel: "chrome", headless: true });
  const p = await b.newPage();
  const hechos = await p.evaluate(async () => {
    const dibujar = async (ancho, alto, tipo, pintar) => {
      const c = document.createElement("canvas"); c.width = ancho; c.height = alto;
      pintar(c.getContext("2d"), ancho, alto);
      const blob = await new Promise((ok) => c.toBlob(ok, tipo, 0.9));
      return [...new Uint8Array(await blob.arrayBuffer())];
    };
    const plato = (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#7fb3e0"); g.addColorStop(0.45, "#3d6b35"); g.addColorStop(1, "#5d8a3a");
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) { x.fillStyle = `hsla(${90 + (i % 40)},45%,${25 + (i % 30)}%,0.5)`; x.fillRect((i * 97) % w, h * 0.45 + ((i * 53) % (h * 0.55)), 40, 12); }
      x.fillStyle = "#d9d2c5"; x.beginPath(); x.ellipse(w / 2, h * 0.6, w * 0.32, h * 0.12, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#b5651d"; x.beginPath(); x.ellipse(w / 2, h * 0.58, w * 0.2, h * 0.07, 0, 0, Math.PI * 2); x.fill();
    };
    const bocha = (color) => (x, w, h) => {
      x.fillStyle = color; x.beginPath(); x.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.beginPath(); x.arc(w * 0.38, h * 0.42, w * 0.07, 0, Math.PI * 2); x.arc(w * 0.62, h * 0.42, w * 0.07, 0, Math.PI * 2); x.fill();
    };
    return {
      "foto-original.jpg": await dibujar(3000, 4000, "image/jpeg", plato),
      "bocha.webp": await dibujar(600, 600, "image/webp", bocha("#7a4a1e")),
      "bocha-evo.webp": await dibujar(600, 600, "image/webp", bocha("#4a2a0e")),
    };
  });
  await b.close();
  for (const f of faltan) fs.writeFileSync(path.join(dir, f), Buffer.from(hechos[f]));
}

async function esperarServidor() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://localhost:${PUERTO}`)).ok) return; } catch { /* todavía no */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("La app de prueba no arrancó");
}

const resultados = [];
if (filtro !== "app") {
  console.log("Base de datos (todos los SQL en orden)…");
  const r = await correr(path.join(aqui, "sql", "todo.mjs"), path.join(aqui, "sql"));
  resultados.push(["sql", r]);
  console.log(r.ok ? `  ok (${r.segundos} s)` : `  FALLÓ\n${r.salida.split("\n").slice(-25).join("\n")}`);
}
if (filtro !== "sql") {
  // Si ya hay algo en el puerto, las pruebas le hablarían a otra app.
  const ocupado = await fetch(`http://localhost:${PUERTO}`).then(() => true, () => false);
  if (ocupado) {
    console.error(`El puerto ${PUERTO} ya está en uso: cerrá la otra app (o el otro "npm run pruebas") y probá de nuevo.`);
    process.exit(1);
  }
  await generarArchivos();
  fs.mkdirSync(path.join(app, "capturas"), { recursive: true });
  const vite = spawn(process.execPath, [path.join(raiz, "node_modules", "vite", "bin", "vite.js"), "--config", path.join(app, "vite.config.js")], { cwd: raiz, stdio: "ignore" });
  try {
    await esperarServidor();
    const archivos = fs.readdirSync(app).filter((f) => f.endsWith("-prueba.mjs") && (!filtro || filtro === "app" || f.includes(filtro))).sort();
    console.log(`App: ${archivos.length} pruebas…`);
    for (const f of archivos) {
      const r = await correr(path.join(app, f), app);
      const vieja = VIEJAS.has(f) && !r.ok;
      resultados.push([f, { ...r, vieja }]);
      console.log(`  ${r.ok ? "ok   " : vieja ? "vieja" : "FALLÓ"} ${f} (${r.segundos} s)${r.ok && VIEJAS.has(f) ? "  <- ya anda: sacala de VIEJAS" : ""}`);
      if (!r.ok && !vieja) {
        // Primero el mensaje del error (lo que importa), después el final de la salida.
        const lineas = r.salida.split("\n").filter((l) => !/^\s+at /.test(l) && !/^\s*'?\s+- /.test(l));
        const clave = lineas.filter((l) => /Error|actual:|expected:|\.mjs:\d+/.test(l)).slice(0, 6);
        console.log([...clave, "...", ...lineas.slice(-6)].map((l) => `        ${l.trim()}`).join("\n"));
      }
    }
  } finally {
    vite.kill();
  }
}
const fallas = resultados.filter(([, r]) => !r.ok && !r.vieja);
const viejas = resultados.filter(([, r]) => r.vieja);
if (viejas.length) console.log(`
${viejas.length} pruebas viejas para actualizar: ${viejas.map(([f]) => f).join(", ")}`);
console.log(fallas.length ? `\n${fallas.length} de ${resultados.length} fallaron: ${fallas.map(([f]) => f).join(", ")}` : `\nTodas pasaron (${resultados.length}).`);
process.exit(fallas.length ? 1 : 0);
