import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "x" } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__con053 = true;
  window.__registrosConfig = { usuario_id: "u1", activos: ["creatina", "gym"], aviso: false, personalizados: [] };
  window.__recordatorios = [{ id: "r1", usuario_id: "u1", hora: 20, minuto: 0, dias: [0, 1, 2, 3, 4, 5, 6], texto: null, solo_si_falta: true, activo: true, creado_en: "2026-11-01T00:00:00Z" }];
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Registros diarios/ }).first().click();
await p.waitForTimeout(800);

// Fútbol de la lista y uno escrito: Yoga.
await p.getByText("Fútbol", { exact: true }).click();
await p.waitForTimeout(300);
await p.getByLabel("Nombre del registro").fill("Yoga");
await p.getByRole("radio", { name: "Actividad" }).click();
await p.getByRole("button", { name: "Agregar", exact: true }).click();
await p.waitForTimeout(500);
let conf = await p.evaluate(() => window.__db.registros_config[0]);
console.log("activos:", conf.activos, "propios:", JSON.stringify(conf.personalizados));
assert.deepEqual(conf.activos, ["creatina", "gym", "futbol", "p-yoga"]);
assert.equal(conf.personalizados[0].nombre, "Yoga");

// Recordatorios: el de las 20 (migrado) y uno nuevo a las 7:30 los días de semana, "Tomar agua".
assert.equal(await p.locator(".recordatorio").count(), 1);
await p.getByRole("button", { name: "Agregar recordatorio" }).click();
await p.waitForTimeout(500);
const nuevo = p.locator(".recordatorio").nth(1);
await nuevo.getByLabel("Hora del recordatorio").fill("07:37");
await p.waitForTimeout(300);
for (const d of ["sábado", "domingo"]) await nuevo.getByRole("button", { name: d }).click();
await nuevo.getByLabel("Texto del recordatorio").fill("Tomar agua");
await nuevo.getByLabel("Texto del recordatorio").blur();
await nuevo.getByText("Solo si me falta tildar algo").click();
await p.waitForTimeout(500);
const recs = await p.evaluate(() => window.__db.recordatorios);
const r2 = recs.find((r) => r.id !== "r1");
console.log("nuevo:", JSON.stringify({ hora: r2.hora, minuto: r2.minuto, dias: r2.dias, texto: r2.texto, solo: r2.solo_si_falta }));
assert.deepEqual([r2.hora, r2.minuto, r2.texto, r2.solo_si_falta], [7, 30, "Tomar agua", false], "minutos de a 15");
assert.deepEqual([...r2.dias].sort(), [1, 2, 3, 4, 5]);
await p.screenshot({ path: "capturas/recordatorios.png", fullPage: true });

// Borrar el propio y apagar el de las 20.
await p.getByRole("button", { name: "Borrar Yoga" }).click();
await p.locator(".recordatorio").first().getByRole("switch", { name: "Prendido" }).click();
await p.waitForTimeout(400);
conf = await p.evaluate(() => window.__db.registros_config[0]);
assert.ok(!conf.activos.includes("p-yoga"));
assert.equal((await p.evaluate(() => window.__db.recordatorios.find((r) => r.id === "r1"))).activo, false);

// En el Resumen aparece Fútbol para tildar.
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(600);
const futbol = p.getByRole("button", { name: /Jugué al fútbol/ });
await futbol.scrollIntoViewIfNeeded();
await futbol.click();
await p.waitForTimeout(400);
const tildados = await p.evaluate(() => window.__db.registros_diarios.map((r) => r.codigo));
assert.ok(tildados.includes("futbol"));
await p.screenshot({ path: "capturas/recordatorios-resumen.png" });
await b.close();
assert.deepEqual(errores, []);
console.log("recordatorios ok");
