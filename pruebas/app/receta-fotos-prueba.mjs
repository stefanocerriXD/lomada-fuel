import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199/?vista=ajustes");
await p.waitForTimeout(1200);
await p.locator(".menu-ajustes button", { hasText: "Mis recetas" }).click();
await p.waitForTimeout(400);

// 1) Nueva receta con una foto subida y otra tomada de una comida ya cargada.
await p.getByRole("button", { name: "Nueva receta" }).click();
await p.waitForTimeout(500);
await p.getByLabel("Nombre de la receta").fill("Milanesa con puré");
await p.getByLabel("Buscar ingrediente").fill("avena");
await p.waitForTimeout(800);
await p.locator(".editor-receta .resultados button").first().click();
await p.waitForTimeout(300);
await p.getByLabel("Subir fotos de la receta").setInputFiles("archivos/foto-original.jpg");
await p.waitForTimeout(800);
await p.getByRole("button", { name: "Elegir la foto de una comida que ya cargaste" }).click();
await p.getByRole("heading", { name: "Elegí una comida" }).waitFor();
await p.waitForTimeout(400);
const opciones = await p.locator(".elegir-comida-foto li").allInnerTexts();
console.log("comidas para elegir:", opciones.map((t) => t.replace(/\n/g, " ")).slice(0, 3));
// La que se parece a la receta va primera.
assert.match(opciones[0], /Milanesa con puré[\s\S]*Con esta receta/);
await p.screenshot({ path: "capturas/receta-elegir-foto.png" });
await p.locator(".elegir-comida-foto button").first().click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".fotos-receta .miniatura.con-foto").count(), 2);
await p.screenshot({ path: "capturas/receta-fotos-editor.png" });
await p.getByRole("button", { name: "Guardar receta" }).click();
await p.waitForTimeout(1200);
const receta = await p.evaluate(() => window.__db.recetas_propias.find((r) => r.nombre === "Milanesa con puré"));
console.log("fotos guardadas:", receta.fotos);
assert.equal(receta.fotos.length, 2);
assert.ok(receta.fotos.every((r) => r.startsWith("u1/recetas/")), "subida y copiada a la carpeta de recetas");
assert.deepEqual(await p.evaluate(() => window.__copias.map(([de]) => de)), ["f2"], "copió la foto de la comida");

// 2) La lista muestra la foto. Compartirla en el chat.
assert.equal(await p.locator(".lista-recetas .receta-miniatura").count(), 1);
await p.locator(".lista-recetas button", { hasText: "Milanesa con puré" }).click();
await p.getByRole("heading", { name: "Editar receta" }).waitFor();
assert.equal(await p.locator(".fotos-receta .miniatura.con-foto").count(), 2, "al editar están sus fotos");
await p.getByRole("button", { name: /Compartir en el chat/ }).click();
await p.waitForTimeout(900);
await p.getByRole("button", { name: /^Enviar/ }).click().catch(() => p.locator(".chat-enviar, button[aria-label='Enviar']").first().click());
await p.waitForTimeout(900);
const tarjeta = p.locator(".receta-chat", { hasText: "Milanesa con puré" }).last();
assert.equal(await tarjeta.locator(".receta-chat-foto").count(), 1, "en el chat se ve la foto");

// 3) Desde el chat: ver la receta con su foto y editarla.
await tarjeta.click();
await p.getByRole("heading", { name: "Receta" }).waitFor();
await p.waitForTimeout(400);
assert.equal(await p.locator(".ver-receta .carrusel-fotos").count(), 1);
await p.screenshot({ path: "capturas/ver-receta-fotos.png" });
await p.getByRole("button", { name: "Editar receta" }).click();
await p.getByRole("heading", { name: "Editar receta" }).waitFor();
await p.getByLabel("Nombre de la receta").fill("Milanesa con puré de la abuela");
await p.getByRole("button", { name: "Guardar receta" }).click();
await p.waitForTimeout(1000);
assert.ok(await p.evaluate(() => window.__db.recetas_propias.some((r) => r.nombre === "Milanesa con puré de la abuela" && r.fotos.length === 2)));

assert.deepEqual(errores, []);
await b.close();
console.log("fotos y edición de recetas: pruebas pasadas");
