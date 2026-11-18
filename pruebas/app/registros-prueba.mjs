import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(banderas = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, banderas);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1600);
  return { ctx, p };
}
const fecha = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// 1) Sin ninguno elegido: el cartel para elegir.
let { ctx, p } = await abrir();
const vacio = p.locator(".registros-vacio");
await vacio.scrollIntoViewIfNeeded();
assert.match(await vacio.innerText(), /Creatina, gym, fútbol/);
await vacio.getByRole("button", { name: "Elegir" }).click();
const hoja = p.getByRole("dialog", { name: "Registros diarios" });
await hoja.waitFor();
await hoja.getByLabel("Creatina").check();
await hoja.getByLabel("Magnesio").check();
await hoja.getByLabel("Gym").check();
await p.waitForTimeout(300);
const conf = await p.evaluate(() => window.__db.registros_config);
console.log("config:", JSON.stringify(conf));
assert.deepEqual(conf[0].activos, ["creatina", "gym", "magnesio"], "en orden");
await hoja.getByRole("button", { name: "Cerrar" }).click(); await p.waitForTimeout(400);
const tarjeta = p.locator(".registros-dia");
await tarjeta.scrollIntoViewIfNeeded();
assert.equal(await tarjeta.locator(".registro").count(), 3);
// Tildar creatina
await tarjeta.getByRole("button", { name: /Tomé la creatina/ }).click(); await p.waitForTimeout(400);
assert.equal(await tarjeta.locator(".registro.hecho").count(), 1);
const filas = await p.evaluate(() => window.__db.registros_diarios);
assert.deepEqual(filas.map((f) => f.codigo), ["creatina"]);
await p.screenshot({ path: "capturas/registros-dia.png", clip: await tarjeta.boundingBox() });
// Destildar
await tarjeta.getByRole("button", { name: /Tomé la creatina/ }).click(); await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => window.__db.registros_diarios.length), 0);
await ctx.close();

// 2) Con racha: 🔥 4 días de gym (sin hoy) muestra la racha.
({ ctx, p } = await abrir({ __registrosConfig: { usuario_id: "u1", activos: ["gym", "creatina"], aviso: true }, __registrosDiarios: [1, 2, 3, 4].map((n) => ({ usuario_id: "u1", fecha: fecha(n), codigo: "gym" })) }));
const t2 = p.locator(".registros-dia");
await t2.scrollIntoViewIfNeeded();
const texto = await t2.innerText();
console.log(texto.replace(/\n/g, " | "));
assert.match(texto, /🔥 4 días/);
await t2.getByRole("button", { name: /Fui al gym/ }).click(); await p.waitForTimeout(400);
assert.match(await t2.innerText(), /🔥 5 días/);
await p.screenshot({ path: "capturas/registros-racha.png", clip: await t2.boundingBox() });
// "No uso" no aplica acá; en Ajustes está la sección.
await p.getByRole("button", { name: "Ajustes" }).locator("visible=true").first().click(); await p.waitForTimeout(500);
await p.getByRole("button", { name: /Registros diarios/ }).click(); await p.waitForTimeout(500);
assert.equal(await p.getByLabel("Gym").isChecked(), true);
await p.getByLabel("Avisarme a las 20").uncheck(); await p.waitForTimeout(300);
assert.equal((await p.evaluate(() => window.__db.registros_config))[0].aviso, false);
await ctx.close();

// 3) Sin el SQL: no rompe y avisa.
({ ctx, p } = await abrir({ __sinRegistros: true }));
const v3 = p.locator(".registros-vacio");
await v3.scrollIntoViewIfNeeded();
await v3.getByRole("button", { name: "No uso" }).click(); await p.waitForTimeout(300);
assert.equal(await p.locator(".registros-vacio").count(), 0, "No uso lo esconde");
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("registros ok");
