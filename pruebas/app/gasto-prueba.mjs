import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
// Meta vieja, como la que daba la cuenta anterior (4 días = x1,55).
await p.evaluate(() => { window.__db.perfiles.find((x) => x.id === "u1").meta_calorias = 2400; });
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Tu perfil Nombre/ }).click();
await p.waitForTimeout(500);
const aviso = p.locator(".meta-recalculada");
await aviso.waitFor();
console.log("aviso:", (await aviso.innerText()).replace(/\s+/g, " "));
await aviso.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/gasto-aviso.png" });

// Editar el plan: el paso de actividad pregunta el día a día.
await p.getByRole("button", { name: "Editar mi plan" }).click();
await p.waitForTimeout(500);
for (let i = 0; i < 2; i++) { await p.getByRole("button", { name: "Seguir" }).click(); await p.waitForTimeout(300); }
await p.getByRole("radio", { name: /Me muevo bastante/ }).click();
await p.screenshot({ path: "capturas/gasto-paso.png" });
for (let i = 0; i < 2; i++) { await p.getByRole("button", { name: "Seguir" }).click(); await p.waitForTimeout(300); }
await p.screenshot({ path: "capturas/gasto-resumen.png" });
const quema = await p.locator(".plan-datos li", { hasText: "Quemás por día" }).innerText();
console.log("quemás:", quema.replace(/\s+/g, " "));
await p.getByRole("button", { name: "Guardar mi plan" }).click();
await p.waitForTimeout(800);
const fila = await p.evaluate(() => window.__db.perfiles_salud.find((x) => x.usuario_id === "u1"));
assert.equal(fila.dia_a_dia, "movido");
await b.close();
assert.deepEqual(errores, []);
console.log("gasto ok");
