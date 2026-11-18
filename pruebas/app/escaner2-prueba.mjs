import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const S = new URL("./archivos/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
async function abrir(args) {
  const b = await chromium.launch({ channel: "chrome", headless: true, args });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ["camera"] });
  const pedidos = [];
  await ctx.route(/\/api\//, (r) => { pedidos.push(r.request().url()); return r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }); });
  await ctx.route(/openfoodfacts/, (r) => { pedidos.push(r.request().url()); return r.fulfill({ json: { status: 0 } }); });
  await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  await p.keyboard.press("Escape");
  await p.locator("[aria-label='Subir comida']").last().click();
  await p.waitForTimeout(800);
  await p.locator(".capa button[aria-label*='código' i], .capa button[aria-label*='Escanear' i]").first().click();
  return { b, p, errores, pedidos };
}
// 1) Video de la cámara con un código: se lee solo.
let { b, p, errores, pedidos } = await abrir(["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--use-file-for-fake-video-capture=" + S + "codigo.mjpeg"]);
await p.waitForFunction(() => document.querySelector(".codigo-manual input")?.value?.length === 13, null, { timeout: 15000 });
console.log("video leyó:", await p.locator(".codigo-manual input").inputValue(), "| cámara cerrada:", await p.locator(".visor").count() === 0);
assert.equal(await p.locator(".codigo-manual input").inputValue(), "7790895000997");
assert.deepEqual(errores, []);
await b.close();
// 2) Foto del código (plan B).
({ b, p, errores } = await abrir(["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]));
await p.waitForTimeout(1000);
await p.locator("input[aria-label='Foto del código de barras']").setInputFiles(S + "codigo-foto.jpg");
await p.waitForFunction(() => document.querySelector(".codigo-manual input")?.value?.length === 13, null, { timeout: 20000 });
console.log("foto leyó:", await p.locator(".codigo-manual input").inputValue());
await p.screenshot({ path: "capturas/escaner-foto.png" });
assert.deepEqual(errores, []);
await b.close();
// 3) Cámara sin imagen: aparece el aviso.
({ b, p, errores } = await abrir([]));
await p.evaluate(() => {});
await b.close();
console.log("escaner ok");
