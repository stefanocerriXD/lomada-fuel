import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];

async function abrir(banderas = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
  await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, banderas);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const irAImagenes = async (p) => {
  // Con castigo aparece el cartel del Bocha: se cierra tocándolo.
  for (let i = 0; i < 3 && await p.locator(".cartel-bocha").count(); i++) { await p.locator(".cartel-bocha").first().click({ force: true }); await p.waitForTimeout(600); }
  await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();
  await p.waitForTimeout(500);
  await p.getByRole("tab", { name: "Imágenes" }).click();
  await p.waitForTimeout(500);
};

// 1) En el + ya no está "Todo el día"; en el Resumen sí.
let { ctx, p } = await abrir({ __columnasPostre: "ninguna" });
assert.equal(await p.getByText("Importar el día").count(), 1, "en el resumen");
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(500);
assert.equal(await p.getByText("Todo el día").count(), 0, "no está en el +");

// 2) El postre con nombre y foto propia, y aviso al grupo.
await p.getByRole("radio", { name: /Colaciones/ }).click();
await p.locator(".postre-opcion").click();
await p.getByRole("heading", { name: "Agregar postre" }).waitFor();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Nota de la comida").count(), 0, "no pisa el título de la comida");
assert.equal(await p.getByLabel("Foto de la comida").count(), 0, "ni su foto");
await p.getByLabel("Buscar alimento o producto").fill("flan");
await p.waitForTimeout(800);
await p.locator(".resultado, [class*=resultado] button").first().click();
await p.waitForTimeout(400);
await p.getByLabel("Foto del postre").setInputFiles("archivos/foto-original.jpg");
await p.getByLabel("Nombre del postre").fill("Flan casero");
await p.waitForTimeout(600);
await p.screenshot({ path: "capturas/postre-carga.png" });
await p.getByRole("button", { name: /Guardar/ }).last().click();
await p.waitForTimeout(1500);
const c2 = await p.evaluate(() => window.__db.comidas.find((c) => c.id === "c2"));
assert.equal(c2.postre_nombre, "Flan casero");
assert.ok(c2.postre_foto?.startsWith("u1/c2-postre-"), c2.postre_foto);
assert.ok(c2.postre_en);
assert.equal(c2.foto_path, "f2", "la foto de la comida queda igual");
assert.ok(c2.alimentos.some((a) => a.postre));
assert.ok(avisos.some((a) => a.tipo === "postre" && a.id === "c2"), JSON.stringify(avisos));
await ctx.close();

// 3) En Imágenes: el postre se nota, con su nombre y su foto al final.
({ ctx, p } = await abrir({ __columnasPostre: "c3", __muchosAlimentos: true }));
await irAImagenes(p);
await p.getByRole("button", { name: /^Almuerzo/ }).first().click();
await p.waitForTimeout(700);
const tarjeta = p.locator(".tarjeta.comida", { hasText: "Pizza de muzzarella" });
assert.match(await tarjeta.locator(".comida-postre").innerText(), /Postre\s*Flan con dulce de leche/i);
const ir = tarjeta.locator(".ir-postre");
assert.equal(await ir.count(), 1, "desde la primera foto se ve que hay postre");
await tarjeta.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/postre-imagenes.png" });
await ir.click();
await p.waitForTimeout(800);
assert.match(await tarjeta.locator(".etiqueta-postre").innerText(), /Postre · Flan con dulce de leche/);
assert.equal(await tarjeta.locator(".ir-postre").count(), 0, "en la del postre ya no está el botón");
await p.screenshot({ path: "capturas/postre-foto.png" });
// Tocando la del postre, el visor abre en esa foto.
await tarjeta.locator(".carrusel-pista .comida-foto").last().click();
await p.waitForTimeout(600);
assert.match(await p.locator(".visor-postre").innerText(), /Postre · Flan con dulce de leche/);
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// 4) La cabecera de la comida queda fija al bajar, y agrupa desde abajo.
await tarjeta.getByRole("button", { name: /Ver alimentos/ }).click();
await p.waitForTimeout(700);
// Bajar hasta la mitad de la lista de alimentos de la pizza.
await tarjeta.locator(".detalle-pliegue").evaluate((el) => { const r = el.getBoundingClientRect(); window.scrollBy(0, r.top + r.height / 2 - 420); });
await p.waitForTimeout(500);
const cab = p.locator(".grupo-fotos.abierto > .grupo-fotos-cabecera").first();
const caja = await cab.boundingBox();
console.log("cabecera fija en y =", Math.round(caja.y), "alto", Math.round(caja.height));
assert.ok(caja.y >= 100 && caja.y < 140, `queda arriba: ${caja.y}`);
const ocultar = tarjeta.getByRole("button", { name: /Ocultar alimentos/ });
const cajaOcultar = await ocultar.boundingBox();
assert.ok(cajaOcultar.y >= caja.y + caja.height - 2, `Ocultar alimentos queda debajo: ${cajaOcultar.y}`);
await p.screenshot({ path: "capturas/cabecera-fija.png" });
await cab.click();
await p.waitForTimeout(800);
assert.equal(await p.locator(".grupo-fotos.abierto").count(), 0, "se agrupó");
const cabCerrada = await p.locator(".grupo-fotos-cabecera", { hasText: "Almuerzo" }).boundingBox();
assert.ok(cabCerrada.y > 60 && cabCerrada.y < 400, `queda a la vista: ${cabCerrada.y}`);
await ctx.close();

// 5) La calavera: dos semanas sin fotos, no ve ninguna foto del grupo.
({ ctx, p } = await abrir({ __calavera: "u1" }));
await irAImagenes(p);
await p.getByRole("button", { name: /^Almuerzo/ }).first().click();
await p.waitForTimeout(700);
const pizza = p.locator(".tarjeta.comida", { hasText: "Pizza de muzzarella" });
assert.equal(await pizza.locator(".foto-oculta").count(), 1);
assert.equal(await pizza.locator("img").count(), 0, "ni borrosa");
await pizza.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/calavera.png" });
await pizza.locator(".foto-oculta").click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".visor-foto").count(), 0, "no se destapa ampliando");
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(700);
assert.ok(await p.locator(".tarjeta-amigo.fotos-ocultas").count() >= 1, "en el resumen tampoco");
assert.equal(await p.locator(".tarjeta-amigo:not(.fotos-ocultas)").count(), 1, "la propia sí");
await p.screenshot({ path: "capturas/calavera-resumen.png" });
await ctx.close();

// Otro con calavera: se ve en su avatar, y yo sí veo las fotos.
({ ctx, p } = await abrir({ __calavera: "u2" }));
assert.ok(await p.locator(".avatar-caca.calavera").count() >= 1, "calavera en el avatar");
assert.equal(await p.locator(".tarjeta-amigo.fotos-ocultas").count(), 0);
await p.screenshot({ path: "capturas/calavera-otro.png" });
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("postre, cabecera fija y calavera: pruebas pasadas");
