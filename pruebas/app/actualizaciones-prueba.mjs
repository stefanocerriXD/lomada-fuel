import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { ACTUALIZACIONES } from "../../src/data/actualizaciones.js";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
// El reloj de la app: "Nuevo" dura 3 días desde la fecha de la novedad más nueva.
const ultima = ACTUALIZACIONES[0].fecha;
const fijarReloj = (ctx, dias) => ctx.addInitScript(([fecha, d]) => {
  const Real = Date;
  const meta = new Real(`${fecha}T12:00:00-03:00`).getTime() + d * 86400000;
  const corrido = meta - Real.now();
  class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + corrido])); } static now() { return Real.now() + corrido; } }
  window.Date = C;
}, [ultima, dias]);
async function abrir(dias) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
  await fijarReloj(ctx, dias);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1500);
  return { ctx, p };
}

// Al día siguiente de la última novedad: hay "Nuevo".
let { ctx, p } = await abrir(1);
const boton = p.getByRole("button", { name: "Ajustes" }).locator("visible=true").first();
assert.equal(await boton.locator(".punto-novedad").count(), 1, "puntito");
await boton.click(); await p.waitForTimeout(500);
const item = p.getByRole("button", { name: /Actualizaciones/ });
assert.match(await item.innerText(), /Nuevo/i);
await item.click(); await p.waitForTimeout(800);
const n = await p.locator(".actualizacion").count();
console.log("actualizaciones:", n, "nuevas:", await p.locator(".actualizacion .pastilla-nuevo").count());
assert.ok(n >= 5);
assert.ok(await p.locator(".actualizacion .pastilla-nuevo").count() >= 1);
await p.screenshot({ path: "capturas/actualizaciones.png" });
assert.equal(await boton.locator(".punto-novedad").count(), 0, "ya vistas");
await p.getByRole("button", { name: "Volver a ajustes" }).click(); await p.waitForTimeout(400);
assert.doesNotMatch(await p.getByRole("button", { name: /Actualizaciones/ }).innerText(), /Nuevo/i);
await p.reload(); await p.waitForTimeout(1500);
assert.equal(await p.getByRole("button", { name: "Ajustes" }).locator("visible=true").first().locator(".punto-novedad").count(), 0);
await ctx.close();

// A los 3 días, aunque no las hayas visto, el cartel de "Nuevo" se va solo.
({ ctx, p } = await abrir(3));
const boton3 = p.getByRole("button", { name: "Ajustes" }).locator("visible=true").first();
assert.equal(await boton3.locator(".punto-novedad").count(), 0, "sin puntito después de 3 días");
await boton3.click(); await p.waitForTimeout(500);
assert.doesNotMatch(await p.getByRole("button", { name: /Actualizaciones/ }).innerText(), /Nuevo/i);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("actualizaciones ok");
