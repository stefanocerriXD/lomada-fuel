// Responder, reaccionar, vistos, fotos, stickers y el aviso antes de publicar.
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199/?vista=chat");
await p.waitForTimeout(1300);
const insertados = () => p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").map((l) => l.fila));

// Reacción que ya existía
assert.equal(await p.locator(".reacciones-mensaje button", { hasText: "😂" }).count(), 1);

// Mantener apretado abre las acciones
const burbuja = p.locator(".chat-fila", { hasText: "Quién se suma el sábado?" }).locator(".burbuja");
const caja = await burbuja.boundingBox();
await p.mouse.move(caja.x + 30, caja.y + 20);
await p.mouse.down();
await p.waitForTimeout(600);
await p.mouse.up();
await p.getByRole("dialog", { name: "Opciones" }).waitFor();
await p.screenshot({ path: "capturas/ch-acciones.png" });
await p.getByRole("button", { name: "Reaccionar con 🔥" }).click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".chat-fila", { hasText: "Quién se suma el sábado?" }).locator(".reacciones-mensaje button.mia").count(), 1);
const r = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "reacciones_mensajes" && l.op === "insert").pop()?.fila);
assert.deepEqual(r, { mensaje_id: "m5", usuario_id: "u1", emoji: "🔥" });

// Responder deslizando hacia la derecha
await p.getByRole("dialog", { name: "Opciones" }).waitFor({ state: "detached" }).catch(() => {});
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector(".chat-respondiendo")?.remove());
const fila = p.locator(".chat-fila", { hasText: "Así me gusta" }).locator(".burbuja");
const caja2 = await fila.boundingBox();
await p.mouse.move(caja2.x + 20, caja2.y + caja2.height / 2);
await p.mouse.down();
for (let i = 1; i <= 10; i += 1) { await p.mouse.move(caja2.x + 20 + i * 14, caja2.y + caja2.height / 2 + 1); await p.waitForTimeout(16); }
await p.screenshot({ path: "capturas/ch-deslizando.png" });
await p.mouse.up();
await p.locator(".chat-respondiendo", { hasText: "Así me gusta" }).waitFor();
assert.equal(await p.getByRole("dialog", { name: "Opciones" }).count(), 0, "deslizar no abre las opciones");
await p.getByRole("button", { name: "Cancelar respuesta" }).click();
// Deslizar sobre un mensaje no cambia de sección
await p.evaluate(() => {
  const el = [...document.querySelectorAll(".burbuja")].find((b) => b.textContent.includes("Así me gusta"));
  const r = el.getBoundingClientRect();
  const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: r.top + 10 });
  el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(r.left + 10)], changedTouches: [t(r.left + 10)] }));
  el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [t(r.left + 200)] }));
});
await p.waitForTimeout(400);
assert.equal(await p.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected"), "true");

// Responder un mensaje
await burbuja.click({ button: "right" });
await p.getByRole("dialog", { name: "Opciones" }).getByRole("button", { name: "Responder" }).click();
await p.locator(".chat-respondiendo", { hasText: "Respondiendo a Nahuel" }).waitFor();
await p.getByLabel("Mensaje").fill("Yo voy seguro");
await p.getByRole("button", { name: "Enviar", exact: true }).click();
await p.waitForTimeout(500);
assert.equal((await insertados()).pop().respuesta_mensaje, "m5");
const cita = p.locator(".chat-fila", { hasText: "Yo voy seguro" }).locator(".burbuja-cita");
assert.ok((await cita.innerText()).includes("Nahuel") && (await cita.innerText()).includes("Quién se suma"));
await p.screenshot({ path: "capturas/ch-respuesta.png" });

// Visto por
const visto = await p.locator(".visto").allInnerTexts();
console.log("visto:", visto);
assert.deepEqual(visto, ["Visto por Nahuel"]);

// Sticker
await p.getByRole("button", { name: "Stickers" }).click();
await p.locator(".panel-stickers").waitFor();
await p.screenshot({ path: "capturas/ch-stickers.png" });
await p.getByRole("button", { name: "Mandar sticker 🍖" }).click();
await p.waitForTimeout(500);
assert.equal((await insertados()).pop().sticker, "🍖");
assert.equal(await p.locator(".burbuja-sticker .sticker", { hasText: "🍖" }).count(), 1);

// Foto y GIF
fs.writeFileSync("capturas/anim.gif", Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
await p.getByLabel("Elegir foto o GIF").setInputFiles("capturas/anim.gif");
await p.waitForTimeout(700);
const conFoto = (await insertados()).pop();
assert.match(conFoto.adjunto_path, /^u1\/chat\/.+\.gif$/, "el GIF se sube tal cual");
assert.equal(await p.locator(".adjunto img").count(), 1);
await p.screenshot({ path: "capturas/ch-foto.png" });
assert.ok(avisos.length >= 3);

// Aviso antes de publicar con campos vacíos
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.locator(".historial button", { hasText: "Papines" }).click();
await p.getByRole("button", { name: "Publicar comida" }).click();
await p.locator(".confirmar-publicar").waitFor();
const texto = await p.locator(".confirmar-publicar p").innerText();
console.log("aviso:", texto);
assert.equal(texto, "Te falta la foto de la comida y el título. ¿Publicás igual?");
await p.screenshot({ path: "capturas/ch-confirmar.png" });
const antes = (await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "comidas" && l.op === "insert").length));
await p.getByRole("button", { name: "Completar" }).click();
await p.locator(".confirmar-publicar").waitFor({ state: "detached" });
await p.getByLabel("Nota de la comida").fill("Papines al horno");
await p.getByRole("button", { name: "Publicar comida" }).click();
await p.getByText("Te falta la foto de la comida. ¿Publicás igual?").waitFor();
await p.getByRole("button", { name: "Publicar igual" }).click();
await p.waitForTimeout(700);
const despues = (await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "comidas" && l.op === "insert").length));
assert.equal(despues, antes + 1);

await b.close();
assert.deepEqual(errores, []);
console.log("chat completo y aviso al publicar: todas las pruebas pasaron");
