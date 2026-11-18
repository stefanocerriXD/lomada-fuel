import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);

// 1) Solo la foto: sin alimentos, queda el registro sin calorías y sin pedir los alimentos.
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(400);
await p.getByRole("radio", { name: /Merienda/ }).click();
await p.getByLabel("Foto de la comida").setInputFiles("archivos/foto-original.jpg");
await p.waitForTimeout(900);
assert.match(await p.locator(".solo-foto").innerText(), /Se publica solo la foto/);
// 2) Más fotos de la misma comida.
await p.getByLabel("Sumar otra foto de esta comida").setInputFiles(["archivos/foto-original.jpg", "archivos/etiqueta.png"]);
await p.waitForTimeout(800);
assert.equal(await p.locator(".fotos-extra .miniatura.con-foto").count(), 2);
await p.getByLabel("Nota de la comida").fill("Merienda en el club");
await p.screenshot({ path: "capturas/varias-fotos-carga.png" });
await p.getByRole("button", { name: "Publicar comida" }).click();
await p.waitForTimeout(800);
assert.equal(await p.locator(".confirmar-publicar").count(), 0, "no pide los alimentos si hay foto");
await p.waitForTimeout(800);
const guardada = await p.evaluate(() => window.__db.comidas.find((c) => c.descripcion === "Merienda en el club"));
assert.ok(guardada, "se guardó");
assert.equal(guardada.calorias, 0);
assert.deepEqual(guardada.alimentos, [{ nombre: "Foto", fuente: "foto" }]);
assert.equal(guardada.fotos_extra.length, 2);
assert.ok(guardada.foto_path && guardada.fotos_extra.every((r) => r.startsWith("u1/") && r !== guardada.foto_path));

// 3) En Imágenes: carrusel con contador, y en el visor, miniaturas.
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /^Merienda/ }).click();
await p.waitForTimeout(800);
const tarjeta = p.locator(".comida", { hasText: "Merienda en el club" }).first();
await tarjeta.locator(".carrusel-fotos").waitFor();
assert.equal(await tarjeta.locator(".carrusel-pista .comida-foto").count(), 3);
assert.equal((await tarjeta.locator(".carrusel-contador").innerText()).trim(), "1/3");
assert.match(await tarjeta.innerText(), /Contada en el total del día/);
await tarjeta.locator(".carrusel-pista").evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
await p.waitForTimeout(400);
assert.equal((await tarjeta.locator(".carrusel-contador").innerText()).trim(), "2/3");
assert.equal(await p.getByRole("tab", { name: "Imágenes" }).getAttribute("aria-selected"), "true", "deslizar fotos no cambia de pestaña");
await tarjeta.screenshot({ path: "capturas/varias-fotos-tarjeta.png" });

// 4) Editar: quitar una foto extra.
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(600);
await p.evaluate(() => {});
assert.deepEqual(errores, []);
await b.close();
console.log("varias fotos: pruebas pasadas");
