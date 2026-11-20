// El paso a paso de las recetas: opcional, se carga solo al importar un texto con "Preparación", se guarda y se ve numerado.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199/?vista=ajustes");
  await p.waitForTimeout(1200);
  await p.locator(".menu-ajustes button", { hasText: "Mis recetas" }).click();
  await p.waitForTimeout(400);
  return { ctx, p };
}

// 1) Importar un texto con preparación: los pasos se cargan solos y se guardan.
let { ctx, p } = await abrir();
await p.getByRole("button", { name: "Nueva receta" }).click();
await p.waitForTimeout(500);
const campo = p.getByLabel("Paso a paso de la receta");
assert.equal(await campo.inputValue(), "", "arranca vacío");
await p.getByRole("button", { name: /Importar foto o texto/ }).click();
await p.getByLabel("Texto del resumen").fill("Budín de limón\nRinde 10 porciones\nIngredientes\n- 250 g de harina leudante\n- 3 huevos\n- 200 g de azúcar\nPreparación:\n1. Batir los huevos con el azúcar\n2. Sumar la harina\n3. Hornear 40 minutos a 180°");
await p.getByRole("button", { name: "Leer texto" }).click();
await p.waitForTimeout(600);
assert.equal(await campo.inputValue(), "1. Batir los huevos con el azúcar\n2. Sumar la harina\n3. Hornear 40 minutos a 180°");
assert.equal(await p.locator(".editor-receta .fila-item").count(), 3, "los pasos no entran como ingredientes");
await campo.fill(`${await campo.inputValue()}\n\n4. Dejar enfriar`);
await campo.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/receta-pasos-editor.png" });
await p.getByRole("button", { name: "Guardar receta" }).click();
await p.waitForTimeout(700);
const guardada = await p.evaluate(() => window.__db.recetas_propias[0]);
assert.equal(guardada.pasos, "1. Batir los huevos con el azúcar\n2. Sumar la harina\n3. Hornear 40 minutos a 180°\n4. Dejar enfriar", "sin renglones vacíos");
// Sin pasos no manda la columna (sigue andando aunque falte el SQL 061).
await p.getByRole("button", { name: "Nueva receta" }).click();
await p.waitForTimeout(400);
await p.getByLabel("Nombre de la receta").fill("Tostado");
await p.getByLabel("Buscar ingrediente").fill("pan");
await p.waitForTimeout(300);
await p.locator(".editor-receta .resultados button").first().click();
await p.getByRole("button", { name: "Guardar receta" }).click();
await p.waitForTimeout(700);
const sinPasos = await p.evaluate(() => window.__db.recetas_propias.find((r) => r.nombre === "Tostado"));
assert.ok(!("pasos" in sinPasos));
await ctx.close();

// 2) La receta de otro: el paso a paso numerado, sin la numeración que escribió cada uno.
({ ctx, p } = await abrir({ __recetaJuan: true, __pasosJuan: true }));
await p.locator(".lista-recetas button", { hasText: "Budín de banana" }).click();
const pasos = p.locator(".pasos-receta li");
await pasos.first().waitFor();
assert.deepEqual(await pasos.allInnerTexts(), ["Pisar las bananas", "mezclar con la harina", "Hornear 40 minutos"]);
await p.locator(".pasos-receta").scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/receta-pasos-ver.png" });
// Al guardarla en mis recetas, se lleva los pasos.
await p.getByRole("button", { name: "Guardar en mis recetas" }).click();
await p.waitForTimeout(600);
const copia = await p.evaluate(() => window.__db.recetas_propias.find((r) => r.usuario_id === "u1"));
assert.match(copia.pasos, /Pisar las bananas/);
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("paso a paso de recetas: pasaron");
