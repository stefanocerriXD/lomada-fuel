import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  // 9:30: el + abre en Desayuno (después de almorzar o cenar, el postre aparece solo: eso lo prueba postre-y-dia).
  const Real = Date; const meta = new Real(); meta.setHours(9, 30, 0, 0); const d = meta.getTime() - Real.now();
  class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
  window.Date = C;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
// El resumen ya no pide el postre.
assert.equal(await p.locator(".postre-aviso").count(), 0);
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(500);
// En el desayuno no aparece; al elegir colación, sí.
assert.equal(await p.locator(".postre-opcion, .postre-atajos").count(), 0);
await p.getByRole("radio", { name: /Colaciones/ }).click();
const opcion = p.locator(".postre-opcion");
await opcion.waitFor();
assert.match(await opcion.innerText(), /¿Es postre\?\s*Sumalo a tu almuerzo/);
await p.waitForTimeout(400);
await p.screenshot({ path: "capturas/postre-colacion.png" });
await opcion.click();
await p.getByRole("heading", { name: "Agregar postre" }).waitFor();
assert.equal(await p.locator(".postre-nota").count(), 1);
await p.getByLabel("Buscar alimento o producto").fill("flan");
await p.waitForTimeout(800);
await p.locator(".resultado, [class*=resultado] button").first().click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Guardar/ }).last().click();
await p.waitForTimeout(1500);
const c2 = await p.evaluate(() => window.__db.comidas.find((c) => c.id === "c2").alimentos);
assert.ok(c2.some((a) => a.postre), "el postre queda en el almuerzo");
assert.deepEqual(errores, []);
await b.close();
console.log("postre en colación: pruebas pasadas");
