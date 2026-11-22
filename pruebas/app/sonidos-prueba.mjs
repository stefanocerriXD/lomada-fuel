import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__registrosConfig = { usuario_id: "u1", activos: ["creatina", "gym"], aviso: false };
  window.__notas = 0;
  const original = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...a) { window.__notas += 1; return original.apply(this, a); };
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199"); await p.waitForTimeout(1600);
await p.mouse.click(5, 300); // primer toque: destraba y suena la bienvenida
await p.waitForTimeout(300);
const notas = () => p.evaluate(() => window.__notas);
const bienvenidas = () => p.evaluate(() => window.__bienvenidas || 0);
assert.equal(await bienvenidas(), 1, "suena la bienvenida con el primer toque");
await p.mouse.click(5, 300);
await p.waitForTimeout(300);
assert.equal(await bienvenidas(), 1, "solo una vez");
await p.reload(); await p.waitForTimeout(1600);
await p.mouse.click(5, 300); await p.waitForTimeout(300);
assert.equal(await bienvenidas(), 0, "al recargar en la misma sesión no se repite");
const tarjeta = p.locator(".registros-dia");
await tarjeta.scrollIntoViewIfNeeded();
let antes = await notas();
await tarjeta.getByRole("button", { name: /Tomé la creatina/ }).click(); await p.waitForTimeout(300);
console.log("tic:", (await notas()) - antes);
assert.ok((await notas()) > antes, "suena el tic");
antes = await notas();
await p.getByRole("button", { name: "Sumar un vaso de 250 mililitros" }).click(); await p.waitForTimeout(300);
console.log("gota:", (await notas()) - antes);
assert.ok((await notas()) > antes, "suena el agua");
antes = await notas();
await p.locator("[aria-label='Subir comida']").last().click(); await p.waitForTimeout(400);
console.log("pop:", (await notas()) - antes);
assert.ok((await notas()) > antes, "suena el +");
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
// Las pestañas de abajo suenan al tocarlas.
for (const nombre of ["Grupo", "Logros", "Resumen"]) {
  antes = await notas();
  await p.locator(".barra-inferior").getByRole("button", { name: nombre }).click(); await p.waitForTimeout(400);
  assert.ok((await notas()) > antes, `suena la pestaña ${nombre}`);
}
// Apagar en Ajustes
await p.getByRole("button", { name: "Ajustes" }).last().click(); await p.waitForTimeout(500);
await p.getByRole("button", { name: /Apariencia y sonidos/ }).click(); await p.waitForTimeout(400);
await p.getByRole("radio", { name: "Sin sonido" }).click();
assert.equal(await p.evaluate(() => localStorage.getItem("lomada-sonidos")), "no");
await p.screenshot({ path: "capturas/sonidos-ajustes.png" });
antes = await notas();
await p.getByRole("radio", { name: "Con sonido" }).click(); await p.waitForTimeout(300);
console.log("ding al prender:", (await notas()) - antes);
assert.ok((await notas()) > antes);
await p.getByRole("radio", { name: "Sin sonido" }).click();
await p.getByRole("button", { name: "Resumen" }).last().click(); await p.waitForTimeout(600);
antes = await notas();
await tarjeta.scrollIntoViewIfNeeded();
await tarjeta.getByRole("button", { name: /gym/i }).first().click(); await p.waitForTimeout(300);
assert.equal(await notas(), antes, "apagado no suena");
assert.deepEqual(errores, []);
console.log("sonidos ok");
await b.close();
