import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__compartidos = [];
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__compartidos.push(d.files.map((f) => [f.name, f.type, f.size])); };
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
// Una comida propia con foto y título largo.
const tipo = await p.evaluate(() => {
  const c = window.__db.comidas.find((x) => x.usuario_id === "u1" && x.foto_path && x.tipo !== "fiesta");
  c.descripcion = "Milanesa napolitana con papas fritas y ensalada mixta";
  c.calorias = 1240; c.proteinas = 62; c.carbohidratos = 98; c.grasas = 58;
  window.__canalDatos().emitir("comidas", { eventType: "UPDATE", new: c });
  return c.tipo;
});
await p.waitForTimeout(1500);
console.log("tipo", tipo);
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click(); await p.waitForTimeout(600);
await p.getByRole("tab", { name: "Imágenes" }).click(); await p.waitForTimeout(600);
const nombres = { desayuno: /^Desayuno/, almuerzo: /^Almuerzo/, merienda: /^Merienda/, cena: /^Cena/ };
await p.locator(".grupo-fotos-cabecera", { hasText: nombres[tipo] || /Colaci/ }).first().click(); await p.waitForTimeout(800);
const boton = p.getByRole("button", { name: "Instagram" }).first();
await boton.scrollIntoViewIfNeeded();
await boton.click();
await p.getByRole("dialog", { name: "Compartir en Instagram" }).waitFor();
const img = p.locator(".compartir-ig-vista img");
await img.waitFor({ timeout: 8000 });
async function bajar(nombre) {
  const datos = await img.evaluate(async (el) => { const r = await fetch(el.src); const a = new Uint8Array(await r.arrayBuffer()); let s = ""; a.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); });
  fs.writeFileSync(`capturas/${nombre}`, Buffer.from(datos, "base64"));
}
const medidas = async () => img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
assert.deepEqual(await medidas(), [1080, 1920]);
await bajar("ig-historia.jpg");
await p.screenshot({ path: "capturas/ig-hoja.png" });
await p.getByRole("button", { name: "Compartir", exact: true }).click();
await p.waitForTimeout(300);
const compartidos = await p.evaluate(() => window.__compartidos);
console.log(compartidos);
assert.equal(compartidos[0][0][1], "image/jpeg");
await p.getByRole("radio", { name: "Publicación" }).click();
await p.waitForTimeout(1500);
assert.deepEqual(await medidas(), [1080, 1350]);
await bajar("ig-publicacion.jpg");
await p.getByRole("button", { name: "Cerrar" }).last().click(); await p.waitForTimeout(500);
await p.locator(".comida .comida-foto, .comida img").first().click(); await p.waitForTimeout(700);
await p.getByRole("button", { name: "Compartir en Instagram" }).click();
await p.locator(".compartir-ig-vista img").waitFor({ timeout: 8000 });
// Se espera a que la hoja termine de subir (mientras se anima, el botón puede estar todavía abajo de la pantalla).
const arriba = await p.waitForFunction(() => { const r = document.querySelector(".compartir-ig .boton")?.getBoundingClientRect(); return r && document.elementFromPoint(r.x + 20, r.y + 10)?.closest(".compartir-ig") != null; }, null, { timeout: 4000 }).then(() => true, () => false);
assert.ok(arriba, "la hoja queda arriba del visor");
await p.screenshot({ path: "capturas/ig-visor.png" });
await ctx.close();
assert.deepEqual(errores, []);
await b.close();
console.log("instagram ok");

// En iPhone, "Guardar en Fotos" abre el menú de compartir (que trae "Guardar imagen"), no una descarga con link.
{
  const b2 = await (await import("playwright-core")).chromium.launch({ channel: "chrome", headless: true });
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: {} }));
  await ctx.addInitScript(() => {
    localStorage.setItem("comidas-bienvenida", "vista");
    window.__compartidos = [];
    navigator.canShare = () => true;
    navigator.share = async (d) => { window.__compartidos.push(d.files.map((f) => f.type)); };
  });
  const p = await ctx.newPage();
  let descargas = 0;
  p.on("download", () => descargas++);
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click(); await p.waitForTimeout(600);
  await p.getByRole("tab", { name: "Imágenes" }).click(); await p.waitForTimeout(600);
  await p.locator(".grupo-fotos-cabecera").first().click(); await p.waitForTimeout(800);
  const ig = p.getByRole("button", { name: "Instagram" }).first();
  await ig.scrollIntoViewIfNeeded();
  await ig.click();
  const guardarFotos = p.getByRole("button", { name: /Guardar en Fotos/ });
  await guardarFotos.waitFor();
  await p.waitForFunction(() => !document.querySelector(".compartir-ig .boton-texto")?.disabled);
  await guardarFotos.click();
  await p.waitForTimeout(400);
  const compartidos = await p.evaluate(() => window.__compartidos);
  if (compartidos.length !== 1 || descargas !== 0) throw new Error(`iPhone: esperaba el menú de compartir, hubo ${compartidos.length} menús y ${descargas} descargas`);
  await b2.close();
  console.log("iPhone: Guardar en Fotos abre el menú de compartir");
}
