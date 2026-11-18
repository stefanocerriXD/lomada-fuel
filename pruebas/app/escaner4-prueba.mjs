import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  // Cámara que manda cuadros, pero todos negros.
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement("canvas"); c.width = 640; c.height = 480;
    const g = c.getContext("2d");
    setInterval(() => { g.fillStyle = "#000"; g.fillRect(0, 0, 640, 480); }, 50);
    return c.captureStream(20);
  };
});
const p = await ctx.newPage();
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
await p.keyboard.press("Escape");
await p.locator("[aria-label='Subir comida']").last().click();
await p.waitForTimeout(800);
await p.locator(".capa button[aria-label*='código' i], .capa button[aria-label*='Escanear' i]").first().click();
assert.equal(await p.locator(".boton-foto-codigo").count(), 1, "en iPhone la foto va de entrada como boton");
await p.locator(".visor-sin-imagen").waitFor({ timeout: 9000 });
console.log(await p.evaluate(() => { const v = document.querySelector(".visor video"); return { rs: v.readyState, w: v.videoWidth }; }));
console.log("negro detectado ok");
await b.close();
