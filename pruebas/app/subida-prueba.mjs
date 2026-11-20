import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { NIVEL_MAXIMO } from "../../src/lib/medallas.js";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(nivelVisto) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((v) => { localStorage.setItem("comidas-bienvenida", "vista"); if (v !== null) localStorage.setItem("lomada-nivel-u1", String(v)); }, nivelVisto);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  return { ctx, p };
}
// Suma medallas guardadas hasta llegar a ese nivel (sin pasar por el cartel de logro nuevo).
const llevarA = (p, n) => p.evaluate(async (n) => {
  const { LOGROS } = await import("/src/lib/medallas.js");
  const codigos = LOGROS.flatMap((l) => l.niveles.map((_, i) => `${l.codigo}:${i + 1}`)).slice(0, n);
  window.__db.medallas = window.__db.medallas.filter((m) => m.usuario_id !== "u1").concat(codigos.map((codigo) => ({ usuario_id: "u1", codigo, ganada_en: "2026-01-01" })));
  window.__canalDatos().emitir("medallas", { eventType: "INSERT", new: {} });
}, n);

// La primera vez no festeja: solo anota.
let { ctx, p } = await abrir(null);
await p.waitForTimeout(1500);
assert.equal(await p.locator(".subida-nivel").count(), 0);
assert.ok(await p.evaluate(() => localStorage.getItem("lomada-nivel-u1")));
await ctx.close();

// Sube de 10 a 13: número que sube y marco nuevo (Esmeralda, desde el nivel 12).
({ ctx, p } = await abrir(10));
await llevarA(p, 13);
await p.locator(".subida-nivel").waitFor({ timeout: 6000 });
await p.waitForTimeout(1600);
assert.match(await p.locator(".subida-numero").innerText(), /Nivel 13/);
assert.match(await p.locator(".subida-marco").innerText(), /Esmeralda/);
await p.screenshot({ path: "capturas/subida-nivel.png" });
await p.locator(".subida-nivel").click();
await p.waitForTimeout(600);
assert.equal(await p.locator(".subida-nivel").count(), 0, "se cierra tocando");
// El camino de niveles en Logros
await p.getByRole("button", { name: "Logros", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(900);
// Cerrado: una sola línea, sin la lista.
assert.equal(await p.locator(".camino-paso").count(), 0);
assert.match(await p.locator(".camino-cabecera").innerText(), /Camino de niveles[\s\S]*5 de 27 marcos · Zafiro en 2 niveles/);
await p.locator(".camino").screenshot({ path: "capturas/camino-plegado.png" });
await p.locator(".camino-cabecera").click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".camino-paso.actual").count(), 1);
assert.match(await p.locator(".camino-paso.actual").innerText(), /Esmeralda/);
assert.match(await p.locator(".camino-paso.proximo").innerText(), /Zafiro[\s\S]*te faltan 2/);
assert.match(await p.locator(".camino-paso.final").innerText(), /LOMADA LEGENDARY/);
await p.locator(".camino").screenshot({ path: "capturas/camino-cerrado.png" });
await p.getByRole("button", { name: /Ver los 27 niveles/ }).click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".camino-paso").count(), 27);
await ctx.close();

// El final: LOMADA LEGENDARY
({ ctx, p } = await abrir(90));
await llevarA(p, NIVEL_MAXIMO);
await p.locator(".subida-nivel.legendaria").waitFor({ timeout: 6000 });
await p.waitForTimeout(1500);
assert.equal(await p.locator(".subida-nivel .titulo-legendario").innerText(), "LOMADA LEGENDARY");
await p.screenshot({ path: "capturas/subida-legendaria.png" });
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("subida de nivel y camino: pruebas pasadas");
