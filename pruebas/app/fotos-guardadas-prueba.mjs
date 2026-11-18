import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => { window.__fotoJpg = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(2000);
// La primera vez se baja y queda guardada en el celu.
const guardadas = () => p.evaluate(async () => (await (await caches.open("lomada-fotos-v1")).keys()).map((r) => decodeURIComponent(new URL(r.url).pathname)));
assert.deepEqual(await guardadas(), ["/foto-guardada/u2/torta-1.jpg"]);
const firmas1 = await p.evaluate(() => window.__firmas);
// Al volver a entrar abre desde el celu, sin pedirla de nuevo.
await p.reload();
await p.waitForTimeout(2000);
const src = await p.evaluate(() => [...document.querySelectorAll("img")].map((i) => i.src).filter((s) => s.startsWith("blob:")));
assert.ok(src.length >= 1, "la foto sale del celu");
const pedidas = await p.evaluate(() => window.__llamadasFirma || null);
console.log("firmas antes/después:", firmas1, await p.evaluate(() => window.__firmas));
const ok = await p.evaluate(async (s) => { const r = await fetch(s); return r.ok && (await r.blob()).size > 0; }, src[0]);
assert.ok(ok);
// Al cerrar sesión se borran.
await p.evaluate(async () => { const { borrarFotosGuardadas } = await import("/src/lib/fotosGuardadas.js"); await borrarFotosGuardadas(); });
assert.equal(await p.evaluate(() => caches.has("lomada-fotos-v1")), false);
assert.deepEqual(errores, []);
await b.close();
console.log("fotos guardadas: pruebas pasadas");
