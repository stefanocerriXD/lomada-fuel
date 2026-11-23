// Lo importado sin peso (capturas de MyFitnessPal con "1 taza" y sus calorías) se ajusta por porciones,
// y al buscar va al final de tus recientes, avisado como "importado, sin peso".
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { comoPorciones } from "../../src/lib/unidades.js";

// La regla.
const p1 = comoPorciones({ nombre: "Ñoquis", fuente: "importado", kcal: 500, p: 15, c: 90, g: 8, medida: "1 taza" });
assert.deepEqual([p1.porPorcion, p1.unidad.nombre, p1.cantidad, p1.por100.kcal], [true, "porción (1 taza)", 1, 500]);
assert.equal(comoPorciones({ nombre: "X", kcal: 100, medida: "1 porción" }).unidad.nombre, "porción");
assert.equal(comoPorciones({ nombre: "Foto", fuente: "foto" }).porPorcion, undefined, "la foto sola no");
assert.equal(comoPorciones({ nombre: "Pollo", por100: { kcal: 120, p: 22, c: 0, g: 3 } }).porPorcion, undefined, "lo que tiene peso, igual");

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => {
  if (r.request().url().includes("/api/alimentos")) return r.fulfill({ json: { resultados: [] } });
  return r.fulfill({ json: { ok: true } });
});
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
// El almuerzo de hoy: un alimento importado sin peso y uno con peso.
await p.evaluate(() => {
  const c = window.__db.comidas.find((x) => x.id === "c2");
  c.alimentos = [
    { nombre: "Ñoquis con tuco MFP", fuente: "importado", kcal: 500, p: 15, c: 90, g: 8, medida: "1 taza" },
    { nombre: "Ñoquis caseros", fuente: "tipico", por100: { kcal: 160, p: 5, c: 32, g: 1 }, unidad: { nombre: "plato", g: 250 }, cantidad: 1, gramos: 250 },
  ];
  c.calorias = 900;
  window.__canalDatos().emitir("comidas", { eventType: "UPDATE", new: c });
});
await p.waitForTimeout(1200);

// 1) Editando esa comida: lo importado se ajusta por porciones.
const mia = p.locator(".tarjeta-amigo").first();
await mia.scrollIntoViewIfNeeded();
await mia.locator(".amigo-cabecera").click();
await p.waitForTimeout(500);
await mia.getByRole("button", { name: "Editar Milanesa con puré" }).click();
await p.waitForTimeout(800);
const fila = p.locator(".fila-item", { hasText: "Ñoquis con tuco MFP" });
assert.match(await fila.locator(".medida-porcion").innerText(), /porción \(1 taza\)/);
await fila.getByRole("button", { name: "Sumar", exact: true }).click();
await p.waitForTimeout(400);
const textoFila = await fila.innerText();
console.log(textoFila.replace(/\s+/g, " "));
assert.match(textoFila, /1\.?000 kcal/, "2 porciones = el doble");
await fila.getByLabel("Cantidad de Ñoquis con tuco MFP").fill("0,5");
await p.waitForTimeout(400);
assert.match(await fila.innerText(), /250 kcal/);
await p.screenshot({ path: "capturas/porciones-editar.png" });
await p.getByRole("button", { name: "Guardar cambios" }).click();
await p.waitForTimeout(900);
const guardado = await p.evaluate(() => window.__db.comidas.find((x) => x.id === "c2").alimentos[0]);
assert.deepEqual([guardado.porPorcion, guardado.cantidad, Math.round(guardado.kcal)], [true, 0.5, 250]);

// 2) Buscando "ñoquis": lo que tiene peso primero; lo importado sin peso, al final y avisado.
await p.getByRole("button", { name: /Agregar cena/ }).click();
await p.waitForTimeout(700);
await p.getByLabel("Buscar alimento o producto").fill("ñoquis");
await p.waitForTimeout(800);
const recientes = await p.locator(".buscador .resultados").first().locator("li").allInnerTexts();
console.log(recientes.map((t) => t.replace(/\s+/g, " ")));
const iCaseros = recientes.findIndex((t) => t.includes("Ñoquis caseros"));
const iMfp = recientes.findIndex((t) => t.includes("Ñoquis con tuco MFP"));
assert.ok(iCaseros >= 0 && iMfp > iCaseros, "lo importado sin peso va después");
assert.match(recientes[iMfp], /importado, sin peso/);
await p.screenshot({ path: "capturas/porciones-buscar.png" });
// Al elegirlo, también se ajusta.
await p.locator(".buscador li", { hasText: "Ñoquis con tuco MFP" }).first().locator("button").click();
await p.waitForTimeout(500);
await p.getByLabel("Buscar alimento o producto").fill("");
await p.waitForTimeout(300);
assert.equal(await p.locator(".fila-item", { hasText: "Ñoquis con tuco MFP" }).getByRole("button", { name: "Sumar", exact: true }).count(), 1);

await b.close();
assert.deepEqual(errores, []);
console.log("porciones de lo importado: pasaron");
