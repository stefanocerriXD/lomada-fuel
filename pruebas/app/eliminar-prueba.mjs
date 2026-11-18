import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: false, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();
await p.waitForTimeout(1200);

const opciones = async (texto) => {
  const burbuja = p.locator(".chat-fila", { hasText: texto }).last().locator(".burbuja");
  const caja = await burbuja.boundingBox();
  await p.mouse.move(caja.x + 20, caja.y + 15);
  await p.mouse.down();
  await p.waitForTimeout(600);
  await p.mouse.up();
  const hoja = p.getByRole("dialog", { name: "Opciones" });
  await hoja.waitFor();
  return hoja;
};

// Reacciones nuevas en el chat.
let hoja = await opciones("Quién se suma");
const emojis = await hoja.locator(".reaccionar button").allInnerTexts();
assert.ok(emojis.includes("🤮") && emojis.includes("🏳️‍🌈"), emojis.join(" "));
assert.equal(await hoja.getByRole("button", { name: /Eliminar/ }).count(), 0, "un mensaje ajeno no se puede eliminar");
await hoja.getByRole("button", { name: "Reaccionar con 🏳️‍🌈" }).click();
await p.waitForTimeout(400);

// Mando uno y lo elimino.
await p.getByLabel("Mensaje", { exact: true }).fill("Esto lo mandé sin querer");
await p.getByRole("button", { name: "Enviar" }).click();
await p.waitForTimeout(600);
hoja = await opciones("Esto lo mandé sin querer");
const eliminar = hoja.getByRole("button", { name: /Eliminar para todos/ });
await eliminar.click();
assert.match(await hoja.locator(".accion-mensaje.peligro").innerText(), /¿Seguro\?/);
await p.screenshot({ path: "capturas/eliminar-confirmar.png" });
await hoja.locator(".accion-mensaje.peligro").click();
await hoja.waitFor({ state: "detached" });
await p.waitForTimeout(400);
assert.equal(await p.locator(".chat-fila", { hasText: "Esto lo mandé sin querer" }).count(), 0);
const eliminado = p.locator(".mensaje-eliminado").last();
assert.match(await eliminado.innerText(), /Eliminaste este mensaje/);
const enviado = await p.evaluate(() => (window.__enviados || []).filter((m) => m.event === "eliminado").pop()?.payload);
assert.ok(enviado?.id, "les avisa a los demás al instante");
await p.screenshot({ path: "capturas/eliminar-chat.png" });

// Lo que borra otro le aparece a uno como "Mensaje eliminado".
await p.evaluate(() => window.__canalChat().difundir("eliminado", { id: "m4" }));
await p.waitForTimeout(400);
assert.ok((await p.locator(".mensaje-eliminado").allInnerTexts()).some((t) => /^\s*Mensaje eliminado/.test(t)));

// Uno viejo (más de 4 horas) ya no ofrece eliminar.
await p.evaluate(() => {
  const m = { id: "viejo1", usuario_id: "u1", texto: "Mensaje de esta mañana", creado_en: new Date(Date.now() - 5 * 3600000).toISOString() };
  window.__db.mensajes.push(m);
  window.__canalChat().difundir("mensaje", m);
});
await p.waitForTimeout(400);
hoja = await opciones("Mensaje de esta mañana");
assert.equal(await hoja.getByRole("button", { name: /Eliminar/ }).count(), 0);
await p.keyboard.press("Escape");
await p.waitForTimeout(300);

// Reacciones nuevas en las fotos.
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(700);
const tarjeta = p.locator(".comida", { hasText: "Pizza de muzzarella" }).first();
await tarjeta.getByRole("button", { name: /Reaccionar|Agregar reacción/ }).first().click();
await p.waitForTimeout(400);
const vomito = p.getByRole("button", { name: /🤮/ }).first();
assert.ok(await vomito.count(), "el vómito está entre las reacciones de las fotos");
assert.ok(await p.getByRole("button", { name: /🏳️‍🌈/ }).count(), "la bandera también");
await p.screenshot({ path: "capturas/reacciones-foto.png" });

assert.deepEqual(errores, []);
await b.close();
console.log("eliminar y emojis: pruebas pasadas");
