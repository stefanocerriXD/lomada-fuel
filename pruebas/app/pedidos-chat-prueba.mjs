// Pedidos para entrar al grupo en el chat (SQL 069): "Fulano quiere unirse al grupo". Quien administra acepta o
// rechaza desde ahí; al aceptar queda "Aceptado" y el bot avisa que se unió. Los demás ven que está esperando.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const pedidos = () => [{ id: "s1", usuario_id: "u9", nombre: "Tiago", usuario: "tiago", creado_en: new Date().toISOString() }, { id: "s2", usuario_id: "u8", nombre: "Pepa", usuario: "pepa", creado_en: new Date().toISOString() }];
async function abrir(flags) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true, enviadas: 0 } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("mock-grupo", "lomada"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199/?vista=chat");
  await p.waitForTimeout(1500);
  return { ctx, p };
}

// 1) Quien administra: acepta desde el chat.
let { ctx, p } = await abrir({ __con069: true, __admin: true, __pedidos: pedidos() });
const tiago = p.locator(".pedido-grupo", { hasText: "Tiago quiere unirse al grupo." });
await tiago.waitFor();
await tiago.scrollIntoViewIfNeeded();
await tiago.screenshot({ path: "capturas/pedido-chat.png" });
await tiago.getByRole("button", { name: "Aceptar" }).click();
await tiago.getByText("Aceptado").waitFor({ timeout: 5000 });
assert.equal(await tiago.getByRole("button", { name: "Aceptar" }).count(), 0, "ya no se puede volver a aceptar");
assert.equal(await p.evaluate(() => window.__pedidos.find((x) => x.id === "s1").estado), "aceptada");
// Llega el aviso de la base: se unió.
await p.evaluate(() => { const m = window.__db.mensajes.find((x) => x.id === "mu-s1"); window.__canalDatos().emitir("mensajes", { eventType: "INSERT", new: m }); });
await p.locator(".chat-se-unio", { hasText: "Tiago se unió al grupo." }).waitFor({ timeout: 5000 });
// Rechazar pide confirmación.
const pepa = p.locator(".pedido-grupo", { hasText: "Pepa quiere unirse al grupo." });
await pepa.getByRole("button", { name: "Rechazar" }).click();
assert.equal(await p.evaluate(() => window.__pedidos.find((x) => x.id === "s2").estado), undefined, "el primer toque no rechaza");
await pepa.getByRole("button", { name: "¿Rechazar?" }).click();
await pepa.getByText("No fue aceptado").waitFor({ timeout: 5000 });
assert.equal(await p.evaluate(() => window.__pedidos.find((x) => x.id === "s2").estado), "rechazada");
await p.locator(".chat-mensajes, .chat-lista, main").first().screenshot({ path: "capturas/pedido-chat-aceptado.png" }).catch(() => {});
await ctx.close();

// 2) Alguien del grupo que no administra: lo ve, pero sin botones.
({ ctx, p } = await abrir({ __con069: true, __pedidos: pedidos() }));
const otro = p.locator(".pedido-grupo", { hasText: "Tiago quiere unirse al grupo." });
await otro.waitFor();
assert.equal(await otro.getByRole("button").count(), 0, "no administra");
assert.match(await otro.innerText(), /Esperando que lo acepte/);
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("pedidos en el chat: pasaron");
