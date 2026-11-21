// Menciones, chat con teclado, historial de alimentos y Apple Salud.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199/?vista=chat");
await p.waitForTimeout(1200);

// 1. Escribir no mueve la página y el chat ocupa lo visible con el teclado
const campo = p.getByLabel("Mensaje");
await campo.focus();
await p.waitForTimeout(250);
assert.equal(await p.evaluate(() => document.documentElement.dataset.teclado), "si");
await p.evaluate(() => {
  document.documentElement.style.setProperty("--alto-visible", "480px");
  document.documentElement.style.setProperty("--arriba-visible", "0px");
});
await p.waitForTimeout(150);
const caja = await p.locator(".grupo-chat").boundingBox();
const entrada = await campo.boundingBox();
console.log("chat con teclado:", JSON.stringify(caja), "| campo abajo en", Math.round(entrada.y + entrada.height));
assert.equal(await p.locator(".grupo-chat").evaluate((e) => getComputedStyle(e).position), "fixed");
assert.ok(entrada.y + entrada.height <= 482, "el campo queda arriba del teclado");
assert.ok((await p.locator(".grupo-barra").boundingBox()).y >= 0, "las pestañas siguen a la vista");
await p.screenshot({ path: "capturas/c-teclado.png" });

// 2. Menciones con @
await campo.type("Hola @na");
await p.locator(".chat-menciones").waitFor();
await p.screenshot({ path: "capturas/c-menciones.png" });
assert.deepEqual(await p.locator(".chat-menciones button").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " ").trim())), ["N Nahuel"]);
await p.locator(".chat-menciones button").first().click();
assert.equal(await campo.inputValue(), "Hola @Nahuel ");
assert.equal(await p.locator(".chat-menciones").count(), 0);
assert.equal(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Mensaje", "el teclado sigue abierto");
await campo.type("¿vamos?");
const antes = await p.evaluate(() => scrollY);
await p.getByRole("button", { name: "Enviar", exact: true }).click();
await p.waitForTimeout(600);
assert.equal(await p.evaluate(() => scrollY), antes, "enviar no mueve la página");
assert.equal(await p.locator(".burbuja .mencion", { hasText: "@Nahuel" }).count(), 1);
assert.equal(avisos.at(-1).tipo, "mensaje");
await campo.type("@zz");
assert.equal(await p.locator(".chat-menciones").count(), 0, "sin coincidencias no muestra nada");
await campo.fill("");

// Mención a uno mismo se resalta
await p.evaluate(() => {
  const fila = { id: "mm", usuario_id: "u2", texto: "Dale @Steve", creado_en: new Date().toISOString() };
  window.__db.mensajes.push(fila);
  window.__canalDatos().emitir("mensajes", { eventType: "INSERT", new: fila });
});
await p.waitForTimeout(300);
assert.equal(await p.locator(".mencion.mia").count(), 1);
await p.screenshot({ path: "capturas/c-mencion-mia.png" });
await p.evaluate(() => document.activeElement?.blur());
await p.waitForTimeout(350);

// 3. Historial de alimentos
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.waitForTimeout(600);
const titulos = await p.locator(".titulo-lista").allInnerTexts();
console.log("secciones:", titulos);
assert.ok(titulos.includes("RECIENTES") || titulos.includes("Recientes"));
await p.screenshot({ path: "capturas/c-historial.png" });
const recientes = await p.locator(".historial .resultado-datos strong").allInnerTexts();
assert.ok(recientes.includes("Papines") && recientes.includes("Pollo a la plancha"), recientes.join(", "));
await p.locator(".historial button", { hasText: "Papines" }).click();
await p.waitForTimeout(300);
const item = await p.locator(".fila-item .fila-datos").first().innerText();
assert.ok(/Papines/.test(item) && /120 kcal/.test(item), item);
await p.getByLabel("Buscar alimento o producto").fill("pollo");
await p.waitForTimeout(300);
assert.equal(await p.locator(".buscador .titulo-lista", { hasText: /recientes/i }).count(), 1);
await p.screenshot({ path: "capturas/c-busqueda.png" });
await p.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
await p.waitForTimeout(500);

// 3b. Repetir un almuerzo de otro día
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Agregar almuerzo" }).click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".titulo-lista", { hasText: /almuerzos anteriores/i }).count(), 1);
await p.screenshot({ path: "capturas/c-combos.png" });
await p.locator(".historial button", { hasText: "Ñoquis con tuco" }).click();
await p.waitForTimeout(300);
assert.equal(await p.locator(".fila-item").count(), 2, "carga todos sus alimentos");
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Ñoquis con tuco");
await p.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
await p.waitForTimeout(500);

// 4. Apple Salud: llave copiada y opción del total
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.locator(".menu-ajustes button", { hasText: "Apple Salud" }).click();
await p.waitForTimeout(400);
await p.locator(".salud").scrollIntoViewIfNeeded();
await p.getByRole("button", { name: /Crear otra llave|Crear mi llave/ }).click();
await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => navigator.clipboard.readText()), "a".repeat(48), "la llave se copia sola");
assert.equal(await p.getByRole("radio", { name: /Usar el valor mayor/ }).isChecked(), true, "por defecto, el mayor");
// La opción se guarda en la base: se toca y se espera a que quede marcada (con check() a veces se adelantaba).
const soloSalud = p.getByRole("radio", { name: /Usar solo lo de Apple Salud/ });
await soloSalud.click();
for (let i = 0; i < 30 && !(await soloSalud.isChecked()); i += 1) await p.waitForTimeout(100);
await p.waitForTimeout(400);
const guardado = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "perfiles" && l.op === "update").pop()?.fila);
assert.deepEqual(guardado, { modo_total: "salud" });
await p.locator(".salud").screenshot({ path: "capturas/c-salud.png" });

await b.close();
assert.deepEqual(errores, []);
console.log("menciones, teclado, historial y Apple Salud: todas las pruebas pasaron");
