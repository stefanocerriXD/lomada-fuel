// Cantidades con decimales, con coma: "0,5", "1,5" (o con punto). Sin fracciones.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { leerCantidad, mostrarCantidad } from "../../src/lib/unidades.js";

// La lectura y cómo se muestra.
for (const [t, v] of [["1,5", 1.5], ["1.5", 1.5], ["0,5", 0.5], [",5", 0.5], ["1,", 1], ["3", 3], ["0,25", 0.25]]) {
  assert.ok(Math.abs(leerCantidad(t) - v) < 1e-9, `${t} -> ${leerCantidad(t)}`);
}
for (const t of ["", "abc", "1/2", "½", "-1"]) assert.equal(leerCantidad(t), null, t);
assert.deepEqual([0.5, 1.5, 0.25, 2, 0.3333, 1.2, 0.75].map(mostrarCantidad), ["0,5", "1,5", "0,25", "2", "0,33", "1,2", "0,75"]);

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => {
  if (r.request().url().includes("/api/alimentos")) {
    return r.fulfill({ json: { resultados: [{ id: "off-1", nombre: "Pechuga de pollo", marca: "", fuente: "argentina", verificado: true, por100: { kcal: 100, p: 20, c: 0, g: 2 }, porcion: { nombre: "porción", g: 200 } }] } });
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
await p.getByLabel("Buscar alimento o producto").fill("pollo");
await p.waitForTimeout(1200);
await p.locator(".buscador .resultados button", { hasText: "Pechuga de pollo" }).first().click();
await p.waitForTimeout(400);
await p.getByLabel("Buscar alimento o producto").fill("");
await p.waitForTimeout(300);

const campo = p.getByLabel("Cantidad de Pechuga de pollo");
const kcal = async () => (await p.locator(".pie-total strong").innerText()).replace(/\D/g, "");
// Escribiendo tecla por tecla, como en el celu: la coma no se pierde.
await campo.click();
await campo.pressSequentially("1,5", { delay: 60 });
await p.waitForTimeout(700);
assert.equal(await campo.inputValue(), "1,5");
assert.equal(await kcal(), "300");
await campo.fill("0,5");
await p.waitForTimeout(700);
assert.equal(await kcal(), "100");
await campo.fill("0.75");
await p.waitForTimeout(700);
assert.equal(await kcal(), "150");
await campo.blur();
assert.equal(await campo.inputValue(), "0,75", "al salir se ve con coma");
// Sin botones de fracción.
assert.equal(await p.locator(".fracciones").count(), 0);
await p.screenshot({ path: "capturas/cantidad-decimal.png" });
// El + desde un decimal.
await p.getByRole("button", { name: "Sumar", exact: true }).click();
await p.waitForTimeout(700);
assert.equal(await campo.inputValue(), "1");
// En gramos también entra el decimal.
await p.getByLabel("Medida de Pechuga de pollo").selectOption("g");
await p.waitForTimeout(300);
await campo.fill("150,5");
await p.waitForTimeout(700);
assert.equal(await kcal(), "151");

await b.close();
assert.deepEqual(errores, []);
console.log("cantidades: pasaron");
