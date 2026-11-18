// Marcos del avatar según el nivel, logros en el chat y el día de cada uno por comida.
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
await p.goto("http://localhost:5199/");
await p.waitForTimeout(800);

await p.evaluate(() => {
  const viejo = "2026-01-01T12:00:00Z";
  const logros = ["comidas", "racha", "proteina", "agua", "peso", "fotogenico", "milanesa", "parrillero", "pizza", "empanadas", "pastas", "mate"];
  const de = (u, lista) => lista.forEach(([c, n]) => window.__db.medallas.push({ usuario_id: u, codigo: `${c}:${n}`, ganada_en: viejo }));
  window.__db.medallas = window.__db.medallas.filter((m) => !["u2", "u3", "u4"].includes(m.usuario_id));
  de("u2", [["milanesa", 5], ["pizza", 2]]); // 7: bronce (desde 6)
  de("u3", logros.slice(0, 5).map((c) => [c, 5])); // 25: oro
  de("u4", logros.map((c) => [c, 5])); // 60: legendario
  // Un logro de nivel 2 recién ganado y uno de nivel 1 (este no va al chat).
  const ahora = new Date().toISOString();
  window.__db.medallas.push({ usuario_id: "u3", codigo: "ensalada:2", ganada_en: ahora }, { usuario_id: "u3", codigo: "dulce:1", ganada_en: ahora });
  window.__canalDatos().emitir("medallas", { eventType: "INSERT", new: {} });
});
await p.waitForTimeout(5000);

// Marcos
const marcos = await p.locator(".tarjeta-amigo").evaluateAll((els) => els.map((e) => [e.querySelector(".amigo-datos strong").textContent, e.querySelector(".avatar").className]));
console.log(marcos);
const marcoDe = (n) => marcos.find(([t]) => t.startsWith(n))[1];
assert.equal(marcoDe("Nahuel"), "avatar con-marco marco-plata"); assert.equal(marcoDe("Juan"), "avatar con-marco marco-neon"); assert.equal(marcoDe("Tobi"), "avatar con-marco marco-legendario");
assert.ok(!/con-marco/.test(marcoDe("Steve")), "nivel bajo, sin marco");
assert.equal(await p.locator(".tarjeta-amigo .avatar-corona").count(), 1, "corona solo para el legendario");
await p.locator(".lista-amigos").screenshot({ path: "capturas/nv-marcos.png" });
await p.evaluate(() => [...document.querySelectorAll(".tarjeta-amigo")].find((e) => e.textContent.includes("Tobi")).scrollIntoView({ block: "center" }));
await p.waitForTimeout(500);
await p.locator(".tarjeta-amigo", { hasText: "Tobi" }).screenshot({ path: "capturas/nv-legendario.png" });

// El día de cada uno, por comida
const yo = p.locator(".tarjeta-amigo", { hasText: "(vos)" });
await yo.locator(".amigo-cabecera").click();
await p.waitForTimeout(500);
const tipos = await yo.locator(".dia-por-comida-tipo").allInnerTexts();
assert.deepEqual(tipos.map((t) => t.trim().toLowerCase()), ["desayuno", "almuerzo"]);
assert.ok(await yo.locator(".dia-por-comida-foto img").count() >= 1, "con fotos");
await yo.screenshot({ path: "capturas/nv-por-comida.png" });
await yo.locator("button.dia-por-comida-foto").nth(1).click();
await p.waitForTimeout(500);
assert.ok(await p.locator(".visor-foto").count() >= 1, "abre la foto");
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
if (await p.locator(".visor-foto").count()) await p.getByRole("button", { name: /Cerrar/ }).first().click();
await p.waitForTimeout(400);

// Logros en el chat
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
const linea = p.locator(".chat-logro");
await linea.first().waitFor();
const textos = await linea.allInnerTexts();
console.log(textos);
assert.equal(textos.length, 1, "solo desde el nivel 2 y solo lo nuevo");
assert.ok(/Juan llegó a .+ · nivel 2/.test(textos[0].replace(/\s+/g, " ")));
await p.waitForTimeout(400);
await p.locator(".chat-mensajes").screenshot({ path: "capturas/nv-chat.png" });

assert.deepEqual(errores, []);
await b.close();
console.log("marcos, logros en el chat y día por comida: pruebas pasadas");
