import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(banderas = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("lomada-actualizaciones-vistas", "zzz"); Object.assign(window, f); }, banderas);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click(); await p.waitForTimeout(600);
  return { ctx, p };
}
// Dueño: ve el panel
let { ctx, p } = await abrir({ __mejoraOtro: true });
await p.getByRole("button", { name: /Panel del dueño/ }).click(); await p.waitForTimeout(800);
const panel = await p.locator(".panel-dueno").innerText();
assert.match(panel, /La app en números/i);
assert.match(panel, /23\s*usuarios/);
assert.match(panel, /Usuarios registrados \(/i);
assert.match(panel, /Huevo/);
await p.locator(".panel-dueno").screenshot({ path: "capturas/dueno-panel.png" });
await p.locator(".dueno-barras-zona").first().locator("button").nth(5).click();
assert.match(await p.locator(".dueno-barras-valor").first().innerText(), /12 comidas · 5 personas/);
await p.getByLabel("Buscar usuarios").fill("nahu");
assert.equal(await p.locator(".dueno-usuarios li").count(), 1);
// Volver: mejoras con desplegables
await p.goto("http://localhost:5199"); await p.waitForTimeout(1300);
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click(); await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Mejoras/ }).click(); await p.waitForTimeout(600);
const sums = await p.locator(".desplegable-mejoras summary").allInnerTexts();
console.log("mejoras:", sums);
assert.ok(sums[0].startsWith("Mejoras del grupo"));
assert.ok(sums[1].startsWith("Mejoras de otros grupos"));
assert.equal(await p.locator(".desplegable-mejoras .lista-mejoras").first().isVisible(), false, "cerrado de entrada");
await p.locator(".desplegable-mejoras summary").first().click();
assert.match(await p.locator(".desplegable-mejoras").first().innerText(), /Modo oscuro más oscuro/);
await ctx.close();
// No dueño: no hay panel ni otros grupos
({ ctx, p } = await abrir({ __noDueno: true }));
assert.equal(await p.getByRole("button", { name: /Panel del dueño/ }).count(), 0);
// Actualizaciones vuelve
assert.equal(await p.getByRole("button", { name: /^Actualizaciones/ }).count(), 1);
await p.getByRole("button", { name: /^Actualizaciones/ }).click(); await p.waitForTimeout(500);
assert.match(await p.locator("main").innerText(), /Notificaciones a medida/);
await p.screenshot({ path: "capturas/actualizaciones.png" });
await p.goto("http://localhost:5199"); await p.waitForTimeout(1300);
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click(); await p.waitForTimeout(500);
// Notificaciones a medida
await p.getByRole("button", { name: /^Notificaciones/ }).click(); await p.waitForTimeout(600);
const llave = p.getByRole("switch", { name: /Mensajes del chat/ });
if (await llave.count()) {
  assert.equal(await llave.getAttribute("aria-checked"), "true");
  await llave.click(); await p.waitForTimeout(300);
  assert.equal(await llave.getAttribute("aria-checked"), "false");
  assert.deepEqual(await p.evaluate(() => window.__db.preferencias_avisos[0].apagados), ["mensajes"]);
  assert.equal(await p.getByRole("switch", { name: /Match Day/ }).count(), 1, "en Lomada aparece Match Day");
  await p.screenshot({ path: "capturas/preferencias.png", fullPage: true });
  console.log("preferencias ok");
} else console.log("(sin seccion de notificaciones disponible en el doble)");
await ctx.close();
assert.deepEqual(errores, []);
console.log("dueno ok");
await b.close();
