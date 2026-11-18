import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
// Los festejos de logros tapan los botones: en esta prueba no hacen falta.
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  // 10:30: ninguna comida de Salud es de esta hora, así no se carga sola (eso lo prueba salud-auto) y aparecen los botones.
  const Real = Date; const meta = new Real(); meta.setHours(10, 30, 0, 0); const d = meta.getTime() - Real.now();
  class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
  window.Date = C;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
// Llegaron dos comidas de MyFitnessPal hoy: una merienda y una cena.
await p.evaluate(async () => {
  const { fechaLocal } = await import("/src/lib/fechas.js");
  const f = fechaLocal();
  window.__db.salud_comidas.push(
    { id: "s1", usuario_id: "u1", fecha: f, momento: `${f}T17:45:00-03:00`, kcal: 320, proteinas: 12, carbohidratos: 40, grasas: 9 },
    { id: "s2", usuario_id: "u1", fecha: f, momento: `${f}T21:10:00-03:00`, kcal: 650, proteinas: 40, carbohidratos: 70, grasas: 20 },
    { id: "s3", usuario_id: "u2", fecha: f, momento: `${f}T21:00:00-03:00`, kcal: 999, proteinas: 1, carbohidratos: 1, grasas: 1 },
  );
});
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
const botones = p.locator(".de-salud-boton");
await botones.first().waitFor();
assert.equal(await botones.count(), 2);
assert.match(await botones.nth(0).innerText(), /Cena · 21:10[\s\S]*650 kcal · P 40 · C 70 · G 20/);
assert.match(await botones.nth(1).innerText(), /Merienda · 17:45/);
await p.waitForTimeout(3500); await p.screenshot({ path: "capturas/salud-sugeridas.png" });
await botones.nth(0).click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".tipos [aria-checked=true]").innerText().then((t) => t.trim()), "Cena");
assert.equal(await p.locator(".de-salud").count(), 0, "con algo cargado se esconde");
await p.screenshot({ path: "capturas/salud-precargada.png" });
await p.getByRole("button", { name: /Publicar/ }).last().click();
await p.waitForTimeout(600);
const igual = p.getByRole("button", { name: /Publicar igual/ });
if (await igual.count()) await igual.click();
await p.waitForTimeout(1500);
const nueva = await p.evaluate(() => window.__db.comidas.find((c) => c.alimentos?.some((a) => a.salud_id === "s2")));
assert.ok(nueva, "se guardó con la entrada de Salud");
assert.equal(nueva.tipo, "cena");
assert.equal(Math.round(nueva.calorias), 650);
// La que ya se usó no vuelve a aparecer.
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.locator(".de-salud-boton").first().waitFor();
assert.equal(await p.locator(".de-salud-boton").count(), 1);
assert.match(await p.locator(".de-salud-boton").innerText(), /Merienda/);
assert.deepEqual(errores, []);
await b.close();
console.log("comidas de Apple Salud: pruebas pasadas");
