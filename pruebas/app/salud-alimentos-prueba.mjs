import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir() {
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
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    const { fechaLocal } = await import("/src/lib/fechas.js");
    const f = fechaLocal();
    window.__db.salud_comidas.push({ id: "s2", usuario_id: "u1", fecha: f, momento: `${f}T21:05:00-03:00`, kcal: 650, proteinas: 40, carbohidratos: 70, grasas: 20 });
  });
  await p.locator(".boton-subir").click();
  await p.getByRole("heading", { name: "Subir comida" }).waitFor();
  await p.locator(".nota-salud").waitFor();
  return { ctx, p };
}
const kcalTotal = async (p) => Number((await p.locator(".pie-total strong").innerText()).replace(/\D/g, ""));

// 1) Captura con las calorías de cada alimento: entran tal cual.
let { ctx, p } = await abrir();
await p.waitForTimeout(800);
assert.match(await p.locator(".nota-salud").innerText(), /Ver los alimentos/);
await p.screenshot({ path: "capturas/salud-ver-alimentos.png" });
await p.getByRole("button", { name: /Ver los alimentos/ }).click();
await p.waitForTimeout(400);
assert.match(await p.locator(".tarjeta-interna .nota").first().innerText(), /captura a esta comida/);
await p.getByLabel("Texto del resumen").fill("Cena\nMilanesa de carne\n200 g · 480 kcal\nEnsalada mixta\n150 g · 170 kcal");
await p.getByRole("button", { name: "Leer texto" }).click();
await p.waitForTimeout(1200);
let filas = await p.locator(".fila-item").allInnerTexts();
console.log("con kcal:", filas.map((t) => t.split("\n").slice(0, 2).join(" · ")));
assert.equal(filas.length, 2);
assert.ok(!filas.join(" ").includes("de Apple Salud"), "se reemplazó la línea de Salud");
assert.equal(await kcalTotal(p), 650);
const macros = await p.locator(".pie-total").innerText();
console.log("totales:", macros.replace(/\n/g, " "));
assert.match(macros, /P 40 · C 70 · G 20/, "los macros dan lo de MyFitnessPal");
assert.equal(await p.locator(".nota-salud").count(), 0);
await p.screenshot({ path: "capturas/salud-alimentos.png" });
// Publicar: la entrada de Salud queda usada (no vuelve a ofrecerse).
await p.getByRole("button", { name: "Publicar comida" }).click();
await p.waitForTimeout(600);
if (await p.locator(".confirmar-publicar").count()) await p.getByRole("button", { name: /Publicar igual/ }).click();
await p.waitForTimeout(1200);
const guardada = await p.evaluate(() => window.__db.comidas.find((c) => (c.alimentos || []).some((a) => a.salud_id === "s2")));
assert.ok(guardada && guardada.alimentos.length === 2 && guardada.tipo === "cena", JSON.stringify(guardada?.alimentos));
await ctx.close();

// 2) Captura sin calorías por alimento: se estiman y se ajustan a lo que mandó Salud.
({ ctx, p } = await abrir());
await p.getByRole("button", { name: /Ver los alimentos/ }).click();
await p.getByLabel("Texto del resumen").fill("Cena\nMilanesa de carne, 200 g\nPuré de papa, 200 g");
await p.getByRole("button", { name: "Leer texto" }).click();
await p.waitForTimeout(1200);
filas = await p.locator(".fila-item").allInnerTexts();
console.log("estimados:", filas.map((t) => t.split("\n").slice(0, 2).join(" · ")), "total", await kcalTotal(p));
assert.equal(filas.length, 2);
assert.ok(Math.abs((await kcalTotal(p)) - 650) <= 3, "da lo de Salud");
await ctx.close();

// 3) Una captura que no sirve: avisa y deja la de Salud.
({ ctx, p } = await abrir());
await p.getByRole("button", { name: /Ver los alimentos/ }).click();
await p.getByLabel("Texto del resumen").fill("hola");
await p.getByRole("button", { name: "Leer texto" }).click();
await p.waitForTimeout(800);
assert.match(await p.locator("[role=alert]").first().innerText(), /No encontramos alimentos/);
assert.match(await p.locator(".fila-item").first().innerText(), /Apple Salud/);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("alimentos de la comida de Salud: pruebas pasadas");
