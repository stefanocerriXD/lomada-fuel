// Compartir la noche de fiesta en Instagram: una foto o todas, con los vasos o sin; nunca el gol.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__miFiesta = true;
  // Lo que se escribe en la imagen, para revisarlo.
  window.__textos = [];
  const escribir = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (texto, ...resto) { window.__textos.push(String(texto)); return escribir.call(this, texto, ...resto); };
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199/?vista=imagenes");
await p.waitForTimeout(1800);

// En Imágenes las fotos van agrupadas por comida: se abre la de la fiesta.
await p.locator("button", { hasText: /Fiesta/ }).first().click();
await p.waitForTimeout(800);
const tarjeta = p.locator(".tarjeta.comida", { hasText: "Fiesta: 3 vasos" }).first();
await tarjeta.scrollIntoViewIfNeeded();
await tarjeta.getByRole("button", { name: "Instagram" }).click();
const hoja = p.getByRole("dialog", { name: "Compartir tu noche" });
await hoja.waitFor();
const esperarImagen = async () => {
  await p.waitForTimeout(300);
  await hoja.locator(".compartir-ig-vista img").waitFor({ timeout: 8000 });
  await p.waitForTimeout(300);
};
const textos = async () => (await p.evaluate(() => window.__textos.splice(0))).join(" | ");

// Una foto, con los vasos: la cantidad y qué tomaste; sin gol.
await esperarImagen();
let t = await textos();
assert.match(t, /MODO FIESTA/);
assert.match(t, /vasos · 530 kcal/);
assert.match(t, /2 × Fernet con coca/);
assert.doesNotMatch(t, /gol/i, "nunca el gol");
assert.equal(await hoja.locator(".elegir-foto-noche button").count(), 3, "elegís cuál de las 3");
await hoja.screenshot({ path: "capturas/fiesta-ig-una.png" });

// Elegir otra foto.
await hoja.getByRole("radio", { name: "Foto 2" }).click();
await esperarImagen();
assert.equal(await hoja.getByRole("radio", { name: "Foto 2" }).getAttribute("aria-checked"), "true");

// Todas: collage.
await hoja.getByRole("radio", { name: "Todas (3)" }).click();
await esperarImagen();
assert.equal(await hoja.locator(".elegir-foto-noche").count(), 0);
t = await textos();
assert.match(t, /vasos/);
await hoja.screenshot({ path: "capturas/fiesta-ig-todas.png" });

// Sin los vasos: solo las fotos y "Noche de fiesta".
await hoja.getByText("Mostrar los vasos").click();
await esperarImagen();
t = await textos();
assert.doesNotMatch(t, /vasos|Fernet|kcal/, "sin los vasos");
assert.match(t, /Noche de fiesta/);
assert.doesNotMatch(t, /gol/i);
await hoja.screenshot({ path: "capturas/fiesta-ig-sin-vasos.png" });

await b.close();
assert.deepEqual(errores, []);
console.log("fiesta en Instagram: pasaron");
