import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__salida = true;
  const Real = Date; const meta = new Real(); meta.setHours(23, 30, 0, 0); const d = meta.getTime() - Real.now();
  class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
  window.Date = C;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
const mia = () => p.evaluate(() => window.__db.comidas.find((c) => c.tipo === "fiesta" && c.usuario_id === "u1"));

// 1) Nahuel me sumó a su salida: se ve en el resumen.
assert.match(await p.locator(".fiesta-accion small").innerText(), /Nahuel te sumó a su salida/);
await p.locator(".fiesta-accion").click();
await p.getByRole("heading", { name: "Modo fiesta" }).waitFor();
await p.waitForTimeout(500);
await p.screenshot({ path: "capturas/salida-invitacion.png" });
await p.getByRole("button", { name: "Sumarme" }).click();
await p.waitForTimeout(900);
let yo = await mia();
assert.equal(yo?.salida, "fz5", "quedé en la salida");
// Mis vasos, en mi carga.
await p.locator(".sumar-vaso").click(); await p.waitForTimeout(900);
yo = await mia();
assert.equal(yo.alimentos.length, 1);
assert.equal(yo.salida, "fz5");
// Se ve quién está y cuánto tomó cada uno.
const chips = await p.locator(".fiesta-salida .persona-chip").allInnerTexts();
console.log(chips.map((t) => t.replace(/\n/g, " ")));
assert.ok(chips.some((t) => /Nahuel[\s\S]*2 vasos/.test(t)));
assert.ok(chips.some((t) => /Juan[\s\S]*3 vasos/.test(t)));
assert.equal(await p.locator(".fiesta-salida .persona-chip", { hasText: "Juan" }).locator("svg").count() >= 1, true, "con la pelotita dibujada");
// Sumo a Tobi: le llega el aviso.
await p.locator(".fiesta-salida .persona-chip", { hasText: "Tobi" }).click();
await p.waitForTimeout(900);
assert.deepEqual((await mia()).salida_con, ["u4"]);
assert.ok(avisos.some((a) => a.tipo === "salida" && a.id === yo.id), JSON.stringify(avisos));
await p.screenshot({ path: "capturas/salida-modo-fiesta.png" });
await p.keyboard.press("Escape");
await p.waitForTimeout(700);

// 2) En el grupo: una sola tarjeta con lo de cada uno.
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /Fiesta/ }).click();
await p.waitForTimeout(900);
const salida = p.locator(".tarjeta.salida");
assert.equal(await salida.count(), 1);
const filas = await salida.locator(".salida-ranking li").allInnerTexts();
console.log(filas.map((t) => t.replace(/\n/g, " ")));
assert.match(filas[0], /Juan[^·]*· 3 vasos[\s\S]*2 × Gin tonic, 1 × Aperol spritz[\s\S]*Gol/);
assert.match(filas[1], /Nahuel[^·]*· 2 vasos/);
assert.match(filas[2], /Vos[^·]*· 1 vaso/);
assert.match(await salida.locator(".salida-total").innerText(), /Entre todos: 6 vasos/);
assert.match(await salida.locator(".cartel-gol").innerText(), /HUBO GOL/);
assert.equal(await p.locator(".tarjeta.comida:not(.salida)", { hasText: "Fiesta:" }).count(), 0, "no se repiten sueltas");
await salida.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/salida-grupo.png" });

// 3) Reaccionar a la salida: le avisa solo a Nahuel (el server filtra al dueño).
await salida.getByRole("button", { name: "Reaccionar" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Reaccionar con 🔥" }).first().click();
await p.waitForTimeout(800);
assert.ok(avisos.some((a) => a.tipo === "reaccion" && a.id === "fz5" && a.nombre === "🔥"), JSON.stringify(avisos));

assert.deepEqual(errores, []);
await b.close();
console.log("salida en grupo y reacciones: pruebas pasadas");
