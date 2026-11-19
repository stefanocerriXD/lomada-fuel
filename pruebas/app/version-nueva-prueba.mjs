// Si se publicó una versión nueva con la app abierta, abrir una sección no deja la pantalla en blanco:
// recarga una vez sola y, si igual no puede, muestra "Algo no cargó" con el resto de la app andando.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: {} }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); });
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
let cargas = 0;
p.on("load", () => { cargas += 1; });
await p.goto("http://localhost:5199"); await p.waitForTimeout(1500);
// El archivo de Imágenes "ya no existe".
await ctx.route(/\/src\/vistas\/Imagenes\.jsx/, (r) => r.fulfill({ status: 404, body: "no está" }));
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click(); await p.waitForTimeout(600);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(3000);
assert.equal(cargas, 2, "recargó una vez sola");
// Después de recargar vuelve al Resumen; al volver a Imágenes (sigue sin existir) muestra el aviso, no blanco.
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click(); await p.waitForTimeout(600);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.locator(".recuperable").waitFor({ timeout: 8000 });
assert.match(await p.locator(".recuperable").innerText(), /Algo no cargó[\s\S]*Recargar/);
assert.equal(cargas, 2, "no recarga en bucle");
assert.ok(await p.locator(".barra-inferior").isVisible(), "el resto de la app sigue");
await p.screenshot({ path: "capturas/version-nueva.png" });
// El chat sigue andando.
await p.getByRole("tab", { name: "Chat" }).click(); await p.waitForTimeout(800);
assert.equal(await p.locator(".recuperable").count(), 0);
await ctx.unroute(/\/src\/vistas\/Imagenes\.jsx/);
await b.close();
console.log("version nueva sin pantalla en blanco: pasaron");
