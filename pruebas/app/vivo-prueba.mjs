// Simula lo que hace el iPhone: conexión caída, segundo plano y vuelta a la app.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [], enviadas: 0 } }));
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199/?vista=chat");
await p.waitForTimeout(1200);

const canales = () => p.evaluate(() => window.__canales.length);
const nuevoMensaje = (id, texto, emitir) => p.evaluate(([i, t, e]) => {
  const fila = { id: i, usuario_id: "u2", texto: t, creado_en: new Date().toISOString() };
  window.__db.mensajes.push(fila);
  if (e) window.__canalDatos().emitir("mensajes", { eventType: "INSERT", new: fila });
}, [id, texto, emitir]);
const hay = (texto) => p.getByText(texto, { exact: true }).count();
const plano = (estado) => p.evaluate((e) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => e });
  document.dispatchEvent(new Event("visibilitychange"));
}, estado);

// 1. Con la conexión viva llega al instante
await nuevoMensaje("v1", "Llegó en vivo", true);
await p.waitForTimeout(150);
assert.equal(await hay("Llegó en vivo"), 1, "mensaje en vivo");

// 2. Mientras está en segundo plano la conexión muere y pasan cosas
const antes = await canales();
await plano("hidden");
await nuevoMensaje("v2", "Mientras no mirabas", false);
await p.evaluate(() => {
  window.__db.comidas.unshift({ id: "v-c", usuario_id: "u2", tipo: "merienda", fecha: new Date().toLocaleDateString("en-CA"), foto_path: "f3", descripcion: "Alfajor nuevo", calorias: 250, proteinas: 3, carbohidratos: 30, grasas: 12, macros_editados: false, alimentos: [], creado_en: new Date().toISOString() });
  const real = Date.now;
  Date.now = () => real() + 60000; // Pasó un minuto.
});
assert.equal(await hay("Mientras no mirabas"), 0);
await plano("visible");
await p.waitForTimeout(500);
assert.equal(await hay("Mientras no mirabas"), 1, "al volver trae lo perdido");
assert.ok((await canales()) > antes, "al volver reconecta");

// 3. Lo que llega después de volver también entra
await nuevoMensaje("v3", "Después de volver", true);
await p.waitForTimeout(150);
assert.equal(await hay("Después de volver"), 1);

// 4. Las comidas nuevas aparecen sin cerrar la app
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(400);
assert.ok((await p.getByRole("button", { name: /^Merienda/ }).innerText()).includes("1 foto"), "la foto nueva está");

// 5. Caída del canal con la app abierta: se reconecta sola y recupera
await p.getByRole("tab", { name: "Chat" }).click();
const previos = await canales();
await nuevoMensaje("v4", "Durante la caída", false);
await p.evaluate(() => window.__canalDatos().estado("CHANNEL_ERROR"));
await p.waitForTimeout(3400);
assert.ok((await canales()) > previos, "reconecta");
await p.waitForTimeout(400);
assert.equal(await hay("Durante la caída"), 1, "recupera lo perdido");

// 6. Cambios de otros: reacciones y logros sin volver a abrir
await p.evaluate(() => {
  window.__db.medallas.push({ usuario_id: "u2", codigo: "mate:2" });
  window.__canalDatos().emitir("medallas", { eventType: "INSERT", new: {} });
});
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Integrantes" }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Nahuel/ }).click();
await p.locator(".perfil-stats").waitFor();
await p.getByRole("tab", { name: "Logros" }).click();
await p.waitForTimeout(300);
assert.equal(await p.getByText("Cebador principiante").count(), 1, "logro ajeno en vivo");

// 6b. Si alguien borra o edita una comida, su perfil abierto cambia
await p.getByRole("tab", { name: "Días" }).click();
await p.waitForTimeout(300);
const diasAntes = await p.locator(".perfil-dia").allInnerTexts();
assert.ok(diasAntes.some((t) => t.includes("Hoy")), "hoy tiene comidas");
await p.evaluate(() => {
  const db = window.__db;
  db.comidas = db.comidas.filter((c) => !(c.usuario_id === "u2" && c.fecha === new Date().toLocaleDateString("en-CA")));
});
await p.evaluate(() => window.__canalDatos().emitir("comidas", { eventType: "DELETE", old: {} }));
await p.waitForTimeout(800);
const diasDespues = await p.locator(".perfil-dia").allInnerTexts();
console.log("días antes:", diasAntes.length, "| después:", diasDespues.length);
assert.equal(diasDespues.length, diasAntes.length - 1, "lo borrado desaparece del perfil");
await p.getByRole("button", { name: "Cerrar" }).first().click();
await p.waitForTimeout(400);

// 7. Refrescar no vuelve a pedir las fotos que ya tiene: no parpadean
const firmas = await p.evaluate(async () => {
  const antes = window.__firmas;
  window.dispatchEvent(new Event("online"));
  await new Promise((r) => setTimeout(r, 2600));
  window.dispatchEvent(new Event("online"));
  await new Promise((r) => setTimeout(r, 400));
  return { antes, despues: window.__firmas };
});
assert.equal(firmas.despues, firmas.antes, `sin pedir firmas de nuevo: ${JSON.stringify(firmas)}`);

await b.close();
assert.deepEqual(errores, []);
console.log("tiempo real, segundo plano y reconexión: todas las pruebas pasaron");
