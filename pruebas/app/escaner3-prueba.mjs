import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  // Una cámara que "abre" pero nunca manda imagen (lo que pasa en el iPhone).
  navigator.mediaDevices.getUserMedia = async () => document.createElement("canvas").captureStream(0);
});
const p = await ctx.newPage();
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
await p.keyboard.press("Escape");
await p.locator("[aria-label='Subir comida']").last().click();
await p.waitForTimeout(800);
await p.locator(".capa button[aria-label*='código' i], .capa button[aria-label*='Escanear' i]").first().click();
await p.waitForTimeout(6000); console.log(await p.evaluate(() => { const v = document.querySelector(".visor video"); return v ? { rs: v.readyState, w: v.videoWidth, t: v.currentTime, paused: v.paused } : document.querySelector(".tarjeta-interna")?.innerText; }));
await p.locator(".visor-sin-imagen").waitFor({ timeout: 3000 });
assert.equal(await p.locator(".boton-foto-codigo").count(), 1);
await p.locator(".visor").scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/escaner-negro.png" });
console.log("aviso sin imagen ok");
await b.close();
