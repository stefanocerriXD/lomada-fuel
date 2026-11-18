// Chat en vivo: mensajes al instante, quién escribe, quién reaccionó y que escribir no trabe.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\/notificar/, (r) => r.fulfill({ json: { enviadas: 1 } }));
await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199/?vista=chat");
await p.waitForTimeout(5000);
const difundir = (evento, payload) => p.evaluate(([e, d]) => window.__canalChat().difundir(e, d), [evento, payload]);
const enviados = (evento) => p.evaluate((e) => (window.__enviados || []).filter((m) => m.event === e).map((m) => m.payload), evento);

// Alguien escribe: aparece su burbuja con el nombre.
await difundir("actividad", { usuario_id: "u2", que: "escribiendo" });
await p.locator(".burbuja-escribiendo", { hasText: "Nahuel está escribiendo" }).waitFor({ timeout: 1500 });
await difundir("actividad", { usuario_id: "u3", que: "grabando" });
await p.locator(".burbuja-escribiendo", { hasText: "Juan está grabando un audio" }).waitFor({ timeout: 1500 });
await p.screenshot({ path: "capturas/cv-escribiendo.png" });

// Llega su mensaje por el canal directo: aparece enseguida y se va el "escribiendo".
const t0 = Date.now();
await difundir("mensaje", { id: "vivo1", usuario_id: "u2", texto: "Llegó al toque", creado_en: new Date().toISOString() });
await p.locator(".burbuja", { hasText: "Llegó al toque" }).waitFor({ timeout: 1000 });
console.log("mensaje entrante en", Date.now() - t0, "ms");
await p.locator(".burbuja-escribiendo", { hasText: "Nahuel" }).waitFor({ state: "detached", timeout: 1500 });
// Si llega dos veces (canal directo y base), se ve una sola.
await p.evaluate(() => window.__canalDatos().emitir("mensajes", { eventType: "INSERT", new: { id: "vivo1", usuario_id: "u2", texto: "Llegó al toque", creado_en: new Date().toISOString() } }));
await p.waitForTimeout(300);
assert.equal(await p.locator(".burbuja", { hasText: "Llegó al toque" }).count(), 1, "sin duplicados");

// Se vence solo si el otro cierra la app.
await p.locator(".burbuja-escribiendo", { hasText: "Juan" }).waitFor({ state: "detached", timeout: 8000 });

// Reacciones: se ve quién reaccionó, al instante.
await difundir("reaccion", { mensaje_id: "m6", usuario_id: "u2", emoji: "🔥", activa: true });
await difundir("reaccion", { mensaje_id: "m6", usuario_id: "u3", emoji: "🔥", activa: true });
const chip = p.locator(".chat-fila", { hasText: "Yo voy" }).locator(".reacciones-mensaje button", { hasText: "🔥" });
await chip.waitFor({ timeout: 1000 });
assert.match(await chip.getAttribute("aria-label"), /^🔥 de Nahuel y Juan\./);
assert.equal(await chip.locator(".reaccion-quienes > *").count(), 2, "las caritas de quienes reaccionaron");
// Tocar la reacción no reacciona: muestra quién reaccionó.
await chip.click();
const hojaR = p.getByRole("dialog", { name: "Reacciones" });
await hojaR.waitFor();
assert.equal(await hojaR.locator(".quienes-reaccionaron li").count(), 2);
assert.match(await hojaR.locator(".quienes-reaccionaron").innerText(), /Nahuel[\s\S]*Juan/);
assert.equal((await enviados("reaccion")).length, 0, "no reaccionó solo por tocar");
await p.waitForTimeout(700); await p.screenshot({ path: "capturas/cv-quien-reacciono.png" });
await hojaR.getByRole("button", { name: "Reaccionar con 🔥 también" }).click();
await p.waitForTimeout(200);
assert.match(await chip.getAttribute("aria-label"), /^🔥 de Nahuel, Juan y vos\./);
// La propia aparece primera y se saca tocándola.
assert.match(await hojaR.locator(".quienes-reaccionaron li").first().innerText(), /Vos[\s\S]*Tocá para sacarla/);
await hojaR.getByRole("button", { name: "Sacar tu 🔥" }).click();
await p.waitForTimeout(200);
assert.match(await chip.getAttribute("aria-label"), /^🔥 de Nahuel y Juan\./);
await hojaR.getByRole("button", { name: "Reaccionar con 🔥 también" }).click();
await p.waitForTimeout(200);
await p.keyboard.press("Escape");
await p.getByRole("button", { name: /Cerrar/ }).first().click().catch(() => {});
await hojaR.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
assert.deepEqual((await enviados("reaccion")).pop(), { mensaje_id: "m6", usuario_id: "u1", emoji: "🔥", activa: true }, "los demás se enteran al instante");
await p.locator(".chat-fila", { hasText: "Yo voy" }).screenshot({ path: "capturas/cv-reacciones.png" });
await difundir("reaccion", { mensaje_id: "m6", usuario_id: "u3", emoji: "🔥", activa: false });
await p.waitForTimeout(150);
assert.match(await chip.getAttribute("aria-label"), /^🔥 de Nahuel y vos\./);

