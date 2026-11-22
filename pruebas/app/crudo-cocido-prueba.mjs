// Crudo o cocido: la base lo marca, USDA lo dice en inglés, y al buscar se ve al lado del nombre.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { buscarTipicos } from "../../src/data/alimentos-ar.js";
import { estadoDe, etiquetaEstado } from "../../src/lib/estadoAlimento.js";

// La base: lo de siempre es cocido, y están las versiones crudas.
const lomo = buscarTipicos("lomo").map((a) => [a.nombre, a.estado]);
assert.ok(lomo.some(([n, e]) => n === "Bife de lomo" && e === "cocido"), JSON.stringify(lomo));
assert.ok(lomo.some(([n, e]) => n === "Lomo crudo" && e === "crudo"));
// Lo cocido va primero (el dictado y la IA toman el primero).
assert.equal(buscarTipicos("pechuga pollo")[0].estado, "cocido");
assert.equal(buscarTipicos("carne picada")[0].estado, "cocido");
assert.ok(buscarTipicos("pechuga cruda").some((a) => a.nombre === "Pechuga de pollo cruda"));
// La etiqueta: solo si el nombre no lo dice; lo viejo de la lista se reconoce por el nombre; USDA en inglés.
assert.equal(etiquetaEstado({ nombre: "Bife de lomo", fuente: "tipico" }), "Cocido", "lo cargado antes, sin estado guardado");
assert.equal(etiquetaEstado({ nombre: "Lomo crudo", fuente: "tipico", estado: "crudo" }), null, "el nombre ya lo dice");
assert.equal(etiquetaEstado({ nombre: "Beef, tenderloin, steak, raw", fuente: "usda" }), "Crudo");
assert.equal(etiquetaEstado({ nombre: "Chicken, breast, roasted", fuente: "usda" }), "Cocido");
assert.equal(estadoDe({ nombre: "Yogur Ser", fuente: "argentina" }), null, "lo envasado no se marca");

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => {
  if (r.request().url().includes("/api/alimentos")) {
    return r.fulfill({ json: { resultados: [{ id: "usda-1", nombre: "Beef, tenderloin, steak, separable lean only, raw", marca: "", fuente: "usda", verificado: true, por100: { kcal: 143, p: 22, c: 0, g: 6 }, porcion: null }] } });
  }
  return r.fulfill({ json: { ok: true } });
});
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
await p.getByRole("button", { name: /Agregar almuerzo/ }).click();
await p.waitForTimeout(700);
await p.getByLabel("Buscar alimento o producto").fill("lomo");
await p.waitForTimeout(1500);
const bife = p.locator(".buscador li", { hasText: "Bife de lomo" }).first();
assert.match(await bife.innerText(), /Bife de lomo\s*Cocido/);
assert.ok(await bife.locator(".etiqueta-estado").isVisible());
assert.equal(await p.locator(".buscador li", { hasText: "Lomo crudo" }).count(), 1);
assert.match(await p.locator(".buscador li", { hasText: "tenderloin" }).first().innerText(), /Crudo/);
await p.screenshot({ path: "capturas/crudo-cocido.png" });
// Cargado: la etiqueta sigue al lado del nombre.
await bife.locator("button").click();
await p.waitForTimeout(400);
await p.getByLabel("Buscar alimento o producto").fill("");
await p.waitForTimeout(300);
assert.match(await p.locator(".fila-item .fila-datos strong").first().innerText(), /Bife de lomo\s*Cocido/);

await b.close();
assert.deepEqual(errores, []);
console.log("crudo o cocido: pasaron");
