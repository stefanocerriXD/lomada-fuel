import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(conCaptura = true) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
  await ctx.addInitScript(() => {
    localStorage.setItem("comidas-bienvenida", "vista");
    const Real = Date; const meta = new Real(); meta.setHours(21, 20, 0, 0); const d = meta.getTime() - Real.now();
    class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
    window.Date = C;
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1200);
  await p.evaluate(async (con) => {
    const { fechaLocal } = await import("/src/lib/fechas.js");
    const f = fechaLocal();
    window.__db.salud_comidas.push({ id: "s2", usuario_id: "u1", fecha: f, momento: `${f}T21:05:00-03:00`, kcal: 650, proteinas: 40, carbohidratos: 70, grasas: 20 });
    window.__db.salud_capturas = con ? [{ id: "cap1", usuario_id: "u1", fecha: f, creado_en: new Date().toISOString(), texto: "Cena 650\nMilanesa de carne\n200 g · 480 kcal\nEnsalada mixta\n150 g · 170 kcal" }] : [];
  }, conCaptura);
  await p.locator(".boton-subir").click();
  await p.getByRole("heading", { name: "Subir comida" }).waitFor();
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const kcalTotal = async (p) => Number((await p.locator(".pie-total strong").innerText()).replace(/\D/g, ""));

let { ctx, p } = await abrir();
let filas = await p.locator(".fila-item").allInnerTexts();
console.log("solo:", filas.map((t) => t.split("\n")[0]));
assert.equal(filas.length, 2);
assert.ok(!filas.join(" ").includes("de Apple Salud"));
assert.equal(await kcalTotal(p), 650);
assert.match(await p.locator(".pie-total").innerText(), /P 40 · C 70 · G 20/);
assert.match(await p.locator(".nota-captura").innerText(), /captura de MyFitnessPal/);
await p.screenshot({ path: "capturas/captura-auto.png" });
// Solo totales: vuelve la línea de Salud y no se vuelve a reemplazar.
await p.getByRole("button", { name: /Solo totales/ }).click(); await p.waitForTimeout(500);
filas = await p.locator(".fila-item").allInnerTexts();
assert.equal(filas.length, 1); assert.match(filas[0], /Apple Salud/);
await p.waitForTimeout(500);
assert.equal(await p.locator(".fila-item").count(), 1, "no se re-aplica");
await ctx.close();

// Sin captura: queda como antes (línea de Salud con Ver los alimentos).
({ ctx, p } = await abrir(false));
filas = await p.locator(".fila-item").allInnerTexts();
assert.equal(filas.length, 1); assert.match(filas[0], /Apple Salud/);
assert.match(await p.locator(".nota-salud").innerText(), /Ver los alimentos/);
await ctx.close();
assert.deepEqual(errores, []);
await b.close();
console.log("captura automatica ok");
