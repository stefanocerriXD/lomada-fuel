// Links en el chat: se detectan solos (https, www y dominios conocidos), se ven como link y al tocarlos se abren aparte
// (sin abrir el menú del mensaje). Mails, menciones y números no se confunden con links.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { partirEnlaces } from "../../src/lib/enlaces.js";

const links = (t) => partirEnlaces(t).filter((x) => x.url).map((x) => [x.texto, x.url]);
assert.deepEqual(links("mirá https://www.youtube.com/watch?v=abc123&t=10s"), [["https://www.youtube.com/watch?v=abc123&t=10s", "https://www.youtube.com/watch?v=abc123&t=10s"]]);
assert.deepEqual(links("www.lanacion.com.ar/deportes, buenísimo."), [["www.lanacion.com.ar/deportes", "https://www.lanacion.com.ar/deportes"]]);
assert.deepEqual(links("el perfil es instagram.com/lomada."), [["instagram.com/lomada", "https://instagram.com/lomada"]]);
assert.deepEqual(links("(ver https://es.wikipedia.org/wiki/Batata_(planta))"), [["https://es.wikipedia.org/wiki/Batata_(planta)", "https://es.wikipedia.org/wiki/Batata_(planta)"]]);
assert.deepEqual(links("dos: https://a.com y http://b.ar/x!"), [["https://a.com", "https://a.com"], ["http://b.ar/x", "http://b.ar/x"]]);
assert.deepEqual(links("mandame a juan.perez@gmail.com"), [], "un mail no es link");
assert.deepEqual(links("comí 2.5 porciones... @Nahuel vení"), [], "números y menciones no");
assert.equal(partirEnlaces("hola https://x.com chau").map((x) => x.texto).join(""), "hola https://x.com chau", "no se pierde texto");

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true, enviadas: 0, resultados: [] } }));
await ctx.route(/youtube\.com/, (r) => r.fulfill({ body: "<title>video</title>", contentType: "text/html" }));
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199/?vista=chat");
await p.waitForTimeout(1300);

await p.getByLabel("Mensaje").fill("Miren esto https://www.youtube.com/watch?v=abc123 y lo de @Nahuel");
await p.getByRole("button", { name: "Enviar" }).click();
await p.waitForTimeout(800);
const fila = p.locator(".chat-fila.propia", { hasText: "Miren esto" }).last();
const link = fila.locator("a.link-chat");
assert.equal(await link.count(), 1);
assert.equal(await link.getAttribute("href"), "https://www.youtube.com/watch?v=abc123");
assert.equal(await link.getAttribute("target"), "_blank");
assert.match(await link.getAttribute("rel"), /noopener/);
assert.equal(await fila.locator(".mencion").count(), 1, "la mención sigue resaltada");
await fila.locator(".burbuja").screenshot({ path: "capturas/link-chat.png" });

// Tocarlo abre una pestaña aparte y no el menú del mensaje.
const nueva = ctx.waitForEvent("page", { timeout: 5000 });
await link.tap();
const pagina = await nueva;
assert.match(pagina.url(), /youtube\.com\/watch\?v=abc123/);
await pagina.close();
await p.waitForTimeout(500);
assert.equal(await p.getByRole("dialog", { name: "Opciones" }).count(), 0, "no abre el menú");

await b.close();
assert.deepEqual(errores, []);
console.log("links en el chat: pasaron");
