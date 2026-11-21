// Copiar una comida en Resumen y pegarla en otro día; y encontrar comidas anteriores escribiendo en el buscador.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => {
  if (r.request().url().includes("/api/notificar")) avisos.push(JSON.parse(r.request().postData() || "{}"));
  if (r.request().url().includes("/api/alimentos")) return r.fulfill({ json: { resultados: [] } });
  return r.fulfill({ json: { ok: true } });
});
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); window.__con062 = true; });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
await p.evaluate(() => {
  const c = window.__db.comidas.find((x) => x.id === "c2");
  c.alimentos = [{ nombre: "Milanesa de ternera", fuente: "manual", kcal: 500, p: 30, c: 30, g: 25 }, { nombre: "Puré de papa", fuente: "manual", kcal: 280, p: 12, c: 32, g: 11 }];
  window.__canalDatos().emitir("comidas", { eventType: "UPDATE", new: c });
});
await p.waitForTimeout(1200);

// 1) Copiar el almuerzo de hoy desde tu día.
const mia = p.locator(".tarjeta-amigo").first();
await mia.scrollIntoViewIfNeeded();
await mia.locator(".amigo-cabecera").click();
await p.waitForTimeout(500);
await mia.getByRole("button", { name: "Copiar Milanesa con puré" }).click();
await p.waitForTimeout(300);
const pegar = p.locator(".pegar-comida");
assert.match(await pegar.innerText(), /Milanesa con puré[\s\S]*Copiada · Almuerzo de hoy · 780 kcal/);
await mia.screenshot({ path: "capturas/copiar-comida-dia.png" });

// 2) Ir a mañana y pegarla: se abre la carga con todo, planeada.
const manana = p.getByRole("button", { name: "Mañana" });
await manana.scrollIntoViewIfNeeded();
await manana.click();
await p.waitForTimeout(400);
await pegar.scrollIntoViewIfNeeded();
await pegar.screenshot({ path: "capturas/pegar-comida.png" });
await pegar.getByRole("button", { name: /Pegar mañana/ }).click();
await p.waitForTimeout(700);
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Milanesa con puré");
assert.equal(await p.locator(".fila-item").count(), 2);
assert.match(await p.locator(".pie-total strong").innerText(), /780/);
assert.match(await p.locator(".comida-planeada").innerText(), /planeada para mañana/);
await p.getByRole("button", { name: "Guardar comida planeada" }).click();
await p.waitForTimeout(1000);
const fechaManana = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); });
const pegada = await p.evaluate((f) => window.__db.comidas.find((c) => c.usuario_id === "u1" && c.fecha === f), fechaManana);
assert.deepEqual([pegada.tipo, pegada.calorias, pegada.planeada, pegada.alimentos.map((a) => a.nombre)], ["almuerzo", 780, true, ["Milanesa de ternera", "Puré de papa"]]);
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 0);

// 3) Descartar lo copiado.
await p.getByRole("button", { name: "Descartar la comida copiada" }).click();
assert.equal(await p.locator(".pegar-comida").count(), 0);

// 4) En el buscador: escribiendo aparecen tus comidas anteriores (de cualquier momento del día).
const hoy = p.getByRole("button", { name: "Hoy" });
await hoy.scrollIntoViewIfNeeded();
await hoy.click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Agregar cena/ }).click();
await p.waitForTimeout(700);
await p.getByLabel("Buscar alimento o producto").fill("pure");
await p.waitForTimeout(800);
const anteriores = p.locator(".comidas-anteriores");
assert.match(await anteriores.innerText(), /Tus comidas anteriores[\s\S]*Milanesa con puré[\s\S]*Almuerzo · (Hoy|Mañana) · 780 kcal · 2 alimentos/i);
await p.screenshot({ path: "capturas/buscador-comidas-anteriores.png" });
// El orden: recientes, alimentos de la base, comidas anteriores.
const titulos = await p.locator(".buscador .titulo-lista").allInnerTexts();
assert.deepEqual(titulos.slice(0, 3).map((t) => t.toLowerCase()), ["recientes", "alimentos", "tus comidas anteriores"]);
await anteriores.getByRole("button", { name: "Repetir Milanesa con puré" }).click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".fila-item").count(), 2);
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Milanesa con puré");

await b.close();
assert.deepEqual(errores, []);
console.log("copiar y pegar comidas: pasaron");
