// El + después de cenar ofrece "¿Es postre?" sin ir a Colaciones, y carga en el día que estás mirando en el Resumen.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(hora) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((h) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    const Real = Date; const meta = new Real(); meta.setHours(h, 30, 0, 0); const d = meta.getTime() - Real.now();
    class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
    window.Date = C;
    document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); });
  }, hora);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1600);
  return { ctx, p };
}
const hoy = (p) => p.evaluate(async () => (await import("/src/lib/fechas.js")).fechaLocal());

// 1. A las 22:30, con la cena ya cargada: el + abre en Cena y ofrece sumarlo como postre.
let { ctx, p } = await abrir(22);
const fecha = await hoy(p);
await p.evaluate((f) => {
  window.__db.comidas = window.__db.comidas.filter((c) => !(c.usuario_id === "u1" && c.fecha === f && (c.tipo === "cena" || c.tipo === "almuerzo")));
  const cena = { id: "cena-hoy", usuario_id: "u1", tipo: "cena", fecha: f, descripcion: "Milanesa con puré", calorias: 800, proteinas: 40, carbohidratos: 60, grasas: 30, alimentos: [], creado_en: new Date().toISOString(), privada: false };
  window.__db.comidas.unshift(cena);
  // Llega como en vivo, igual que cuando la carga otro celu.
  window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: cena });
}, fecha);
await p.waitForTimeout(500);
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(500);
assert.equal(await p.locator(".tipos [aria-checked=true]").innerText().then((t) => t.trim()), "Cena");
assert.match(await p.locator(".postre-opcion").innerText(), /¿Es postre\?[\s\S]*tu cena/, "sin ir hasta Colaciones");
await p.screenshot({ path: "capturas/postre-al-tocar-mas.png" });
await ctx.close();

// 2. A las 9:30 se abre en Desayuno: no es momento de postre.
({ ctx, p } = await abrir(9));
const fecha2 = await hoy(p);
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(500);
assert.equal(await p.locator(".postre-opcion").count(), 0);
await p.getByRole("button", { name: "Cerrar" }).last().click();
await p.waitForTimeout(500);

// 3. En el Resumen elijo ayer: el + carga en ayer y lo dice.
const ayer = await p.evaluate(async () => (await import("/src/lib/fechas.js")).haceDias(1));
await p.locator(`.tira-dias [data-dia="${ayer}"]`).click();
await p.waitForTimeout(400);
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida · Ayer" }).waitFor();
await p.getByRole("button", { name: "Cerrar" }).last().click();
await p.waitForTimeout(500);
// Volviendo a hoy, el + es para hoy.
await p.locator(`.tira-dias [data-dia="${fecha2}"]`).click();
await p.waitForTimeout(400);
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida", exact: true }).waitFor();
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("postre al tocar + y día elegido: pasaron");
