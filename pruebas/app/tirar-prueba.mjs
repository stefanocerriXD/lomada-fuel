import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
const cdp = await ctx.newCDPSession(p);
const toque = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
async function tirar(desde, hasta, pasos = 12, soltar = true) {
  await toque("touchStart", [[195, desde]]);
  for (let i = 1; i <= pasos; i++) { await toque("touchMove", [[195, desde + (hasta - desde) * i / pasos]]); await p.waitForTimeout(16); }
  if (soltar) await toque("touchEnd", []);
}
await p.goto("http://localhost:5199"); await p.waitForTimeout(1800);
const consultas = () => p.evaluate(() => (window.__llamadas || []).filter((l) => l.tabla === "comidas" && !l.op).length);
// Un cambio que llega sin aviso (no hay tiempo real en la prueba)
await p.evaluate(() => { const c = window.__db.comidas.find((x) => x.usuario_id === "u2"); c.descripcion = "Cambió sin avisar"; });
const antes = await consultas();
const antesTotal = await p.evaluate(() => (window.__llamadas || []).length);
// Tirón corto: no actualiza
await tirar(250, 330); await p.waitForTimeout(500);
assert.equal(await p.evaluate(() => (window.__llamadas || []).length), antesTotal, "tirón corto no actualiza");
// Tirón largo: aparece el logo girando y actualiza
await tirar(250, 520, 12, false);
const op = await p.locator(".tirar-actualizar").evaluate((el) => [getComputedStyle(el).opacity, el.className]);
console.log("tirando:", op);
assert.ok(Number(op[0]) > 0.9 && /listo/.test(op[1]));
await p.screenshot({ path: "capturas/tirar.png", clip: { x: 0, y: 0, width: 390, height: 220 } });
await toque("touchEnd", []);
await p.waitForTimeout(150);
assert.match(await p.locator(".tirar-actualizar").getAttribute("class"), /girando/);
await p.waitForTimeout(1200);
const tablas = await p.evaluate((n) => (window.__llamadas || []).slice(n).map((l) => `${l.tabla}:${l.op || "select"}`), antesTotal);
console.log("despues:", [...new Set(tablas)].join(" "));
assert.ok(tablas.includes("comidas:select") && tablas.includes("registros_diarios:select"), "volvió a traer todo");
assert.doesNotMatch(await p.locator(".tirar-actualizar").getAttribute("class"), /girando/);
// Sin scroll arriba de todo no actúa
await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(200);
const antes2 = await p.evaluate(() => (window.__llamadas || []).length);
await tirar(250, 520); await p.waitForTimeout(1000);
assert.equal(await p.evaluate(() => (window.__llamadas || []).length), antes2, "con la página bajada no actualiza");
// En el chat no aparece
await p.evaluate(() => window.scrollTo(0, 0));
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click(); await p.waitForTimeout(500);
await p.getByRole("tab", { name: "Chat" }).click().catch(() => {}); await p.waitForTimeout(400);
assert.equal(await p.locator(".tirar-actualizar").count(), 0, "en el chat no");
assert.deepEqual(errores, []);
await b.close();
console.log("tirar para actualizar ok");
