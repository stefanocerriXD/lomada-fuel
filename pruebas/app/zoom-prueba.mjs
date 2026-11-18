import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
const cdp = await ctx.newCDPSession(p);
const espera = (ms) => p.waitForTimeout(ms);
const toque = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
async function arrastrar(desde, hasta, pasos = 8) {
  await toque("touchStart", [desde]);
  for (let i = 1; i <= pasos; i++) { await toque("touchMove", [[desde[0] + (hasta[0] - desde[0]) * i / pasos, desde[1] + (hasta[1] - desde[1]) * i / pasos]]); await espera(16); }
  await toque("touchEnd", []);
}
async function tocar(x, y) { await toque("touchStart", [[x, y]]); await espera(30); await toque("touchEnd", []); }
const escala = () => p.locator(".visor-foto .imagen-zoom img").evaluate((el) => { const m = new DOMMatrix(getComputedStyle(el).transform); return Math.round(m.a * 100) / 100; });
const titulo = () => p.locator(".visor-foto footer p").first().innerText();

await p.goto("http://localhost:5199"); await espera(1500);
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click(); await espera(600);
await p.getByRole("tab", { name: "Imágenes" }).click(); await espera(600);
await p.locator(".grupo-fotos-cabecera:not([disabled])").first().click(); await espera(800);
await p.locator(".comida img").first().click(); await espera(800);
await p.locator(".visor-foto").waitFor();
const caja = await p.locator(".visor-foto .imagen-zoom").boundingBox();
const cx = caja.x + caja.width / 2, cy = caja.y + caja.height / 2;
assert.equal(await escala(), 1);

// Doble toque: agranda; otro doble toque: vuelve.
await tocar(cx, cy); await espera(120); await tocar(cx, cy); await espera(400);
console.log("doble toque:", await escala(), "visor", await p.locator(".visor-foto").count(), await p.locator(".visor-foto footer").innerText().catch(() => "-"));
assert.equal(await escala(), 2.5);
assert.equal(await p.locator(".visor-flecha").count(), 0, "sin flechas con zoom");
// Con zoom, arrastrar mueve la foto y no cambia de comida.
const antes = await titulo();
console.log("antes", antes);
await arrastrar([cx, cy], [cx - 150, cy]); await espera(400);
console.log("tras mover:", await p.locator(".visor-foto").count(), await escala().catch(() => "-"));
assert.equal(await titulo(), antes, "no pasó de foto");
assert.equal(await p.locator(".visor-foto").count(), 1);
await tocar(cx, cy); await espera(120); await tocar(cx, cy); await espera(400);
assert.equal(await escala(), 1);

// Pellizcar con dos dedos.
await toque("touchStart", [[cx - 40, cy], [cx + 40, cy]]);
for (let i = 1; i <= 10; i++) { await toque("touchMove", [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]]); await espera(16); }
await toque("touchEnd", []); await espera(300);
console.log("pellizco:", await escala());
assert.ok((await escala()) > 2);
await p.screenshot({ path: "capturas/zoom-visor.png" });
await tocar(cx, cy); await espera(120); await tocar(cx, cy); await espera(400);

// Sin zoom: de costado pasa de foto, hacia abajo cierra.
const n = await p.locator(".visor-flecha.derecha").count();
if (n) {
  await arrastrar([cx + 100, cy], [cx - 100, cy]); await espera(700);
  console.log("deslizar:", antes, "->", await titulo());
  assert.notEqual(await titulo(), antes);
}
await arrastrar([cx, cy - 100], [cx, cy + 120]); await espera(700);
assert.equal(await p.locator(".visor-foto").count(), 0, "cerró al bajar");
assert.deepEqual(errores, []);
await b.close();
console.log("zoom ok");
