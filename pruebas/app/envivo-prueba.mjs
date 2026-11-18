import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ["microphone"] });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [], enviadas: 1 } }));
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199/?vista=chat");
await p.waitForTimeout(1300);
const rastreos = () => p.evaluate(() => window.__rastreos || []);
const sincronizar = (estado) => p.evaluate((e) => {
  window.__presencia = e;
  window.__canales.forEach((c) => c.emitir("presence"));
}, estado);

// Lo que hacen los demás, en vivo: publicar va por presencia; escribir, por el canal del chat.
const difundir = (evento, payload) => p.evaluate(([e, d]) => window.__canalChat().difundir(e, d), [evento, payload]);
await sincronizar({ u2: [{ publicando: false }], u3: [{ publicando: true }] });
await difundir("actividad", { usuario_id: "u2", que: "escribiendo" });
await difundir("actividad", { usuario_id: "u1", que: "escribiendo" });
await p.waitForTimeout(200);
assert.equal(await p.locator(".burbuja-escribiendo").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " ").trim()).join(" | ")), "Nahuel está escribiendo", "uno mismo no aparece");
await p.screenshot({ path: "capturas/v-envivo.png" });
await difundir("actividad", { usuario_id: "u4", que: "escribiendo" });
await p.waitForTimeout(200);
assert.equal(await p.locator(".burbuja-escribiendo").count(), 2);
await difundir("actividad", { usuario_id: "u2", que: null });
await difundir("actividad", { usuario_id: "u4", que: null });
await p.waitForTimeout(400);
assert.equal(await p.locator(".burbuja-escribiendo").count(), 0, "cuando paran, desaparece");
await sincronizar({});

// Lo propio se avisa
const actividad = () => p.evaluate(() => (window.__enviados || []).filter((m) => m.event === "actividad").map((m) => m.payload.que));
await p.getByLabel("Mensaje").type("Hola");
assert.equal((await actividad()).at(-1), "escribiendo");
await p.getByRole("button", { name: "Enviar", exact: true }).click();
await p.waitForTimeout(300);
assert.equal((await actividad()).at(-1), null, "al enviar deja de escribir");
await p.evaluate(() => document.activeElement?.blur());
await p.waitForTimeout(350);
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.waitForTimeout(400);
assert.equal((await rastreos()).at(-1).publicando, true);
await p.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
await p.waitForTimeout(500);
assert.equal((await rastreos()).at(-1).publicando, false);

// Audio
assert.equal(await p.getByRole("button", { name: "Grabar audio" }).count(), 1, "con el campo vacío aparece el micrófono");
await p.getByRole("button", { name: "Grabar audio" }).click();
await p.locator(".grabando").waitFor();
await p.waitForTimeout(1500);
await p.screenshot({ path: "capturas/v-grabando.png" });
await p.getByRole("button", { name: "Mandar audio" }).click();
await p.waitForTimeout(800);
const fila = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").pop()?.fila);
assert.match(fila.adjunto_path, /^u1\/chat\/.+\.(webm|m4a)$/);
assert.equal(await p.locator(".burbuja audio").count(), 1);
await p.screenshot({ path: "capturas/v-audio.png" });

// Descartar no manda nada
await p.getByRole("button", { name: "Grabar audio" }).click();
await p.locator(".grabando").waitFor();
await p.waitForTimeout(600);
const antes = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").length);
await p.getByRole("button", { name: "Descartar audio" }).click();
await p.waitForTimeout(500);
assert.equal(await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").length), antes);

await b.close();
assert.deepEqual(errores, []);
console.log("escribiendo, publicando y audios: todas las pruebas pasaron");
