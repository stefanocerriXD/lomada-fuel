import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
const avisos = [];
await ctx.route(/\/api\//, (r) => {
  const url = r.request().url();
  if (url.includes("/api/notificar")) { avisos.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ json: { ok: true } }); }
  if (url.includes("/api/alimentos")) {
    return r.fulfill({ json: { resultados: [
      { id: "off-1", nombre: "Yogur Ser sabor vainilla", marca: "Ser", fuente: "argentina", verificado: true, por100: { kcal: 113, p: 3, c: 15, g: 2 }, porcion: { nombre: "1 porción", g: 190 } },
      { id: "off-2", nombre: "Yogur batido frutilla", marca: "Ser", fuente: "argentina", verificado: false, por100: { kcal: 60, p: 3, c: 9, g: 1 }, porcion: null },
    ] } });
  }
  return r.fulfill({ status: 503, json: { error: "sin ia" } });
});
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);

// Alimentos cargados: uno propio (2 veces) y uno de otro del grupo.
await p.evaluate(() => {
  const yo = window.__db.comidas.filter((c) => c.usuario_id === "u1");
  const otro = window.__db.comidas.find((c) => c.usuario_id !== "u1");
  const yogur = { nombre: "Yogur Ser sabor vainilla", marca: "Ser", por100: { kcal: 113, p: 3, c: 15, g: 2 }, gramos: 190, cantidad: 1, unidad: { nombre: "porción", g: 190 } };
  yo[0].alimentos = [yogur, { nombre: "Tostada", kcal: 80, p: 2, c: 15, g: 1 }];
  yo[1].alimentos = [yogur];
  otro.alimentos = [{ nombre: "Yogur griego Ser", marca: "Ser", por100: { kcal: 95, p: 8, c: 5, g: 4 }, gramos: 170, cantidad: 1, unidad: { nombre: "pote", g: 170 } }];
  for (const c of [yo[0], yo[1], otro]) window.__canalDatos().emitir("comidas", { eventType: "UPDATE", new: c });
});
await p.waitForTimeout(1200);

// 1. Mañana aparece en la tira y deja cargar una comida planeada (sin foto ni aviso).
const manana = p.getByRole("button", { name: "Mañana" });
await manana.scrollIntoViewIfNeeded();
await manana.click();
await p.waitForTimeout(400);
assert.match(await p.locator(".dia-titulo").innerText(), /Mañana/);
await p.screenshot({ path: "capturas/buscador-manana.png" });
await p.getByRole("button", { name: /Agregar almuerzo/ }).click();
await p.waitForTimeout(700);
assert.match(await p.locator(".comida-planeada").innerText(), /planeada para mañana/);
assert.equal(await p.getByLabel("Foto de la comida").count(), 0, "sin foto en una comida planeada");

// 2. Comidas anteriores: se despliegan los alimentos.
const ver = p.getByRole("button", { name: /Ver los alimentos de/ }).first();
if (await ver.count()) {
  await ver.click();
  await p.waitForTimeout(400);
  const lista = await p.locator(".combo-alimentos").first().innerText();
  console.log("combo:", lista.replace(/\s+/g, " "));
  assert.ok(lista.length > 0);
  await p.screenshot({ path: "capturas/buscador-combo.png" });
} else console.log("(sin almuerzos anteriores en la prueba)");

// 3. Buscar: tus alimentos con veces, los del grupo, y productos con verificado y "lo cargaste".
await p.getByLabel("Buscar alimento o producto").fill("yogur");
await p.waitForTimeout(1500);
const texto = (await p.locator(".buscador").innerText()).replace(/\s+/g, " ");
console.log("buscador:", texto.slice(0, 400));
assert.match(texto, /tus alimentos/i);
assert.match(texto, /2 veces/);
assert.match(texto, /del grupo/i);
assert.match(texto, /Yogur griego Ser/);
await p.screenshot({ path: "capturas/buscador-yogur.png", fullPage: true });
await p.getByRole("button", { name: "Buscar en productos de supermercado" }).click().catch(() => {});
await p.waitForTimeout(1200);
const texto2 = (await p.locator(".buscador").innerText()).replace(/\s+/g, " ");
assert.match(texto2, /Verificado/);
assert.match(texto2, /Lo cargaste 2 veces/);
await p.screenshot({ path: "capturas/buscador-productos.png", fullPage: true });

// 4. Guardar la comida planeada: queda para mañana y no avisa al grupo.
await p.locator(".buscador .resultados button").first().click();
await p.waitForTimeout(500);
await p.getByLabel("Buscar alimento o producto").fill("");
await p.waitForTimeout(300);
const publicar = p.getByRole("button", { name: /Publicar|Guardar/ }).last();
await publicar.click();
await p.waitForTimeout(600);
const faltan = p.getByRole("button", { name: /Publicar igual|Guardar igual|Seguir/ });
if (await faltan.count()) { await faltan.first().click(); await p.waitForTimeout(800); }
const nueva = await p.evaluate(() => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const m = d.toLocaleDateString("en-CA");
  return window.__db.comidas.find((c) => c.usuario_id === "u1" && c.fecha === m);
});
assert.ok(nueva, "quedó guardada para mañana");
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 0, "no avisó al grupo");
await b.close();
assert.deepEqual(errores, []);
console.log("buscador ok");
