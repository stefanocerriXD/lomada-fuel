import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

// La regla, con horas fijas: viernes a la noche, el sábado a la mañana sigue la fiesta; de 12 a 20 la resaca; después nada.
{
  const { estadoDeFiesta } = await import("../../src/lib/fiestaEstado.js");
  const vaso = { nombre: "Fernet", kcal: 190 };
  const viernes = "2026-11-20";
  const comidas = [{ usuario_id: "u", tipo: "fiesta", fecha: viernes, gol: true, alimentos: [vaso, vaso, vaso] }];
  const en = (fecha, h) => new Date(`${fecha}T${String(h).padStart(2, "0")}:30:00`);
  assert.equal(estadoDeFiesta("u", comidas, en(viernes, 23))?.modo, "fiesta");
  assert.equal(estadoDeFiesta("u", comidas, en("2026-11-21", 7))?.modo, "fiesta", "a las 7 de la mañana sigue la noche");
  assert.equal(estadoDeFiesta("u", comidas, en("2026-11-21", 13))?.modo, "resaca");
  assert.equal(estadoDeFiesta("u", comidas, en("2026-11-21", 19))?.modo, "resaca");
  assert.equal(estadoDeFiesta("u", comidas, en("2026-11-21", 20)), null, "a las 20 se va");
  assert.equal(estadoDeFiesta("u", comidas, en("2026-11-22", 10)), null, "el domingo nada");
  assert.equal(estadoDeFiesta("u", comidas, en("2026-11-22", 14)), null);
}
const avisos = [];

async function abrir(hora, banderas) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
  await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
  await ctx.addInitScript(([h, f]) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    Object.assign(window, f);
    const Real = Date; const meta = new Real(); meta.setHours(h, 0, 0, 0); const d = meta.getTime() - Real.now();
    class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
    window.Date = C;
  }, [hora, banderas]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1300);
  return { ctx, p };
}

// 0) A las 21 del día después ya no queda nada (ni resaca ni gol).
let { ctx, p } = await abrir(21, { __fiestas: true });
// El vaso de las 7 de la mañana del sábado es de la noche del viernes (al cargarlo en el modo fiesta).
assert.equal(await p.evaluate(async () => (await import("/src/lib/noche.js")).fechaDeLaNoche(new Date("2026-11-21T07:30:00"))), "2026-11-20");
assert.equal(await p.evaluate(async () => (await import("/src/lib/noche.js")).fechaDeLaNoche(new Date("2026-11-21T13:00:00"))), "2026-11-21");
assert.equal(await p.locator(".tarjeta-amigo", { hasText: "Nahuel" }).locator(".marca-fiesta").count(), 0, "a las 20 se va");
assert.equal(await p.locator(".avatar-gol").count(), 0);
await ctx.close();

// 1) Al otro día: Nahuel hizo gol (resaca, corona y pelota); Juan salió hace dos noches: nada.
({ ctx, p } = await abrir(14, { __fiestas: true }));
const nahuel = p.locator(".tarjeta-amigo", { hasText: "Nahuel" });
assert.match(await nahuel.locator(".amigo-datos strong").innerText(), /Nahuel[\s\S]*Gol[\s\S]*Resaca/);
assert.equal(await nahuel.locator(".avatar-gol").count(), 1, "corona en el avatar");
assert.equal(await p.locator(".tarjeta-amigo", { hasText: "Juan" }).locator(".marca-fiesta").count(), 0);
await p.waitForTimeout(3500); await nahuel.screenshot({ path: "capturas/marca-gol.png" });
// Tocar la marca: dice que hizo gol y deja felicitarlo.
await nahuel.locator(".marca-fiesta").click();
await p.getByRole("heading", { name: "¡Hubo gol!" }).waitFor();
assert.match(await p.locator(".hoja-festejo").innerText(), /Nahuel hizo gol anoche[\s\S]*4 vasos y hubo beso/);
await p.screenshot({ path: "capturas/hoja-gol.png" });
await p.getByRole("button", { name: /Felicitarlo en el grupo/ }).click();
await p.waitForTimeout(1200);
const msj = await p.evaluate(() => window.__db.mensajes.find((m) => /Golazo/.test(m.texto || "")));
assert.ok(msj && msj.texto.includes("@Nahuel"), JSON.stringify(msj));
assert.ok(avisos.some((a) => a.tipo === "mensaje" && a.id === msj.id));
assert.equal(await p.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected"), "true", "lleva al chat");
assert.ok((await p.locator(".burbuja").allInnerTexts()).some((t) => t.includes("Golazo")));
// En el chat, al lado del nombre de Nahuel, también.
const autorNahuel = p.locator(".autor", { hasText: "Nahuel" }).first();
if (await autorNahuel.count()) assert.match(await autorNahuel.innerText(), /Gol[\s\S]*Resaca/);
// Desde el perfil: el sello, y ya felicitado.
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(600);
await nahuel.locator(".amigo-cabecera").click();
await p.waitForTimeout(400);
await nahuel.getByRole("button", { name: /Ver perfil/ }).click();
await p.waitForTimeout(800);
await p.locator(".sello-fiesta").click();
await p.waitForTimeout(500);
assert.match(await p.locator(".hoja-festejo").innerText(), /Ya lo felicitaste/);
await ctx.close();

// 2) De noche: Juan y Nahuel están en modo fiesta (copita).
({ ctx, p } = await abrir(23, { __salida: true }));
const juan = p.locator(".tarjeta-amigo", { hasText: "Juan" });
assert.match(await juan.locator(".amigo-datos strong").innerText(), /Juan[\s\S]*Fiesta/);
await juan.locator(".marca-fiesta").click();
await p.getByRole("heading", { name: "Modo fiesta" }).first().waitFor();
assert.match(await p.locator(".hoja-festejo").innerText(), /Juan está en modo fiesta[\s\S]*Lleva 3 vasos/);
assert.equal(await p.getByRole("button", { name: /Felicitarlo/ }).count(), 0, "de noche no se felicita");
await p.screenshot({ path: "capturas/hoja-fiesta.png" });
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("marcas de la fiesta: pruebas pasadas");
