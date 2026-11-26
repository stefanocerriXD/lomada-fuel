import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";
import { castigoDe } from "../../src/lib/multas.js";

// El Bocha Evo dura un día: el lunes que guarda la fila. El martes (y el resto de la semana) ya no.
const evoDel = (hoy) => castigoDe({ usuarioId: "u1", multas: [], bochaEvo: [{ usuario_id: "u1", semana: "2026-11-23", cacas: 5 }], comidas: [], hoy });
assert.equal(evoDel("2026-11-23").evo, true, "el lunes, sí");
assert.equal(evoDel("2026-11-24").evo, false, "el martes ya no");
assert.equal(evoDel("2026-11-26").activo, false, "el jueves, nada");

const B = "archivos/";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir() {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route("https://prueba.local/bocha.webp", (r) => r.fulfill({ body: fs.readFileSync(B + "bocha.webp"), contentType: "image/webp" }));
  await ctx.route("https://prueba.local/bocha-evo.webp", (r) => r.fulfill({ body: fs.readFileSync(B + "bocha-evo.webp"), contentType: "image/webp" }));
  await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const castigar = (p, evo) => p.evaluate((evo) => {
  const f = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toLocaleDateString("en-CA"); };
  const hoy = f(0);
  // Hoy todavía no subí ninguna foto.
  window.__db.comidas = window.__db.comidas.filter((c) => !(c.usuario_id === "u1" && c.fecha === hoy));
  window.__db.multas = [{ usuario_id: "u1", fecha: f(1), fotos: 0 }, { usuario_id: "u3", fecha: f(1), fotos: 0 }];
  // El Evo es del día que dice la fila (en la base siempre un lunes): hoy, para que la prueba ande cualquier día.
  window.__db.bocha_evo = evo ? [{ usuario_id: "u1", semana: hoy, cacas: 5 }] : [];
  window.__canalDatos().emitir("multas", { eventType: "INSERT" });
  window.__canalDatos().emitir("comidas", { eventType: "DELETE", old: {} });
}, evo);

// ---------- Castigo del día ----------
let { ctx, p } = await abrir();
await castigar(p, false);
const cartel = p.getByRole("dialog", { name: "La maldición del Bocha" });
await cartel.waitFor({ timeout: 5000 });
await p.waitForTimeout(700);
await p.screenshot({ path: "capturas/bocha-cartel.png" });
await cartel.click();
await p.waitForTimeout(1600);
const manchas = await p.locator(".mancha-caca").count();
console.log("manchas del día:", manchas);
assert.ok(manchas >= 1 && manchas <= 3, "poca caca");
assert.ok((await p.locator(".avatar-caca").count()) > 0, "💩 al lado del nombre");
await p.screenshot({ path: "capturas/bocha-resumen.png" });
// Limpiar: se frota una mancha hasta que desaparece.
await p.getByRole("button", { name: "Limpiar" }).click();
await p.waitForTimeout(300);
const antes = await p.locator(".mancha-caca").count();
const caja = await p.locator(".mancha-caca").first().boundingBox();
const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
await p.mouse.move(cx - 25, cy);
await p.mouse.down();
for (let i = 0; i < 14; i++) { await p.mouse.move(cx + 25, cy, { steps: 6 }); await p.mouse.move(cx - 25, cy, { steps: 6 }); }
await p.mouse.up();
await p.waitForTimeout(600);
const despues = await p.locator(".mancha-caca").count();
console.log("manchas antes/después de frotar:", antes, despues);
assert.ok(despues < antes, "frotando se limpia");
await p.screenshot({ path: "capturas/bocha-limpiando.png" });
await p.getByRole("button", { name: "Listo" }).click().catch(() => {});
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
// El chat se baja al abrirlo: se espera a que esté (si no, los "no hay botón" pasarían sin chat).
await p.locator(".castigo-nota.chat").waitFor({ timeout: 10000 });
assert.equal(await p.getByRole("button", { name: "Stickers" }).count(), 0, "en castigo, solo texto");
assert.equal(await p.getByLabel("Mandar foto o GIF").count(), 0);
assert.ok((await p.locator(".castigo-nota.chat").count()) === 1);
await p.screenshot({ path: "capturas/bocha-chat.png" });
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(700);
assert.ok((await p.locator(".foto-castigo").count()) > 0, "fotos ajenas borrosas");
await p.locator(".fotos-lista .comida").first().getByRole("button", { name: "Reaccionar", exact: true }).click();
await p.waitForTimeout(300);
assert.equal(await p.locator(".selector-reacciones").count(), 0, "sin reacciones");
await p.screenshot({ path: "capturas/bocha-imagenes.png" });
// Al subir la foto de hoy se levanta.
await p.evaluate(() => {
  window.__db.comidas.unshift({ id: "hoy1", usuario_id: "u1", tipo: "almuerzo", fecha: new Date().toLocaleDateString("en-CA"), foto_path: "f1", descripcion: "Mi almuerzo", calorias: 500, proteinas: 30, carbohidratos: 50, grasas: 15, alimentos: [], creado_en: new Date().toISOString(), macros_editados: false, privada: false });
  window.__canalDatos().emitir("comidas", { eventType: "INSERT" });
});
await p.waitForTimeout(900);
assert.equal(await p.locator(".mancha-caca").count(), 0, "se van las manchas");
assert.equal(await p.locator(".foto-castigo").count(), 0, "se ven las fotos");
assert.ok((await p.locator(".avatar-caca").count()) > 0, "la 💩 queda");
await ctx.close();

// ---------- Bocha Evo ----------
({ ctx, p } = await abrir());
await castigar(p, true);
const evo = p.getByRole("dialog", { name: "Bocha Evo" });
await evo.waitFor({ timeout: 5000 });
await p.waitForTimeout(700);
await p.screenshot({ path: "capturas/evo-cartel.png" });
await evo.click();
await p.waitForTimeout(2200);
assert.equal(await p.evaluate(() => document.documentElement.dataset.tema), "caca", "app marrón");
const manchasEvo = await p.locator(".mancha-caca").count();
console.log("manchas evo:", manchasEvo);
assert.ok(manchasEvo >= 4 && manchasEvo <= 7, "el Evo, algo más");
await p.screenshot({ path: "capturas/evo-resumen.png" });
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(700);
assert.equal(await p.locator(".teclado-caca").count(), 1, "teclado tapado");
assert.equal(await p.getByLabel("Mensaje").count(), 0);
await p.screenshot({ path: "capturas/evo-chat.png" });
// Cargar comidas sigue andando.
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click().catch(() => {});
await ctx.close();
await b.close();
assert.deepEqual(errores, []);
console.log("la caca: pruebas pasadas");
