import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(hora) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((hora) => {
    window.__plan = true;
    localStorage.setItem("comidas-bienvenida", "vista");
    if (hora === null) return;
    const Real = Date;
    const base = new Real(); base.setHours(hora, 30, 0, 0);
    const fijo = base.getTime(); const inicio = Real.now();
    globalThis.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [fijo + (Real.now() - inicio)])); } static now() { return fijo + (Real.now() - inicio); } };
  }, hora);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  return { ctx, p };
}

// De día: no aparece la tarjeta, pero se llega desde el +.
let { ctx, p } = await abrir(13);
assert.equal(await p.locator(".fiesta-accion").count(), 0, "de día no molesta");
await p.getByRole("button", { name: "Agregar cena" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Estás de fiesta/ }).click();
await p.waitForTimeout(600);
const dialogo = p.getByRole("dialog", { name: "Modo fiesta" });
await dialogo.waitFor();
await dialogo.getByRole("radio", { name: "Fernet con coca zero" }).click();
await dialogo.getByRole("radio", { name: /Vaso/ }).click();
await dialogo.locator(".sumar-vaso").click();
await dialogo.locator(".sumar-vaso").click();
await p.screenshot({ path: "capturas/fiesta-debug.png" });
console.log("radios:", await dialogo.getByRole("radio").allInnerTexts());
await dialogo.getByRole("radio", { name: "Gin tonic", exact: true }).click();
await dialogo.getByLabel("Mililitros").fill("400");
await dialogo.locator(".sumar-vaso").click();
// Mezcla rara
await dialogo.getByRole("button", { name: /Armá tu mezcla/ }).click();
await dialogo.getByLabel("Bebida 1", { exact: true }).selectOption("Gancia");
await dialogo.getByLabel("Bebida 2", { exact: true }).selectOption("Gaseosa de pomelo");
await dialogo.getByLabel("Porcentaje de la bebida 1").fill("40");
await dialogo.getByLabel("Porcentaje de la bebida 2").fill("60");
await dialogo.getByRole("button", { name: "Usar esta mezcla" }).click();
await dialogo.locator(".sumar-vaso").click();
// Buscar
await dialogo.getByLabel("Buscar trago").fill("birra");
await p.waitForTimeout(300);
await dialogo.locator(".resultados button", { hasText: "Cerveza rubia" }).first().click();
await dialogo.getByRole("radio", { name: /Lata/ }).click();
await dialogo.locator(".sumar-vaso").click();
await p.waitForTimeout(900);
const noche = await dialogo.locator(".fiesta-noche").innerText();
console.log("noche:", noche.replace(/\n/g, " | "));
assert.ok(noche.includes("5 vasos"));
const lista = await dialogo.locator(".vasos-noche li").allInnerTexts();
console.log("vasos:", lista.map((t) => t.replace(/\n/g, " ")));
assert.ok(lista[0].startsWith("2 × Fernet con coca zero"));
assert.ok(lista.some((t) => t.includes("Gancia con Gaseosa de pomelo")));
await p.screenshot({ path: "capturas/fiesta.png" });
const guardada = await p.evaluate(() => window.__db.comidas.filter((c) => c.usuario_id === "u1" && c.tipo === "fiesta"));
assert.equal(guardada.length, 1, "una sola carga por noche");
assert.equal(guardada[0].alimentos.length, 5);
console.log("guardado:", guardada[0].descripcion, guardada[0].calorias, "kcal");
// Quitar un vaso
await dialogo.getByRole("button", { name: "Quitar un Fernet con coca zero" }).click();
await p.waitForTimeout(700);
assert.equal(await p.evaluate(() => window.__db.comidas.find((c) => c.usuario_id === "u1" && c.tipo === "fiesta").alimentos.length), 4);
await ctx.close();

// De noche sin vasos: la tarjeta NO aparece sola; queda el enlace abajo de todo y en el +.
({ ctx, p } = await abrir(23));
assert.equal(await p.locator(".fiesta-accion").count(), 0, "de noche ya no aparece sola");
const pie = p.locator(".enlace-fiesta-pie");
assert.equal(await pie.count(), 1, "enlace abajo de todo");
await pie.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/fiesta-resumen.png" });
await pie.click();
await p.getByRole("dialog", { name: "Modo fiesta" }).waitFor();
await p.keyboard.press("Escape");
await p.waitForTimeout(600);
await p.locator(".boton-flotante, [aria-label='Subir comida']").first().click();
await p.locator(".capa .enlace-fiesta").click();
await p.getByRole("dialog", { name: "Modo fiesta" }).waitFor();
await ctx.close();
await b.close();
assert.deepEqual(errores, []);
console.log("modo fiesta: pruebas pasadas");
