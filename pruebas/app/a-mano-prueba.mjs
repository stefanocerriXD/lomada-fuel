// Cargar alimentos a mano (con peso, quedan ajustables y se suman al buscador) y, al buscar,
// lo que cargó otro dice "Importado por Nahuel" o, si no es de tu grupo, "Importado por otro usuario" (SQL 071).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__con071 = true;
  window.__con054 = true;
  window.__productos = [
    { id: "p1", codigo: null, nombre: "Budín casero de limón", marca: "", por100: { kcal: 380, p: 6, c: 55, g: 15 }, porcion: null, fuente: "usuario", veces: 2, usuarios: 1, cargado_por: "Nahuel" },
    { id: "p2", codigo: null, nombre: "Budín de vainilla", marca: "Doña Rosa", por100: { kcal: 400, p: 5, c: 60, g: 16 }, porcion: null, fuente: "usuario", veces: 1, usuarios: 1, cargado_por: "otro" },
    { id: "p3", codigo: "7790000000999", nombre: "Budín marmolado", marca: "Marca", por100: { kcal: 410, p: 5, c: 58, g: 17 }, porcion: null, fuente: "off", veces: 4, usuarios: 2, cargado_por: null },
  ];
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);

// 1) Al buscar: quién lo cargó.
await p.locator("[aria-label='Subir comida']").last().click();
await p.waitForTimeout(700);
await p.getByLabel("Buscar alimento o producto").fill("budin");
await p.waitForTimeout(900);
const fila = (t) => p.locator(".resultados li", { hasText: t }).first();
assert.match(await fila("Budín casero de limón").innerText(), /Importado por Nahuel/);
assert.match(await fila("Budín de vainilla").innerText(), /Importado por otro usuario/);
assert.doesNotMatch(await fila("Budín marmolado").innerText(), /Importado por/, "lo de internet no dice");
await p.locator(".buscador").screenshot({ path: "capturas/importado-por.png" });
await p.getByLabel("Buscar alimento o producto").fill("");

// 2) A mano con peso: queda en gramos y se suma al buscador.
await p.getByRole("button", { name: "Cargar a mano" }).click();
const form = p.locator("form.carga-manual");
await form.getByLabel("Nombre").fill("Tarta de zapallo");
await form.getByLabel("Marca").fill("La de mi vieja");
await form.getByLabel("Peso en gramos").fill("200");
await form.getByLabel("Calorías").fill("400");
await form.getByLabel("Proteínas (g)").fill("12");
await form.getByLabel("Carbos (g)").fill("40");
await form.getByLabel("Grasas (g)").fill("20");
assert.equal(await form.getByLabel(/Guardarlo en el buscador/).isChecked(), true, "por defecto se guarda");
await form.screenshot({ path: "capturas/a-mano.png" });
await form.getByRole("button", { name: "Agregar" }).click();
await p.getByLabel("Cantidad de Tarta de zapallo").waitFor();
assert.equal(await p.getByLabel("Cantidad de Tarta de zapallo").inputValue(), "200", "en gramos");
await p.waitForTimeout(300);
const guardado = await p.evaluate(() => window.__guardados?.at(-1));
assert.equal(guardado.p_nombre, "Tarta de zapallo");
assert.equal(guardado.p_marca, "La de mi vieja");
assert.equal(guardado.p_fuente, "usuario");
assert.deepEqual(guardado.p_por100, { kcal: 200, p: 6, c: 20, g: 10 }, "por 100 g");

// 3) Sin peso: como antes, los totales tal cual y sin guardarse en el buscador.
await p.getByRole("button", { name: "Cargar a mano" }).click();
const form2 = p.locator("form.carga-manual");
await form2.getByLabel("Nombre").fill("Picada");
await form2.getByLabel("Calorías").fill("700");
assert.equal(await form2.getByLabel(/Guardarlo en el buscador/).count(), 0, "sin peso no se guarda");
const antes = await p.evaluate(() => (window.__guardados || []).length);
await form2.getByRole("button", { name: "Agregar" }).click();
await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => (window.__guardados || []).length), antes);
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// 4) En el editor de recetas también se carga a mano.
await p.goto("http://localhost:5199/?vista=ajustes");
await p.waitForTimeout(1200);
await p.locator(".menu-ajustes button", { hasText: "Mis recetas" }).click();
await p.getByRole("button", { name: "Nueva receta" }).click();
const editor = p.locator(".editor-receta");
await editor.getByRole("button", { name: "Cargar a mano" }).click();
await editor.locator("form.carga-manual").getByLabel("Nombre").fill("Dulce de leche casero");
await editor.locator("form.carga-manual").getByLabel("Peso en gramos").fill("100");
await editor.locator("form.carga-manual").getByLabel("Calorías").fill("320");
await editor.locator("form.carga-manual").getByRole("button", { name: "Agregar" }).click();
await editor.getByLabel("Cantidad de Dulce de leche casero").waitFor();
assert.match(await editor.locator(".resumen-receta").innerText(), /320 kcal/);

await b.close();
assert.deepEqual(errores, []);
console.log("a mano e importado por: pasaron");
