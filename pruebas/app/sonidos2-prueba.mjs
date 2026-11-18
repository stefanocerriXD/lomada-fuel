import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const errores = [];
async function abrir(extra = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((extra) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    if (extra.grupo) localStorage.setItem("mock-grupo", extra.grupo);
    window.__sonidos = [];
    for (const C of [OscillatorNode, AudioBufferSourceNode]) { const o = C.prototype.start; C.prototype.start = function (...a) { window.__sonidos.push(C.name); return o.apply(this, a); }; }
  }, extra);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1600);
  await p.mouse.click(5, 300); await p.waitForTimeout(200);
  return { ctx, p };
}
const cuenta = (p) => p.evaluate(() => window.__sonidos.length);
let { ctx, p } = await abrir();
// Cerrar con la cruz
await p.locator("[aria-label='Subir comida']").last().click(); await p.waitForTimeout(600);
let antes = await cuenta(p);
await p.locator(".capa button[aria-label='Cerrar']").first().click(); await p.waitForTimeout(300);
console.log("cerrar:", (await cuenta(p)) - antes); assert.ok((await cuenta(p)) > antes);
// Chat
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click(); await p.waitForTimeout(800);
const campo = p.getByLabel("Mensaje");
await campo.fill("hola"); antes = await cuenta(p);
await campo.press("Enter"); await p.waitForTimeout(400);
console.log("fiu:", (await cuenta(p)) - antes); assert.ok((await cuenta(p)) > antes, "fiu");
// Tirar para actualizar
await p.goto("http://localhost:5199"); await p.waitForTimeout(1600); await p.mouse.click(5, 300); await p.waitForTimeout(200);
const cdp = await ctx.newCDPSession(p);
const toque = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
antes = await cuenta(p);
await toque("touchStart", [[195, 200]]);
for (let i = 1; i <= 12; i++) { await toque("touchMove", [[195, 200 + 220 * i / 12]]); await p.waitForTimeout(16); }
await toque("touchEnd", []); await p.waitForTimeout(400);
console.log("clic:", (await cuenta(p)) - antes); assert.ok((await cuenta(p)) > antes, "clic");
await ctx.close();
// Entrar a un grupo: campanita
({ ctx, p } = await abrir({ grupo: "sin" }));
await p.getByPlaceholder("Nombre del grupo").fill("Los Pibes");
antes = await cuenta(p);
await p.getByRole("button", { name: "Crear", exact: true }).click();
await p.locator(".tarjeta-amigo").first().waitFor({ timeout: 5000 }); await p.waitForTimeout(300);
console.log("campanita:", (await cuenta(p)) - antes); assert.ok((await cuenta(p)) - antes >= 6, "campanita");
await ctx.close();
assert.deepEqual(errores, []);
console.log("sonidos 2 ok");
await b.close();
