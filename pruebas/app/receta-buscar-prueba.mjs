// Editor de recetas: como en el +, los alimentos recientes (con el buscador vacío y al buscar) y escanear el código.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => {
  if (r.request().url().includes("codigo=7790001234567")) {
    return r.fulfill({ json: { alimento: { id: "off-7790001234567", codigo: "7790001234567", nombre: "Dulce de leche", marca: "La Serenísima", fuente: "openfoodfacts", gramos: 100, por100: { kcal: 315, p: 7, c: 55, g: 7 } } } });
  }
  return r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } });
});
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199/?vista=ajustes");
await p.waitForTimeout(1200);
await p.locator(".menu-ajustes button", { hasText: "Mis recetas" }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Nueva receta" }).click();
const editor = p.locator(".editor-receta");
await editor.waitFor();

// 1) Con el buscador vacío, los recientes de tus comidas.
const recientes = editor.locator(".recientes-receta");
await recientes.waitFor();
assert.match(await recientes.innerText(), /Recientes[\s\S]*Papines[\s\S]*Pollo a la plancha/i);
await p.screenshot({ path: "capturas/receta-recientes.png" });
await recientes.locator("button", { hasText: "Papines" }).click();
await editor.getByLabel("Cantidad de Papines").waitFor();

// 2) Al buscar, tus recientes salen primero.
await editor.getByLabel("Buscar ingrediente").fill("pollo");
await p.waitForTimeout(400);
const buscador = editor.locator(".buscador");
assert.match(await buscador.innerText(), /^Recientes[\s\S]*Pollo a la plancha/i);
await buscador.locator(".resultados button", { hasText: "Pollo a la plancha" }).first().click();
await editor.getByLabel("Cantidad de Pollo a la plancha").waitFor();

// 3) Escanear el código (sin cámara, con el número).
await editor.getByRole("button", { name: "Escanear código" }).click();
await editor.getByLabel("Número de código de barras").fill("7790001234567");
await editor.getByRole("button", { name: "Buscar", exact: true }).click();
await editor.getByLabel("Cantidad de Dulce de leche").waitFor({ timeout: 5000 });
assert.equal(await editor.getByLabel("Número de código de barras").count(), 0, "se cierra el escáner");
assert.match(await editor.locator(".resumen-receta").innerText(), /Receta entera/);
await p.screenshot({ path: "capturas/receta-escaner.png" });

await b.close();
assert.deepEqual(errores, []);
console.log("buscar y escanear en recetas: pasaron");
