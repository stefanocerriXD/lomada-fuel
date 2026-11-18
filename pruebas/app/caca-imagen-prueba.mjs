import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: {} }));
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); window.__sinImagenesBocha = true; });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199"); await p.waitForTimeout(1600);
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /La cacona/ }).first().click();
await p.waitForTimeout(500);
// Un PNG grande, con textura de foto y transparencia, armado en el navegador y puesto en el campo.
const pesoOriginal = await p.getByLabel("Imagen del Bocha", { exact: true }).evaluate(async (input) => {
  const c = document.createElement("canvas"); c.width = 2000; c.height = 2000;
  const x = c.getContext("2d");
  const d = x.createImageData(2000, 2000);
  for (let i = 0; i < d.data.length; i += 4) {
    const px = (i / 4) % 2000, py = Math.floor(i / 8000);
    d.data[i] = (px / 8 + Math.random() * 40) | 0; d.data[i + 1] = (py / 8 + Math.random() * 40) | 0; d.data[i + 2] = 120 + Math.random() * 40;
    d.data[i + 3] = Math.hypot(px - 1000, py - 1000) < 900 ? 255 : 0;
  }
  x.putImageData(d, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
  const dt = new DataTransfer(); dt.items.add(new File([blob], "bocha.png", { type: "image/png" }));
  input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
  return blob.size;
});
await p.waitForTimeout(2500);
const [subida] = await p.evaluate(() => window.__subidas);
console.log("original", pesoOriginal, "subida", JSON.stringify(subida));
assert.ok(subida.peso < pesoOriginal / 2, "mucho más liviana");
assert.equal(subida.tipo, "image/webp", "mantiene la transparencia");
assert.match(subida.ruta, /\/bocha\/bocha-\d+\.webp$/);
await ctx.close(); await b.close();
assert.deepEqual(errores, []);
console.log("imagen del Bocha: pasó");
