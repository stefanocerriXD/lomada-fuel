import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

// Cada macro contra su meta: cuánto faltó, cuánto se pasó, o en la meta (±5 %).
const { contraMeta } = await import("../../src/lib/metaMacro.js");
assert.deepEqual(contraMeta(150, 180), { estado: "falta", texto: "Faltaron 30 g de 180 g", lleno: 83, meta: 180 });
assert.deepEqual(contraMeta(90, 70), { estado: "pasado", texto: "Te pasaste 20 g (meta 70 g)", lleno: 100, meta: 70 });
assert.equal(contraMeta(178, 180).estado, "justo");
assert.equal(contraMeta(100, null), null, "sin plan, sin meta");

// Corre el reloj a una fecha sin frenar las animaciones.
async function abrir(fecha, ruta = "/", flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript(({ destino, flags }) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    Object.assign(window, flags);
    const Real = Date;
    const corrimiento = new Real(destino).getTime() - Real.now();
    class Corrido extends Real {
      constructor(...a) { super(...(a.length ? a : [Real.now() + corrimiento])); }
      static now() { return Real.now() + corrimiento; }
    }
    window.Date = Corrido;
  }, { destino: fecha, flags });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(`http://localhost:5199${ruta}`);
  await p.waitForTimeout(1500);
  return { ctx, p };
}

// 1) Desde la notificación del domingo: abre directo la presentación.
let { ctx, p } = await abrir("2026-11-15T20:30:00-03:00", "/?vista=informe");
const historia = p.getByRole("dialog", { name: "Tu informe semanal" });
await historia.waitFor({ timeout: 8000 });
await p.waitForTimeout(1200);
assert.match(await historia.innerText(), /Tu semana[\s\S]*Del 9 de noviembre al 15 de noviembre/);
await p.screenshot({ path: "capturas/historia-1.png" });
const barras = await historia.locator(".historia-barras span").count();
assert.ok(barras >= 5, `pantallas: ${barras}`);
// Tocando a la derecha avanza; a la izquierda vuelve.
const toque = historia.locator(".historia-toque");
const caja = await toque.boundingBox();
const tocar = async (lado) => {
  await p.mouse.click(caja.x + (lado === "der" ? caja.width * 0.8 : caja.width * 0.1), caja.y + caja.height / 2);
  await p.waitForTimeout(1600);
};
await tocar("der");
assert.match(await historia.innerText(), /Comiste en promedio[\s\S]*kcal por día/);
await p.screenshot({ path: "capturas/historia-2.png" });
await tocar("der");
assert.match(await historia.innerText(), /Día por día/);
await p.screenshot({ path: "capturas/historia-3.png" });
await tocar("izq");
assert.match(await historia.innerText(), /Comiste en promedio/);
await tocar("der");
await tocar("der");
assert.match(await historia.innerText(), /Tus macros por día/);
await p.screenshot({ path: "capturas/historia-4.png" });
// Avanza sola hasta el final.
for (let n = 0; n < barras + 2; n += 1) {
  if (await historia.getByText("¡A romperla esta semana!").count()) break;
  await tocar("der");
}
await historia.getByText("¡A romperla esta semana!").waitFor();
await p.screenshot({ path: "capturas/historia-fin.png" });
// Desde el final, la lista completa.
await historia.getByRole("button", { name: "Ver todo en una lista" }).click();
const lista = p.getByRole("dialog", { name: "Tu semana" });
await lista.waitFor();
assert.match(await lista.innerText(), /Promedio por día/i);
await ctx.close();

// 2) El lunes: cartel anclado arriba del resumen. Abre la presentación y se puede cerrar.
({ ctx, p } = await abrir("2026-11-16T09:15:00-03:00"));
const cartel = p.locator(".cartel-informe");
await cartel.waitFor();
await p.waitForTimeout(900);
assert.match(await cartel.innerText(), /Tu semana está lista[\s\S]*9 nov al 15 nov/);
const arriba = await cartel.boundingBox();
const saludo = await p.locator(".dia-encabezado").boundingBox();
assert.ok(arriba.y < saludo.y, "va arriba de todo");
await p.screenshot({ path: "capturas/cartel-informe.png" });
await p.locator(".cartel-informe-marco").screenshot({ path: "capturas/cartel-informe-zoom.png" });
await cartel.click();
await p.getByRole("dialog", { name: "Tu informe semanal" }).waitFor();
await p.keyboard.press("Escape");
await p.waitForTimeout(700);
assert.equal(await p.getByRole("dialog", { name: "Tu informe semanal" }).count(), 0);
await p.getByRole("button", { name: "Cerrar el cartel del informe" }).click();
await p.waitForTimeout(700);
assert.equal(await p.locator(".cartel-informe").count(), 0);
// Cerrado queda cerrado esa semana.
await p.reload();
await p.waitForTimeout(1500);
assert.equal(await p.locator(".cartel-informe").count(), 0);
await ctx.close();

// 4) Con plan: en la historia, cada macro dice cuánto faltó o cuánto te pasaste de la meta.
({ ctx, p } = await abrir("2026-11-15T20:30:00-03:00", "/?vista=informe", { __plan: true }));
const conPlan = p.getByRole("dialog", { name: "Tu informe semanal" });
await conPlan.waitFor({ timeout: 8000 });
for (let n = 0; n < 12 && !(await conPlan.getByText("Tus macros por día").count()); n += 1) {
  const caja = await conPlan.boundingBox();
  await p.mouse.click(caja.x + caja.width * 0.8, caja.y + caja.height / 2);
  await p.waitForTimeout(700);
}
await p.waitForTimeout(1200);
const textoMacros = await conPlan.innerText();
assert.match(textoMacros, /Proteínas[\s\S]*(Faltaron|Te pasaste|En la meta)[\s\S]*Carbos[\s\S]*(Faltaron|Te pasaste|En la meta)[\s\S]*Grasas[\s\S]*(Faltaron|Te pasaste|En la meta)/);
await p.screenshot({ path: "capturas/informe-macros-meta.png" });
await ctx.close();

// 3) Un miércoles no hay cartel.
({ ctx, p } = await abrir("2026-11-18T12:00:00-03:00"));
assert.equal(await p.locator(".cartel-informe").count(), 0);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("informe semanal: pruebas pasadas");
