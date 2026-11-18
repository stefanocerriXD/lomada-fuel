import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(extra, url = "http://localhost:5199") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript(() => { window.__mostrarInstalar = true; });
  await ctx.addInitScript(extra || (() => {}));
  await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(url);
  await p.waitForTimeout(1300);
  return { ctx, p };
}
// Domingo: se fuerza la fecha
let { ctx, p } = await abrir(() => {
  const Real = Date;
  const domingo = new Real("2026-11-08T11:00:00-03:00").getTime();
  const inicio = Real.now();
  globalThis.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [domingo + (Real.now() - inicio)])); } static now() { return domingo + (Real.now() - inicio); } };
});
assert.equal(await p.locator(".dia-partido").count(), 0, "ya no está el cartel del domingo");
assert.equal(await p.locator(".instalar-app").count(), 1, "en el navegador del celular aparece el cartel");
await p.screenshot({ path: "capturas/d-domingo.png" });
await p.getByRole("button", { name: "Cerrar aviso" }).first().click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".instalar-app").count(), 0, "se puede cerrar");
// Chat con colores por persona
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(700);
const colores = await p.locator(".burbuja .autor").evaluateAll((e) => [...new Set(e.map((x) => getComputedStyle(x).color))]);
console.log("colores de nombres:", colores);
assert.ok(colores.length >= 2, "cada persona con su color");
const nombres = await p.locator(".burbuja .autor").evaluateAll((e) => Object.fromEntries(e.map((x) => [x.textContent, getComputedStyle(x).color])));
console.log("por persona:", nombres);
assert.equal(new Set(Object.values(nombres)).size, Object.keys(nombres).length, "nadie comparte color");
// El logo ahora es el disco dibujado (Logo.jsx), en todos los temas.
assert.equal(await p.locator(".barra-superior .marca svg.logo-app").count(), 1, "la marca lleva el logo");
await p.screenshot({ path: "capturas/d-chat.png" });
await ctx.close();
// Lunes: no aparece
({ ctx, p } = await abrir(() => {
  const Real = Date;
  const lunes = new Real("2026-11-09T11:00:00-03:00").getTime();
  const inicio = Real.now();
  globalThis.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [lunes + (Real.now() - inicio)])); } static now() { return lunes + (Real.now() - inicio); } };
}));
assert.equal(await p.locator(".dia-partido").count(), 0);
await ctx.close();
// Abierta como app: sin cartel
({ ctx, p } = await abrir(() => Object.defineProperty(navigator, "standalone", { get: () => true })));
assert.equal(await p.locator(".instalar-app").count(), 0, "como app no aparece");
await ctx.close();
await b.close();
assert.deepEqual(errores, []);
console.log("domingo, cartel de app y colores: pruebas pasadas");
