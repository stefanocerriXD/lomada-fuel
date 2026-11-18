import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(banderas = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: {} }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("lomada-algo", "x"); Object.assign(window, f); }, banderas);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1600);
  await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Cuenta/ }).first().click();
  await p.waitForTimeout(500);
  return { ctx, p };
}
const uid = "u1";
const archivos = {
  [uid]: [{ id: "1", name: "a.jpg" }, { id: null, name: "chat" }, { id: null, name: "bocha" }, ...Array.from({ length: 120 }, (_, i) => ({ id: `f${i}`, name: `f${i}.jpg` }))],
  [`${uid}/chat`]: [{ id: "2", name: "audio.webm" }],
  [`${uid}/bocha`]: [],
};

// 1. Borra fotos de todas las carpetas, después la cuenta, y sale.
{
  const { ctx, p } = await abrir({ __noDueno: true, __archivos: archivos });
  const tarjeta = p.locator(".borrar-cuenta");
  await tarjeta.scrollIntoViewIfNeeded();
  await tarjeta.getByRole("button", { name: /Borrar mi cuenta y mis datos/ }).click();
  const boton = tarjeta.getByRole("button", { name: "Borrar todo" });
  assert.equal(await boton.isDisabled(), true, "sin escribir BORRAR no se puede");
  await tarjeta.getByLabel("Escribí BORRAR para confirmar").fill("borrar");
  assert.equal(await boton.isDisabled(), false);
  await p.screenshot({ path: "capturas/borrar-cuenta.png", clip: await tarjeta.boundingBox() });
  await boton.click();
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => ({ quitados: window.__quitados, borrados: window.__borrados, salio: window.__salio, local: localStorage.getItem("lomada-algo") }));
  assert.equal(r.quitados.length, 122, "todas las fotos, en lotes");
  assert.ok(r.quitados.includes("u1/chat/audio.webm") && r.quitados.includes("u1/a.jpg"));
  assert.deepEqual(r.borrados, ["", "BORRAR"], "primero revisa, después borra");
  assert.equal(r.salio, true);
  assert.equal(r.local, null, "limpia el celu");
  await ctx.close();
}

// 2. Si el SQL no está, no borra ni una foto.
{
  const { ctx, p } = await abrir({ __noDueno: true, __sin055: true, __archivos: archivos });
  const tarjeta = p.locator(".borrar-cuenta");
  await tarjeta.scrollIntoViewIfNeeded();
  await tarjeta.getByRole("button", { name: /Borrar mi cuenta y mis datos/ }).click();
  await tarjeta.getByLabel("Escribí BORRAR para confirmar").fill("BORRAR");
  await tarjeta.getByRole("button", { name: "Borrar todo" }).click();
  await p.waitForTimeout(600);
  assert.match(await tarjeta.getByRole("alert").innerText(), /Todavía no se puede/);
  assert.equal(await p.evaluate(() => (window.__quitados || []).length), 0);
  await ctx.close();
}

// 3. El dueño no se puede borrar (y tampoco pierde fotos).
{
  const { ctx, p } = await abrir({ __archivos: archivos });
  const tarjeta = p.locator(".borrar-cuenta");
  await tarjeta.scrollIntoViewIfNeeded();
  await tarjeta.getByRole("button", { name: /Borrar mi cuenta y mis datos/ }).click();
  await tarjeta.getByLabel("Escribí BORRAR para confirmar").fill("BORRAR");
  await tarjeta.getByRole("button", { name: "Borrar todo" }).click();
  await p.waitForTimeout(600);
  assert.match(await tarjeta.getByRole("alert").innerText(), /Sos el dueño/);
  assert.equal(await p.evaluate(() => (window.__quitados || []).length), 0);
  await ctx.close();
}
await b.close();
assert.deepEqual(errores, []);
console.log("borrar cuenta: pasaron");
