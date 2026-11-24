// Una planeada de hoy con un nombre larguísimo: el nombre se corta con "…", pero "Ya la comí",
// el lápiz y el tacho entran enteros dentro de la tarjeta.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__con062 = true;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);

await p.evaluate(() => {
  const hoy = new Date().toLocaleDateString("en-CA");
  const c = {
    id: "larga", usuario_id: "u1", fecha: hoy, tipo: "cena", planeada: true, foto_path: null, macros_editados: false, creado_en: new Date().toISOString(),
    descripcion: "Pechuga de pollo grillada con arroz integral, brócoli al vapor y palta",
    calorias: 650, proteinas: 50, carbohidratos: 60, grasas: 18,
    alimentos: [{ nombre: "Pollo", fuente: "manual", kcal: 650, p: 50, c: 60, g: 18 }],
  };
  window.__db.comidas.unshift(c);
  window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: c });
});
await p.waitForTimeout(1200);

const tarjeta = p.locator(".planeadas");
await tarjeta.scrollIntoViewIfNeeded();
await tarjeta.screenshot({ path: "capturas/planeada-larga.png" });
const caja = await tarjeta.boundingBox();
for (const nombre of [/^Editar Pechuga/, /Ya la comí/, /^Borrar Pechuga/]) {
  const boton = tarjeta.getByRole("button", { name: nombre });
  const bb = await boton.boundingBox();
  const sw = await boton.evaluate((el) => el.scrollWidth - el.clientWidth);
  console.log(nombre, bb, "desborde interno", sw);
  assert.ok(bb.x >= caja.x && bb.x + bb.width <= caja.x + caja.width + 0.5, `${nombre} se sale de la tarjeta`);
  assert.ok(sw <= 0, `${nombre} se corta por dentro`);
}
const nombre = tarjeta.locator(".planeada-datos strong");
assert.ok(await nombre.evaluate((el) => el.scrollWidth > el.clientWidth), "el nombre largo se corta con puntos suspensivos");

await b.close();
assert.deepEqual(errores, []);
console.log("planeada con nombre largo: pasaron");
