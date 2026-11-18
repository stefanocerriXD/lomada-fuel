import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [], enviadas: 0 } }));
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
await p.getByRole("button", { name: "Tu perfil" }).waitFor();

// Un deslizamiento real con el dedo
async function deslizar(xi, xf, y = 500, yf = y) {
  // Los festejos (logro nuevo, subida de nivel) tapan la pantalla unos segundos: se espera a que se vayan.
  await p.locator(".subida-nivel, .nuevo-logro").first().waitFor({ state: "hidden", timeout: 9000 }).catch(() => {});
  await p.evaluate(([a, c, d, e]) => {
    const el = document.elementFromPoint(a, d);
    const t = (x, y2) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y2 });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(a, d)], changedTouches: [t(a, d)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [t(c, e)] }));
  }, [xi, xf, y, yf]);
  await p.waitForTimeout(450);
}
const activa = () => p.locator(".item-menu.activo").locator("visible=true").first().innerText();
const pestana = async () => (await p.getByRole("tab", { selected: true }).first().innerText());

assert.equal(await activa(), "Resumen");
await deslizar(320, 90);
assert.equal(await activa(), "Grupo");
assert.equal(await pestana(), "Chat");
await deslizar(320, 90, 300);
assert.equal(await pestana(), "Imágenes", "pasa de Chat a Imágenes");
await deslizar(320, 90, 600);
assert.equal(await activa(), "Logros");
await deslizar(320, 90);
assert.equal(await activa(), "Ajustes");
await deslizar(320, 90);
assert.equal(await activa(), "Ajustes", "después del último no pasa nada");
await deslizar(90, 320);
assert.equal(await activa(), "Logros", "para atrás");

// Lo que no es deslizar de costado no cambia de sección
await deslizar(320, 280);
assert.equal(await activa(), "Logros", "movimiento corto");
await deslizar(320, 180, 300, 700);
assert.equal(await activa(), "Logros", "bajar la pantalla");
await deslizar(5, 250);
assert.equal(await activa(), "Logros", "desde el borde");

// La tira de días tiene su propio movimiento
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(450);
const caja = await p.locator(".tira-dias").boundingBox();
const seMueve = await p.locator(".tira-dias").evaluate((e) => e.scrollWidth > e.clientWidth);
assert.equal(seMueve, true);
await deslizar(320, 90, caja.y + 20);
assert.equal(await activa(), "Resumen", "la tira de días no cambia de sección");

// La línea de las pestañas no sale volando al cambiar entre Chat e Imágenes
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(450);
for (const [tab, bajar] of [["Imágenes", 0], ["Chat", 500], ["Imágenes", 0], ["Chat", 0]]) {
  if (bajar) await p.evaluate((y) => scrollTo(0, y), bajar);
  const caja2 = await p.locator(".grupo-barra").boundingBox();
  await p.getByRole("tab", { name: tab }).click();
  const alturas = [];
  for (let i = 0; i < 12; i += 1) {
    const l = await p.locator(".grupo-barra .selector-fondo").boundingBox();
    const m = await p.locator(".grupo-barra").boundingBox();
    alturas.push(Math.round(l.y - m.y));
    await p.waitForTimeout(25);
  }
  assert.equal(new Set(alturas).size, 1, `la línea se movió de alto hacia ${tab}: ${alturas}`);
  assert.ok(caja2);
  await p.waitForTimeout(300);
}
assert.equal(await p.locator(".dia-fondo").count() <= 1, true);

// Foto: de costado cambia y hacia abajo cierra
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(500);
await p.locator(".fotos-lista .comida-foto").first().click();
await p.locator(".visor-foto").waitFor();
await p.waitForTimeout(400);
const autor = () => p.locator(".visor-autor strong").innerText();
const primero = await autor();
const foto = await p.locator(".visor-imagen img").boundingBox();
const cx = foto.x + foto.width / 2;
const cy = foto.y + foto.height / 2;
const arrastrar = async (dx, dy) => {
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 8; i += 1) await p.mouse.move(cx + (dx * i) / 8, cy + (dy * i) / 8);
  await p.mouse.up();
  await p.waitForTimeout(500);
};
await arrastrar(-170, 0);
assert.notEqual(await autor(), primero, "cambió de foto");
await arrastrar(0, 200);
await p.waitForTimeout(300);
assert.equal(await p.locator(".visor-foto").count(), 0, "cerró hacia abajo");

// Festejo de logro: no bloquea y se va solo
await p.evaluate(() => {
  window.__db.medallas.length = 0;
  window.__canalDatos().emitir("medallas", { eventType: "DELETE", old: {} });
});
await p.locator(".nuevo-logro").waitFor({ timeout: 3000 });
await p.screenshot({ path: "capturas/l-festejo.png" });
assert.equal(await p.locator(".nuevo-logro").evaluate((e) => getComputedStyle(e).pointerEvents), "none");
await p.locator(".nuevo-logro").waitFor({ state: "detached", timeout: 4000 });

await b.close();
assert.deepEqual(errores, []);
console.log("deslizar, fotos y festejo: todas las pruebas pasaron");
