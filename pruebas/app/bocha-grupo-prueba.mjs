// El Bocha de cada grupo (SQL 072): sin imagen propia sale el dibujo; quien administra sube la suya, la cambia
// o vuelve al dibujo. Quien no administra no ve los botones.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((f) => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const castigar = (p) => p.evaluate(() => {
  const f = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toLocaleDateString("en-CA"); };
  window.__db.comidas = window.__db.comidas.filter((c) => !(c.usuario_id === "u1" && c.fecha === f(0)));
  window.__db.multas = [{ usuario_id: "u1", fecha: f(1), fotos: 0 }];
  window.__canalDatos().emitir("multas", { eventType: "INSERT" });
  window.__canalDatos().emitir("comidas", { eventType: "DELETE", old: {} });
});

// 1) Grupo sin imagen propia: el Bocha es el dibujo.
let { ctx, p } = await abrir({ __con072: true });
await castigar(p);
const cartel = p.getByRole("dialog", { name: "La maldición del Bocha" });
await cartel.waitFor({ timeout: 5000 });
await p.waitForTimeout(800);
assert.match(await cartel.locator("img").getAttribute("src"), /\/bocha-dibujo\.svg$/);
assert.ok(await cartel.locator("img").evaluate((i) => i.complete && i.naturalWidth > 0), "el dibujo carga");
await p.screenshot({ path: "capturas/bocha-dibujo.png" });
await ctx.close();

// 2) Quien administra: sube la suya y vuelve al dibujo.
({ ctx, p } = await abrir({ __con072: true }));
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.getByRole("button", { name: /La cacona/ }).first().click();
const imagenes = p.locator(".la-caca-imagenes");
await imagenes.waitFor();
assert.match(await imagenes.innerText(), /Imágenes del Bocha[\s\S]*Si no subís ninguna, sale el dibujo/i);
assert.equal(await imagenes.locator("img").count(), 2, "las dos con el dibujo");
await imagenes.screenshot({ path: "capturas/bocha-imagenes-dibujo.png" });
await imagenes.getByLabel("Imagen del Bocha", { exact: true }).setInputFiles({ name: "mio.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
await p.locator(".aviso", { hasText: "Imagen guardada" }).waitFor({ timeout: 8000 });
const ruta = await p.evaluate(() => window.__bochaGrupo.dia);
assert.match(ruta, /^u1\/bocha\/bocha-\d+\./, "guardada para el grupo");
await imagenes.getByRole("button", { name: "Dibujo" }).waitFor();
await imagenes.getByRole("button", { name: "Dibujo" }).click();
await p.locator(".aviso", { hasText: "vuelve el dibujo" }).waitFor();
assert.equal(await p.evaluate(() => window.__bochaGrupo.dia), null);
await ctx.close();

// 3) Quien no administra: las reglas, sin botones de imágenes.
({ ctx, p } = await abrir({ __con072: true, __noAdminBocha: true }));
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.getByRole("button", { name: /La cacona/ }).first().click();
await p.locator(".la-caca-reglas").waitFor();
assert.equal(await p.locator(".la-caca-imagenes").count(), 0);
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("el Bocha de cada grupo: pasó");
