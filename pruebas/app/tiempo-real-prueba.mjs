// Comidas en tiempo real: lo que publica otro aparece al instante (sin volver a bajar todo), tanto si llega de la
// base como directo de quien la publica. Y quien publica la manda directo al grupo.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true, enviadas: 0, resultados: [] } }));
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("lomada-guia-historias-estrellas", "vista"); localStorage.setItem("mock-grupo", "lomada"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);

const merienda = p.locator(".hdias .hdia", { hasText: "Merienda" });
const cena = p.locator(".hdias .hdia", { hasText: "Cena" });
assert.match(await merienda.getAttribute("class"), /vacia/, "hoy nadie merendó");
// Espera a que un círculo quede vacío o con algo (mirando la clase).
const esperar = async (loc, vacia, ms) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (/vacia/.test(await loc.getAttribute("class")) === vacia) return;
    await p.waitForTimeout(50);
  }
  throw new Error(`no quedó ${vacia ? "vacía" : "con algo"} en ${ms} ms`);
};
const fila = (id, tipo) => p.evaluate(([id, tipo]) => {
  const hoy = new Date().toLocaleDateString("en-CA");
  return { id, usuario_id: "u2", tipo, fecha: hoy, foto_path: null, descripcion: `${tipo} de Nahuel`, calorias: 300, proteinas: 10, carbohidratos: 40, grasas: 8, alimentos: [], creado_en: new Date().toISOString() };
}, [id, tipo]);

// 1) Llega de la base: aparece al instante, sin bajar la lista entera (la lista no la tiene todavía).
const firmasAntes = await p.evaluate(() => window.__firmas || 0);
const llamadas = await p.evaluate(() => (window.__llamadas || []).filter((x) => x.tabla === "comidas" && x.op === "select").length);
const nueva = await fila("rt1", "merienda");
const t0 = Date.now();
await p.evaluate((c) => window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: c }), nueva);
await esperar(merienda, false, 2000);
assert.ok(Date.now() - t0 < 1500, `tardó ${Date.now() - t0} ms`);
assert.equal(await p.evaluate(() => (window.__llamadas || []).filter((x) => x.tabla === "comidas" && x.op === "select").length), llamadas, "no volvió a bajar todo");
assert.ok((await p.evaluate(() => window.__firmas || 0)) >= firmasAntes);

// 2) Directo de quien la publica (por el canal del chat): también al instante.
assert.match(await cena.getAttribute("class"), /vacia/);
const directa = await fila("rt2", "cena");
await p.evaluate((c) => window.__canalChat().difundir("comida", c), directa);
await esperar(cena, false, 1500);
// Si la sacan (la hicieron privada), se va.
await p.evaluate(() => window.__canalChat().difundir("comida_quitada", { id: "rt2" }));
await esperar(cena, true, 1500);
// La de otro grupo no entra.
await p.evaluate((c) => window.__canalChat().difundir("comida", { ...c, grupos: ["otro-grupo"] }), directa);
await p.waitForTimeout(600);
assert.match(await cena.getAttribute("class"), /vacia/, "la de otro grupo no");

// 3) Quien publica: la manda directo al grupo.
await p.locator("[aria-label='Subir comida']").last().click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Cargar a mano" }).click();
await p.locator("form.carga-manual").getByLabel("Calorías").fill("250");
await p.locator("form.carga-manual").getByRole("button", { name: "Agregar" }).click();
await p.getByLabel("Nota de la comida").fill("Tostado");
await p.getByRole("button", { name: /^Publicar/ }).click();
const confirmar = p.getByRole("alertdialog");
if (await confirmar.isVisible().catch(() => false)) await confirmar.getByRole("button").last().click();
await p.waitForFunction(() => (window.__enviados || []).some((m) => m.event === "comida"), null, { timeout: 5000 });
const enviada = await p.evaluate(() => window.__enviados.find((m) => m.event === "comida").payload);
assert.equal(enviada.usuario_id, "u1");
assert.equal(enviada.descripcion, "Tostado");
assert.ok(enviada.fecha && enviada.creado_en, "con fecha y hora");

await b.close();
assert.deepEqual(errores, []);
console.log("comidas en tiempo real: pasaron");
