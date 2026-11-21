// Copiar una combinación de comidas a otro día: se eligen, se copian con sus alimentos y quedan planeadas (sin foto ni aviso).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => {
  if (r.request().url().includes("/api/notificar")) avisos.push(JSON.parse(r.request().postData() || "{}"));
  return r.fulfill({ json: { ok: true } });
});
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); window.__con062 = true; });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const c = window.__db.comidas.find((x) => x.id === "c1");
  c.alimentos = [{ nombre: "Tostada", kcal: 200, p: 6, c: 30, g: 4 }, { nombre: "Palta", kcal: 220, p: 6, c: 18, g: 15 }];
  window.__canalDatos().emitir("comidas", { eventType: "UPDATE", new: c });
});
await p.waitForTimeout(1200);

const antes = await p.evaluate(() => window.__db.comidas.length);
await p.getByRole("button", { name: /Copiar comidas/ }).click();
await p.waitForTimeout(600);
const hoja = p.locator(".copiar-comidas");
await hoja.waitFor();
assert.match(await hoja.innerText(), /Tostadas con palta[\s\S]*Milanesa con puré/);
assert.equal(await hoja.getByRole("button", { name: /Mañana/ }).getAttribute("aria-pressed"), "true", "de hoy va a mañana");
// Solo el desayuno.
await hoja.locator(".copiar-fila", { hasText: "Milanesa" }).locator("input").uncheck();
await p.screenshot({ path: "capturas/copiar-comidas.png" });
await hoja.getByRole("button", { name: /Copiar 1 comida · 420 kcal/ }).click();
await p.waitForTimeout(1000);
const manana = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); });
assert.equal(await p.evaluate(() => window.__db.comidas.length), antes + 1);
const nuevas = await p.evaluate((m) => window.__db.comidas.filter((c) => c.usuario_id === "u1" && c.fecha === m), manana);
assert.equal(nuevas.length, 1);
assert.deepEqual([nuevas[0].fecha, nuevas[0].tipo, nuevas[0].calorias, nuevas[0].planeada, nuevas[0].foto_path ?? null], [manana, "desayuno", 420, true, null]);
assert.deepEqual(nuevas[0].alimentos.map((a) => a.nombre), ["Tostada", "Palta"]);
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 0, "copiar no avisa");
// Te lleva a mañana, donde aparece como planeada.
assert.match(await p.locator(".dia-titulo").innerText(), /Mañana/);
assert.match(await p.locator(".planeadas").innerText(), /Tostadas con palta[\s\S]*Editar/);
await p.locator(".planeadas").screenshot({ path: "capturas/copiadas-planeadas.png" });

await b.close();
assert.deepEqual(errores, []);
console.log("copiar comidas: pasaron");
