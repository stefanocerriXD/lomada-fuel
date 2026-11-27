// Panel del dueño: aviso a todos con vista previa (pide confirmar), y el cartelito del mes que lleva a Mejoras.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const pedidos = [];
await ctx.route(/\/api\//, (r) => {
  const cuerpo = r.request().postDataJSON?.() || {};
  pedidos.push({ url: r.request().url(), cuerpo });
  return r.fulfill({ json: cuerpo.tipo === "anuncio" ? { enviadas: 7 } : {} });
});
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); });
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199"); await p.waitForTimeout(1500);

// El cartelito del mes: está, y al tocarlo lleva a Mejoras y no vuelve hasta el mes que viene.
const cartel = p.locator(".cartel-mejoras");
await cartel.waitFor();
await cartel.screenshot({ path: "capturas/cartel-mejoras.png" });
await cartel.locator(".cartel-mejoras-texto").click();
await p.locator(".mejoras").waitFor();
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".cartel-mejoras").count(), 0, "no vuelve este mes");

// El aviso a todos desde el panel del dueño.
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(400);
// Quedó abierta la sección Mejoras: se vuelve al menú.
if (await p.getByRole("button", { name: "Volver a ajustes" }).count()) await p.getByRole("button", { name: "Volver a ajustes" }).click();
await p.locator(".menu-ajustes button", { hasText: "Panel del dueño" }).click();
const aviso = p.locator(".aviso-todos");
await aviso.waitFor();
// Viene elegida la novedad del momento; la de mejoras queda como plantilla.
assert.match(await aviso.locator(".noti-previa").innerText(), /Lomada Fuel[\s\S]*historias del día[\s\S]*chef de la semana/i);
await aviso.getByRole("button", { name: "Mejoras", exact: true }).click();
assert.match(await aviso.locator(".noti-previa").innerText(), /¿Qué le mejorarías a Lomada Fuel\?[\s\S]*equipo de IT/i);
await aviso.getByRole("button", { name: "Historias y estrellas" }).click();
await aviso.screenshot({ path: "capturas/aviso-todos.png" });
await aviso.getByRole("button", { name: /Mandar a todos/ }).click();
assert.equal(pedidos.filter((x) => x.cuerpo.tipo === "anuncio").length, 0, "el primer toque solo pide confirmar");
await aviso.getByRole("button", { name: /Tocá de nuevo/ }).click();
await aviso.locator(".aviso-todos-ok").waitFor();
const anuncio = pedidos.find((x) => x.cuerpo.tipo === "anuncio").cuerpo;
assert.equal(anuncio.vista, "resumen", "viene elegida la novedad del momento");
assert.match(anuncio.titulo, /historias del día/);
assert.match(await aviso.locator(".aviso-todos-ok").innerText(), /Mandado a 7 celulares/);
await ctx.close();

// Tocar la notificación abre Ajustes › Mejoras.
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx2.route(/\/api\//, (r) => r.fulfill({ json: {} }));
await ctx2.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p2 = await ctx2.newPage();
p2.on("pageerror", (e) => errores.push(e.message));
await p2.goto("http://localhost:5199/?vista=mejoras");
await p2.locator(".mejoras").waitFor({ timeout: 8000 });
await ctx2.close();
await b.close();
assert.deepEqual(errores, []);
console.log("aviso a todos y cartel de mejoras: pasaron");
