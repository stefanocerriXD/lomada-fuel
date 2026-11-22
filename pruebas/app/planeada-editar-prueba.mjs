// Comidas de días futuros: aparecen en "Planeadas" (aunque se hayan cargado antes del SQL 062), se editan
// (tipo y cantidades), se borran desde el Resumen; y las tuyas de cualquier día se editan desde "El día de cada uno".
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__con062 = true;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);

// Dos comidas de mañana sin la marca de planeada (como las cargadas antes del SQL 062).
const manana = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("en-CA"); });
await p.evaluate((f) => {
  const base = { usuario_id: "u1", fecha: f, foto_path: null, macros_editados: false, planeada: false, creado_en: new Date().toISOString() };
  const pollo = { nombre: "Pechuga de pollo", fuente: "argentina", por100: { kcal: 100, p: 20, c: 0, g: 2 }, unidad: { nombre: "porción", g: 200 }, cantidad: 1, gramos: 200 };
  for (const c of [
    { ...base, id: "m1", tipo: "almuerzo", descripcion: "Pollo de mañana", calorias: 200, proteinas: 40, carbohidratos: 0, grasas: 4, alimentos: [pollo] },
    { ...base, id: "m2", tipo: "merienda", descripcion: "Yogur de mañana", calorias: 150, proteinas: 10, carbohidratos: 20, grasas: 3, alimentos: [{ nombre: "Yogur", fuente: "manual", kcal: 150, p: 10, c: 20, g: 3 }] },
  ]) {
    window.__db.comidas.unshift(c);
    window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: c });
  }
}, manana);
await p.waitForTimeout(1200);

const btnManana = p.getByRole("button", { name: "Mañana" });
await btnManana.scrollIntoViewIfNeeded();
await btnManana.click();
await p.waitForTimeout(500);
const tarjeta = p.locator(".planeadas");
assert.match(await tarjeta.innerText(), /Pollo de mañana[\s\S]*Editar[\s\S]*Yogur de mañana/);
await tarjeta.scrollIntoViewIfNeeded();
await tarjeta.screenshot({ path: "capturas/planeadas-futuras.png" });

// Editar: pasar el almuerzo a cena y sumar una porción.
await tarjeta.getByRole("button", { name: "Editar Pollo de mañana" }).click();
await p.waitForTimeout(700);
assert.equal(await p.getByRole("dialog", { name: "Editar comida" }).count(), 1);
await p.getByRole("radio", { name: /Cena/ }).click();
await p.getByRole("button", { name: "Sumar", exact: true }).click();
await p.waitForTimeout(1500);
assert.match(await p.locator(".pie-total strong").innerText(), /400/);
await p.getByRole("button", { name: "Guardar cambios" }).click();
await p.waitForTimeout(1000);
const m1 = await p.evaluate(() => window.__db.comidas.find((c) => c.id === "m1"));
assert.deepEqual([m1.tipo, m1.calorias, m1.alimentos[0].cantidad], ["cena", 400, 2]);

// Desde la casilla de la cena (ahora planeada): se abre para editar, no una carga nueva.
await p.getByRole("button", { name: "Editar Pollo de mañana (planeada)" }).click();
await p.waitForTimeout(700);
assert.equal(await p.getByRole("dialog", { name: "Editar comida" }).count(), 1);
await p.getByRole("dialog").getByRole("button", { name: "Cerrar", exact: true }).click();
await p.waitForTimeout(500);

// Borrar desde el Resumen: pide confirmar.
await tarjeta.getByRole("button", { name: "Borrar Yogur de mañana" }).click();
assert.equal(await p.evaluate(() => window.__db.comidas.some((c) => c.id === "m2")), true, "el primer toque no borra");
await tarjeta.getByRole("button", { name: "Tocá de nuevo para borrar" }).click();
await p.waitForTimeout(800);
assert.equal(await p.evaluate(() => window.__db.comidas.some((c) => c.id === "m2")), false);
assert.doesNotMatch(await tarjeta.innerText(), /Yogur de mañana/);

// En "El día de cada uno": un lápiz para editar las tuyas (hoy).
const hoy = p.getByRole("button", { name: "Hoy" });
await hoy.scrollIntoViewIfNeeded();
await hoy.click();
await p.waitForTimeout(400);
const mia = p.locator(".tarjeta-amigo").first();
await mia.scrollIntoViewIfNeeded();
await mia.locator(".amigo-cabecera").click();
await p.waitForTimeout(400);
// Y un tachito para borrarlas (con confirmación).
await mia.screenshot({ path: "capturas/dia-editar-borrar.png" });
await mia.getByRole("button", { name: "Borrar Tostadas con palta y café" }).click();
assert.equal(await p.evaluate(() => window.__db.comidas.some((c) => c.id === "c1")), true, "el primer toque no borra");
await mia.getByRole("button", { name: "Tocá de nuevo para borrar" }).click();
await p.waitForTimeout(900);
assert.equal(await p.evaluate(() => window.__db.comidas.some((c) => c.id === "c1")), false);
assert.ok((await p.evaluate(() => window.__quitados || [])).includes("f1"), "se va su foto");
await mia.getByRole("button", { name: "Editar Milanesa con puré" }).click();
await p.waitForTimeout(700);
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Milanesa con puré");

await b.close();
assert.deepEqual(errores, []);
console.log("editar y borrar planeadas: pasaron");
