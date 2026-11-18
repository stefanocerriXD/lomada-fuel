import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(hora, minuto) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
  await ctx.addInitScript(([h, m]) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    const Real = Date;
    const meta = new Real(); meta.setHours(h, m, 0, 0);
    const corrimiento = meta.getTime() - Real.now();
    class Corrido extends Real {
      constructor(...a) { super(...(a.length ? a : [Real.now() + corrimiento])); }
      static now() { return Real.now() + corrimiento; }
    }
    window.Date = Corrido;
  }, [hora, minuto]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  await p.evaluate(async () => {
    const { fechaLocal } = await import("/src/lib/fechas.js");
    const f = fechaLocal();
    window.__db.salud_comidas.push(
      { id: "s1", usuario_id: "u1", fecha: f, momento: `${f}T17:45:00-03:00`, kcal: 320, proteinas: 12, carbohidratos: 40, grasas: 9 },
      { id: "s2", usuario_id: "u1", fecha: f, momento: `${f}T21:05:00-03:00`, kcal: 650, proteinas: 40, carbohidratos: 70, grasas: 20 },
    );
  });
  return { ctx, p };
}

// 21:20 y MyFitnessPal ya mandó la cena: al tocar + está cargada, solo falta la foto.
let { ctx, p } = await abrir(21, 20);
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
const nota = p.locator(".nota-salud");
await nota.waitFor();
assert.match(await nota.innerText(), /MyFitnessPal \(Apple Salud\), cargado a las 21:05/);
assert.equal(await p.locator(".tipos [aria-checked=true]").innerText().then((t) => t.trim()), "Cena");
assert.match(await p.locator(".fila-item").first().innerText(), /Cena de Apple Salud[\s\S]*650 kcal/);
await p.waitForTimeout(1000);
assert.match(await p.locator(".pie-total strong").innerText(), /650/);
await p.screenshot({ path: "capturas/salud-auto.png" });
// Deshacer la saca y vuelve la lista para elegir.
await p.getByRole("button", { name: /Deshacer/ }).click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".fila-item").count(), 0);
assert.equal(await p.locator(".de-salud-boton").count(), 2);
await ctx.close();

// 13:00 sin almuerzo de MyFitnessPal: no carga nada solo, ofrece las que hay.
({ ctx, p } = await abrir(13, 0));
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(800);
assert.equal(await p.locator(".fila-item").count(), 0);
assert.equal(await p.locator(".nota-salud").count(), 0);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("Apple Salud automático: pruebas pasadas");
