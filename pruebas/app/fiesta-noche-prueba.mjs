import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  const Real = Date; const meta = new Real(); meta.setHours(23, 30, 0, 0); const d = meta.getTime() - Real.now();
  class C extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + d])); } static now() { return Real.now() + d; } }
  window.Date = C;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
const fiestaDb = () => p.evaluate(() => window.__db.comidas.filter((c) => c.tipo === "fiesta").map((c) => ({ vasos: c.alimentos.length, gol: c.gol, foto: c.foto_path, nombres: c.alimentos.map((v) => v.nombre) })));
const abrir = async () => { const tarjeta = p.locator(".fiesta-accion"); await ((await tarjeta.count()) ? tarjeta : p.locator(".enlace-fiesta-pie")).click(); await p.getByRole("heading", { name: "Modo fiesta" }).waitFor(); await p.waitForTimeout(500); };
const cerrar = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(700); };

// 1) Elegir un trago, sumar dos: se guardan.
await abrir();
await p.getByRole("radio", { name: "Gin tonic" }).click().catch(async () => p.locator(".tragos-rapidos button").nth(3).click());
const elegido = (await p.locator(".sumar-vaso").innerText()).split("\n")[0].replace(/^1 /, "").trim();
await p.locator(".sumar-vaso").click(); await p.waitForTimeout(300);
await p.locator(".sumar-vaso").click(); await p.waitForTimeout(900);
assert.equal((await fiestaDb())[0].vasos, 2);
await cerrar();

// 2) Al volver a abrir sigue el mismo trago, y se suma uno más.
await abrir();
assert.equal(await p.locator(".fiesta-noche strong").innerText(), "2 vasos");
assert.ok((await p.locator(".sumar-vaso").innerText()).includes(elegido), `sigue ${elegido}`);
await p.locator(".sumar-vaso").click(); await p.waitForTimeout(900);
assert.equal((await fiestaDb()).length, 1, "una sola carga para la noche");
assert.equal((await fiestaDb())[0].vasos, 3);

// 3) Gol y foto de la noche.
await p.getByRole("radio", { name: /No hubo/ }).click();
await p.getByLabel("Sumar fotos de la noche").setInputFiles(["archivos/foto-original.jpg", "archivos/etiqueta.png", "archivos/foto-original.jpg"]);
await p.waitForTimeout(2000);
let f = (await fiestaDb())[0];
assert.equal(f.gol, false);
assert.ok(f.foto?.includes("-fiesta-"), f.foto);
let extras = await p.evaluate(() => window.__db.comidas.find((c) => c.tipo === "fiesta").fotos_extra);
assert.equal(extras.length, 2, "varias fotos");
assert.equal(await p.locator(".fiesta-miniatura img").count(), 3);
// Quitar una.
await p.locator(".fiesta-miniatura .quitar-foto").nth(1).click();
await p.waitForTimeout(900);
extras = await p.evaluate(() => window.__db.comidas.find((c) => c.tipo === "fiesta").fotos_extra);
assert.equal(extras.length, 1);
// Sacar el último vaso, con un toque arriba.
await p.locator(".sumar-vaso").click(); await p.waitForTimeout(700);
assert.equal((await fiestaDb())[0].vasos, 4);
await p.getByRole("button", { name: /Sacar el último vaso/ }).click(); await p.waitForTimeout(900);
assert.equal((await fiestaDb())[0].vasos, 3);
assert.equal(await p.locator(".fiesta-noche strong").innerText(), "3 vasos");
await p.screenshot({ path: "capturas/fiesta-gol.png" });
await cerrar();

// 4) +1 rápido desde el resumen.
const masUno = p.locator(".fiesta-mas-uno");
assert.ok((await masUno.innerText()).includes(elegido));
await masUno.click(); await p.waitForTimeout(900);
assert.equal((await fiestaDb())[0].vasos, 4);
assert.match(await p.locator(".fiesta-accion small").innerText(), /^4 vasos/);
await p.screenshot({ path: "capturas/fiesta-mas-uno.png" });

// 5) Sin señal: el vaso queda en el celu, se ve, y se sube cuando vuelve.
await p.evaluate(() => { window.__sinRed = true; });
await masUno.click(); await p.waitForTimeout(900);
assert.equal((await fiestaDb())[0].vasos, 4, "no llegó a la base");
assert.match(await p.locator(".fiesta-accion small").innerText(), /^5 vasos/, "pero se ve");
await abrir();
assert.equal(await p.locator(".fiesta-noche strong").innerText(), "5 vasos");
assert.equal(await p.locator(".fiesta-sin-senal").count(), 1);
await p.evaluate(() => { window.__sinRed = false; window.dispatchEvent(new Event("online")); });
await p.waitForTimeout(1200);
f = (await fiestaDb())[0];
assert.equal(f.vasos, 5, "se subió al volver la señal");
assert.equal(f.gol, false, "sin perder el gol");
assert.equal(await p.locator(".fiesta-sin-senal").count(), 0);
await cerrar();

// 6) En Imágenes: la fiesta con su foto y el cartel del gol.
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /Fiesta/ }).click();
await p.waitForTimeout(800);
const tarjeta = p.locator(".tarjeta.comida", { hasText: "Fiesta: 5 vasos" });
assert.match(await tarjeta.locator(".cartel-gol").innerText(), /SIN GOL/);
assert.equal(await tarjeta.locator(".carrusel-pista .comida-foto").count(), 2, "las dos fotos de la noche");
await tarjeta.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/fiesta-imagenes.png" });

assert.deepEqual(errores, []);
await b.close();
console.log("fiesta de toda la noche: pruebas pasadas");
