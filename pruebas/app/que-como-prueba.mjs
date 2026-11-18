import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

const pedidosIA = [];
async function abrir(hora, preferencia, respuestaIA = { status: 503, json: { error: "no" } }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/\/api\/sugerir/, async (r) => { pedidosIA.push(r.request().postDataJSON()); await new Promise((x) => setTimeout(x, 300)); r.fulfill(respuestaIA); });
  await ctx.addInitScript(([pref, h]) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    if (pref) localStorage.setItem("lomada-preferencia-comida", pref);
    // Corre la hora sin frenar las animaciones.
    const Real = Date;
    const meta = new Real(); meta.setHours(h, 10, 0, 0);
    const corrimiento = meta.getTime() - Real.now();
    class Corrido extends Real {
      constructor(...a) { super(...(a.length ? a : [Real.now() + corrimiento])); }
      static now() { return Real.now() + corrimiento; }
    }
    window.Date = Corrido;
  }, [preferencia, hora]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  return { ctx, p };
}
const nombres = (p) => p.locator(".tarjeta.receta h3").allInnerTexts();

// 23:10, ya almorzó y desayunó (mock): colación, nada de cenas.
let { ctx, p } = await abrir(23);
await p.locator(".accion-recomendar").click();
await p.getByRole("heading", { name: "¿Qué puedo comer?" }).waitFor();
await p.waitForTimeout(500);
assert.equal(await p.getByRole("radio", { name: /Colación/ }).getAttribute("aria-checked"), "true");
assert.match(await p.locator(".contexto-hora").innerText(), /23:10: van cosas para picar/);
const noche = await nombres(p);
console.log("23:10 →", noche.join(" | "), "|", await p.locator(".objetivo-comida").innerText());
assert.ok(!noche.some((n) => /Milanesa|Bife|Salmón|Merluza|Cerdo|Lentejas/.test(n)), "nada de cenas pesadas");
await p.screenshot({ path: "capturas/que-como-noche.png" });
// Preferencia escrita.
await p.getByLabel("Preferencia para la recomendación").fill("algo dulce");
await p.waitForTimeout(400);
const dulces = await nombres(p);
console.log("dulce →", dulces.join(" | "));
assert.ok(dulces.every((n) => /yogur|banana|manzana|licuado|avena/i.test(n)));
await p.screenshot({ path: "capturas/que-como-dulce.png" });
await ctx.close();

// 21:10 sin cenar: cena. La preferencia queda guardada de la vez anterior en este celu.
({ ctx, p } = await abrir(21, "con atún"));
await p.locator(".accion-recomendar").click();
await p.getByRole("heading", { name: "¿Qué puedo comer?" }).waitFor();
await p.waitForTimeout(500);
assert.equal(await p.getByRole("radio", { name: /Cena/ }).getAttribute("aria-checked"), "true");
assert.equal(await p.getByLabel("Preferencia para la recomendación").inputValue(), "con atún");
const cena = await nombres(p);
console.log("21:10 con atún →", cena.join(" | "));
assert.match(cena[0], /atún/i);
await p.getByRole("button", { name: "Borrar preferencia" }).click();
await p.waitForTimeout(300);
assert.equal(await p.getByLabel("Preferencia para la recomendación").inputValue(), "");
await ctx.close();

// Con la IA: escribís lo que tenés y te arma opciones personalizadas.
const ing = (nombre, gramos, kcal, p, c, g) => ({ nombre, gramos, unidades: null, por100: { kcal, p, c, g } });
({ ctx, p } = await abrir(23, "", { json: { opciones: [
  { nombre: "Tostadas de atún y queso", porQue: "Salado, rápido y con la proteína que te falta.", minutos: 8, ingredientes: [ing("Pan integral", 80, 250, 9, 45, 3.5), ing("Atún al natural", 120, 116, 26, 0, 1), ing("Queso cremoso", 30, 300, 20, 2, 24)], pasos: ["Tostá el pan.", "Armá con atún y queso."] },
  { nombre: "Revuelto de huevo con arroz", porQue: "Usa lo que tenés en la heladera.", minutos: 10, ingredientes: [ing("Huevo", 100, 143, 12.6, 0.7, 9.5), ing("Arroz cocido", 150, 130, 2.7, 28, 0.3)], pasos: ["Calentá el arroz.", "Sumá el huevo."] },
] } }));
await p.locator(".accion-recomendar").click();
await p.getByRole("heading", { name: "¿Qué puedo comer?" }).waitFor();
await p.waitForTimeout(400);
await p.getByLabel("Preferencia para la recomendación").fill("tengo atún, arroz y huevos");
await p.getByRole("button", { name: /Pedirle opciones a la IA/ }).click();
await p.locator(".receta-ia").first().waitFor();
await p.waitForTimeout(500);
const pedido = pedidosIA.at(-1);
assert.equal(pedido.pedido, "tengo atún, arroz y huevos");
assert.equal(pedido.tipo, "colacion");
assert.match(pedido.hora, /^23:1\d$/);
assert.ok(pedido.objetivo.kcal > 0 && pedido.objetivo.kcal <= 750);
assert.ok(pedido.habituales.length > 0, "manda tus alimentos de siempre");
assert.equal(await p.locator(".receta-ia").count(), 2);
const primera = p.locator(".receta-ia").first();
assert.match(await primera.innerText(), /Tostadas de atún y queso[\s\S]*Salado, rápido/);
console.log("IA →", (await primera.locator(".receta-macros").innerText()).replace(/\n/g, " "));
await p.screenshot({ path: "capturas/que-como-ia.png" });
await primera.getByRole("button", { name: "Cargar esta comida" }).click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(500);
const filas = await p.locator(".fila-item").allInnerTexts();
console.log("cargado:", filas.map((f) => f.split("\n").slice(0, 2).join(" ")).join(" / "));
assert.equal(filas.length, 3);
assert.ok(filas.every((f) => /sugerido por la IA/.test(f)));
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Tostadas de atún y queso");
assert.equal(await p.getByRole("radio", { name: /Colaciones/ }).getAttribute("aria-checked"), "true");
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("qué como: pruebas pasadas");
