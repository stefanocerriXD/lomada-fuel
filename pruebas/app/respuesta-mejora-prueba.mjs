// El dueño responde un pedido de mejora (o lo marca "No va"): queda abajo del pedido y se pide el aviso a quien lo pidió.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pedidos = [];
  await ctx.route(/\/api\//, (r) => { pedidos.push(r.request().postDataJSON?.() || {}); return r.fulfill({ json: {} }); });
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199/?vista=mejoras");
  await p.locator(".mejoras").waitFor({ timeout: 8000 });
  await p.locator(".desplegable-mejoras summary").first().click();
  return { ctx, p, pedidos };
}

// 1) Responder "No va" con explicación.
let { ctx, p, pedidos } = await abrir();
const item = p.locator(".lista-mejoras li", { hasText: "Modo oscuro más oscuro" });
await item.getByRole("button", { name: "Responder" }).click();
await item.getByLabel("Respuesta al pedido").fill("Ya está: Ajustes › Apariencia › Full black");
await item.getByText("No se puede hacer").click();
await item.getByRole("button", { name: /Enviar respuesta/ }).click();
await item.locator(".mejora-respuesta").waitFor();
assert.match(await item.locator(".mejora-respuesta").innerText(), /Por qué no va[\s\S]*Full black/i);
assert.match(await item.locator("small").innerText(), /No va/);
assert.match(await p.locator(".desplegable-mejoras summary").first().innerText(), /0 sin hacer/, "no va sale de pendientes");
await p.waitForTimeout(300);
assert.deepEqual(pedidos.filter((x) => x.tipo === "mejora_respuesta").map((x) => x.id), ["mj1"], "se pide el aviso");
await item.screenshot({ path: "capturas/respuesta-mejora.png" });
// Editar: sacar el "no va" y cambiar el texto.
await item.getByRole("button", { name: "Editar respuesta" }).click();
assert.equal(await item.getByLabel("Respuesta al pedido").inputValue(), "Ya está: Ajustes › Apariencia › Full black");
await item.getByText("No se puede hacer").click();
await item.getByLabel("Respuesta al pedido").fill("Lo sumamos la semana que viene");
await item.getByRole("button", { name: /Enviar respuesta/ }).click();
await p.waitForTimeout(300);
assert.match(await item.locator(".mejora-respuesta").innerText(), /^Respuesta[\s\S]*semana que viene/i);
assert.doesNotMatch(await item.locator("small").innerText(), /No va/);
await ctx.close();

// 2) Sin ser dueño no aparece Responder.
({ ctx, p } = await abrir({ __noDueno: true }));
assert.equal(await p.getByRole("button", { name: "Responder" }).count(), 0);
await ctx.close();

// 3) Sin el SQL 060: avisa qué falta y no manda notificación.
({ ctx, p, pedidos } = await abrir({ __sin060: true }));
await p.getByRole("button", { name: "Responder" }).first().click();
await p.getByLabel("Respuesta al pedido").fill("hola");
await p.getByRole("button", { name: /Enviar respuesta/ }).click();
await p.getByText("Falta correr el SQL 060 en Supabase").waitFor();
assert.equal(pedidos.filter((x) => x.tipo === "mejora_respuesta").length, 0);
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("respuesta a mejoras: pasaron");
