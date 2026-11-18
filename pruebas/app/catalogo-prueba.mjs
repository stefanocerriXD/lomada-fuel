import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const pedidosOFF = [];
await ctx.route(/\/api\//, (r) => {
  const url = r.request().url();
  if (url.includes("/api/alimentos")) {
    pedidosOFF.push(url);
    if (url.includes("codigo=")) return r.fulfill({ json: { alimento: null } });
    return r.fulfill({ json: { resultados: [{ id: "off-7790040000001", nombre: "Alfajor Guaymallén Blanco", marca: "Guaymallén", fuente: "argentina", verificado: false, por100: { kcal: 424, p: 5, c: 66, g: 15 }, porcion: null }, { id: "off-7790040000002", nombre: "Alfajor Jorgito", marca: "Jorgito", fuente: "argentina", verificado: true, por100: { kcal: 400, p: 5, c: 60, g: 16 }, porcion: null }] } });
  }
  return r.fulfill({ status: 503, json: {} });
});
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__con054 = true;
  window.__productos = [{ id: "p1", codigo: "7790040000001", nombre: "Alfajor Guaymallén Blanco", marca: "Guaymallén", por100: { kcal: 424, p: 5, c: 66, g: 15 }, porcion: { nombre: "1 unidad", g: 38 }, fuente: "etiqueta", veces: 9, usuarios: 3 }];
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199"); await p.waitForTimeout(1500);
await p.getByRole("button", { name: /Agregar merienda/ }).click(); await p.waitForTimeout(700);

// Buscar: el del catálogo arriba (sin repetir el de Open Food Facts) y las marcas solas.
await p.getByLabel("Buscar alimento o producto").fill("alfajores");
await p.waitForTimeout(1500);
const texto = (await p.locator(".buscador").innerText()).replace(/\s+/g, " ");
console.log(texto.slice(0, 300));
assert.match(texto, /productos y marcas/i);
assert.match(texto, /3 personas lo usan/);
assert.equal((texto.match(/Alfajor Guaymallén Blanco/g) || []).length, 1, "sin repetidos");
assert.match(texto, /Alfajor Jorgito/);
await p.screenshot({ path: "capturas/catalogo-busqueda.png", fullPage: true });

// Agregar uno de Open Food Facts lo suma al catálogo.
await p.getByRole("button", { name: /Alfajor Jorgito/ }).click(); await p.waitForTimeout(500);
const guardados = await p.evaluate(() => window.__guardados || []);
console.log("guardado:", JSON.stringify(guardados.at(-1)));
assert.equal(guardados.at(-1).p_codigo, "7790040000002");
assert.equal(guardados.at(-1).p_fuente, "off");

// Escanear (número a mano): lo encuentra en el catálogo sin ir a Open Food Facts.
await p.getByRole("button", { name: "Escanear código" }).click(); await p.waitForTimeout(800);
const antes = pedidosOFF.filter((u) => u.includes("codigo=")).length;
await p.getByLabel("Número de código de barras").fill("7790040000001");
await p.getByRole("button", { name: "Buscar", exact: true }).click(); await p.waitForTimeout(800);
assert.equal(pedidosOFF.filter((u) => u.includes("codigo=")).length, antes, "no hizo falta Open Food Facts");
const items = await p.locator(".items, .lista-items, .item").allInnerTexts().catch(() => []);
const todo = (await p.locator(".carga").innerText()).replace(/\s+/g, " ");
assert.match(todo, /Alfajor Guaymallén Blanco/);
await b.close();
assert.deepEqual(errores, []);
console.log("catalogo ok");