// En las opciones del mensaje se ve la lista de quién reaccionó.
const burbuja = p.locator(".chat-fila", { hasText: "Yo voy" }).locator(".burbuja");
const caja = await burbuja.boundingBox();
await p.mouse.move(caja.x + 20, caja.y + 15);
await p.mouse.down();
await p.waitForTimeout(600);
await p.mouse.up();
const hoja = p.getByRole("dialog", { name: "Opciones" });
await hoja.waitFor();
const quienes = await hoja.locator(".quienes-reaccionaron li").allInnerTexts();
assert.equal(quienes.length, 2, quienes.join(" | "));
await p.screenshot({ path: "capturas/cv-quienes.png" });
await p.keyboard.press("Escape");
await hoja.waitFor({ state: "detached" }).catch(() => {});
await p.waitForTimeout(300);

// Escribir avisa a los demás, sin mandar un aviso por cada letra.
const campo = p.getByRole("textbox", { name: "Mensaje" });
await campo.click();
const antes = (await enviados("actividad")).length;
const inicio = Date.now();
await campo.pressSequentially("Mensaje largo para ver que escribir no se traba nada", { delay: 15 });
console.log("escribir 52 letras:", Date.now() - inicio, "ms");
const avisosEscribiendo = (await enviados("actividad")).slice(antes);
assert.ok(avisosEscribiendo.length >= 1 && avisosEscribiendo.length <= 3, `avisos de escribiendo: ${avisosEscribiendo.length}`);
assert.equal(avisosEscribiendo[0].que, "escribiendo");

// Mandar: el mensaje aparece al instante aunque la base tarde, y después se confirma.
await p.evaluate(() => { window.__demoraInsert = 1200; });
await p.getByRole("button", { name: "Enviar" }).click();
const propio = p.locator(".chat-fila.propia", { hasText: "Mensaje largo para ver" });
await propio.waitFor({ timeout: 300 });
assert.ok(await propio.evaluate((el) => el.classList.contains("pendiente")), "se ve enviando");
assert.equal(await campo.inputValue(), "", "el campo queda libre enseguida");
assert.equal((await enviados("actividad")).pop().que, null, "deja de figurar escribiendo");
await p.locator(".chat-fila.propia:not(.pendiente)", { hasText: "Mensaje largo para ver" }).waitFor({ timeout: 3000 });
const mandado = (await enviados("mensaje")).pop();
assert.equal(mandado.texto, "Mensaje largo para ver que escribir no se traba nada");
const insert = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").pop().fila);
assert.equal(insert.id, mandado.id, "el mismo id que se mostró");
assert.equal(await p.locator(".chat-fila", { hasText: "Mensaje largo para ver" }).count(), 1);
await p.evaluate(() => { window.__demoraInsert = 0; });

// Escribir con muchos mensajes en pantalla: los mensajes no se vuelven a dibujar por cada letra.
await p.evaluate(() => {
  window.__mutaciones = 0;
  new MutationObserver((l) => { window.__mutaciones += l.length; }).observe(document.querySelector(".chat-mensajes"), { subtree: true, childList: true, characterData: true, attributes: true });
});
await campo.pressSequentially("hola", { delay: 20 });
await p.waitForTimeout(200);
const mutaciones = await p.evaluate(() => window.__mutaciones);
console.log("cambios en la lista al escribir:", mutaciones);
assert.ok(mutaciones < 5, `la lista cambió ${mutaciones} veces al escribir`);
await p.screenshot({ path: "capturas/cv-final.png" });

assert.deepEqual(errores, []);
await b.close();
console.log("chat en vivo: pruebas pasadas");
