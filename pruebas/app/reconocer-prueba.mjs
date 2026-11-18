import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const FOTO = "archivos/foto-original.jpg";

async function abrir(respuesta) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pedidos = [];
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/\/api\/reconocer/, async (r) => {
    pedidos.push(r.request().postDataJSON());
    await new Promise((x) => setTimeout(x, 400));
    r.fulfill(respuesta);
  });
  await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  await p.locator(".boton-subir").click();
  await p.getByRole("heading", { name: "Subir comida" }).waitFor();
  await p.waitForTimeout(400);
  return { ctx, p, pedidos };
}

const plato = {
  json: {
    esComida: true,
    titulo: "Milanesa con puré",
    alimentos: [
      { nombre: "Milanesa de carne frita", gramos: 160, unidades: 1, por100: { kcal: 270, p: 18, c: 12, g: 16 } },
      { nombre: "Puré de papa", gramos: 200, unidades: null, por100: { kcal: 95, p: 2, c: 15, g: 3 } },
      { nombre: "Salsa criolla rara", gramos: 30, unidades: null, por100: { kcal: 60, p: 1, c: 6, g: 4 } },
    ],
  },
};

// 1) Desde la tarjeta "Sacale una foto al plato".
let { ctx, p, pedidos } = await abrir(plato);
const tarjeta = p.locator(".accion-foto");
assert.match(await tarjeta.innerText(), /Sacale una foto al plato/);
await p.screenshot({ path: "capturas/ia-tarjeta.png" });
await tarjeta.locator("input").setInputFiles(FOTO);
await p.locator(".reconociendo").waitFor();
await p.screenshot({ path: "capturas/ia-mirando.png" });
await p.locator(".nota-ia").waitFor();
await p.waitForTimeout(500);
assert.equal(pedidos.length, 1);
assert.ok(pedidos[0].imagen.length > 1000 && !pedidos[0].imagen.startsWith("data:"), "manda la foto en base64");
const filas = p.locator(".fila-item");
assert.equal(await filas.count(), 3);
const textos = await filas.allInnerTexts();
assert.match(textos[0], /Milanesa/);
assert.match(textos[0], /por la foto/);
assert.match(textos[1], /Pur[eé] de papa/);
assert.match(textos[2], /Salsa criolla rara/);
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Milanesa con puré");
assert.equal(await p.locator(".foto-y-nota img").count(), 1, "la foto queda como foto de la comida");
// La milanesa toma su medida casera.
assert.equal(await p.getByLabel(/Cantidad de Milanesa/).first().inputValue(), "1");
await p.screenshot({ path: "capturas/ia-resultado.png", fullPage: true });
const total = await p.locator(".pie-total strong").innerText();
console.log("total:", total, "|", textos.map((t) => t.replace(/\n/g, " ")).join(" / "));
// Deshacer saca lo de la foto y el título.
await p.getByRole("button", { name: /Deshacer/ }).click();
await p.waitForTimeout(500);
assert.equal(await filas.count(), 0);
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "");
await ctx.close();

// 2) Sin la clave de Gemini: no molesta y la tarjeta desaparece.
({ ctx, p, pedidos } = await abrir({ status: 503, json: { error: "no" } }));
await p.getByLabel("Foto de la comida").setInputFiles(FOTO);
await p.waitForTimeout(1200);
assert.equal(pedidos.length, 1, "arranca sola al elegir la foto con nada cargado");
assert.equal(await p.locator(".error").count(), 0, "sin clave, en automático no muestra error");
assert.equal(await p.locator(".accion-foto").count(), 0);
await ctx.close();

// 3) No es comida y cupo terminado.
({ ctx, p, pedidos } = await abrir({ json: { esComida: false, titulo: "", alimentos: [] } }));
await p.locator(".accion-foto input").setInputFiles(FOTO);
await p.locator(".error").waitFor();
assert.match(await p.locator(".error").innerText(), /No vimos comida/);
await ctx.close();
({ ctx, p, pedidos } = await abrir({ status: 429, json: { error: "Se terminó el cupo gratis de hoy para reconocer fotos. Cargalo a mano o probá mañana." } }));
await p.locator(".accion-foto input").setInputFiles(FOTO);
await p.locator(".error").waitFor();
assert.match(await p.locator(".error").innerText(), /cupo gratis/);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("reconocer foto: pruebas pasadas");
