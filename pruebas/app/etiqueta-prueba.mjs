import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

// Una etiqueta argentina típica, sacada como foto (con algo de inclinación y ruido no: lo justo para el lector).
{
  const pag = await b.newPage({ viewport: { width: 520, height: 560 }, deviceScaleFactor: 2 });
  await pag.setContent(`<div id="e" style="font-family:Arial;width:440px;margin:20px;padding:14px;border:3px solid #000;background:#fff;color:#000">
    <div style="font-weight:900;font-size:22px;text-align:center;border-bottom:3px solid #000">INFORMACIÓN NUTRICIONAL</div>
    <div style="font-size:17px;margin:6px 0">Porción 30 g (1 taza)</div>
    <table style="width:100%;border-collapse:collapse;font-size:17px">
    <tr style="border-bottom:2px solid #000"><td>Cantidad por porción</td><td></td><td style="text-align:right">% VD (*)</td></tr>
    ${[["Valor energético", "120 kcal = 504 kJ", "6"], ["Carbohidratos", "21 g", "7"], ["Proteínas", "2,4 g", "3"], ["Grasas totales", "3,0 g", "5"], ["Grasas saturadas", "1,2 g", "5"], ["Grasas trans", "0 g", "-"], ["Fibra alimentaria", "1,5 g", "6"], ["Sodio", "95 mg", "4"]]
      .map(([a, v, d]) => `<tr style="border-bottom:1px solid #000"><td style="padding:4px 0">${a}</td><td>${v}</td><td style="text-align:right">${d}</td></tr>`).join("")}
    </table></div>`);
  await pag.locator("#e").screenshot({ path: "archivos/etiqueta.png" });
  await pag.close();
}

async function abrir(reconocer) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/\/api\/alimentos\?codigo=/, (r) => r.fulfill({ json: { alimento: null } }));
  await ctx.route(/\/api\/reconocer/, (r) => r.fulfill(reconocer));
  await ctx.addInitScript(() => localStorage.setItem("comidas-bienvenida", "vista"));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  await p.locator(".boton-subir").click();
  await p.getByRole("heading", { name: "Subir comida" }).waitFor();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Escanear código" }).click();
  await p.waitForTimeout(800);
  return { ctx, p };
}

// 1) Sin Gemini: código que no está → foto de la tabla → lector del celu.
let { ctx, p } = await abrir({ status: 503, json: { error: "no" } });
await p.getByLabel("Número de código de barras").fill("7790000000017");
await p.getByRole("button", { name: "Buscar" }).click();
const faltante = p.locator(".etiqueta-accion");
await faltante.waitFor();
assert.match(await faltante.innerText(), /7790000000017 no está en la base/);
await p.screenshot({ path: "capturas/etiqueta-falta.png" });
await faltante.locator("input").setInputFiles("archivos/etiqueta.png");
await p.locator(".leyendo-etiqueta").waitFor();
await p.locator(".form-etiqueta").waitFor({ timeout: 120000 });
const valor = (n) => p.getByLabel(n, { exact: true }).inputValue();
console.log("leído:", await valor("Calorías"), await valor("Proteínas (g)"), await valor("Carbos (g)"), await valor("Grasas (g)"), "porción", await p.locator(".porcion-etiqueta input").inputValue());
assert.equal(await valor("Calorías"), "120");
assert.equal(await valor("Carbos (g)"), "21");
assert.equal(await valor("Proteínas (g)"), "2.4");
assert.equal(await valor("Grasas (g)"), "3");
assert.equal(await p.locator(".porcion-etiqueta input").inputValue(), "30");
assert.equal(await p.getByRole("radio", { name: "Por porción" }).getAttribute("aria-checked"), "true");
await p.getByLabel("Nombre del producto").fill("Copos de maíz");
await p.getByLabel("Marca").fill("Marca X");
await p.screenshot({ path: "capturas/etiqueta-form.png" });
await p.getByRole("button", { name: "Agregar", exact: true }).click();
await p.waitForTimeout(500);
const fila = p.locator(".fila-item").first();
assert.match(await fila.innerText(), /Copos de maíz\s*120 kcal/);
assert.equal(await p.getByLabel("Medida de Copos de maíz").inputValue(), "porción");
// Queda guardado con su código: la próxima vez lo encuentra solo.
await p.getByRole("button", { name: "Escanear código" }).click();
await p.waitForTimeout(500);
await p.getByLabel("Número de código de barras").fill("7790000000017");
await p.getByRole("button", { name: "Buscar" }).click();
await p.waitForTimeout(600);
assert.equal(await p.locator(".fila-item").count(), 2, "segunda vez: directo, sin pedir la foto");
await p.screenshot({ path: "capturas/etiqueta-agregado.png" });
await ctx.close();

// 2) Con Gemini: tabla de dos columnas leída por la IA; se pasa a cada 100 g.
({ ctx, p } = await abrir({ json: { esEtiqueta: true, nombre: "Galletitas de agua", marca: "Criollitas", base: "100g", porcionG: 25, valores: { kcal: 420, p: 10, c: 70, g: 11 } } }));
await p.getByLabel("Número de código de barras").fill("7790000000024");
await p.getByRole("button", { name: "Buscar" }).click();
await p.locator(".etiqueta-accion input").setInputFiles("archivos/etiqueta.png");
await p.locator(".form-etiqueta").waitFor();
assert.equal(await p.getByLabel("Nombre del producto").inputValue(), "Galletitas de agua");
assert.equal(await p.getByRole("radio", { name: "Cada 100 g" }).getAttribute("aria-checked"), "true");
// Números imposibles: avisa.
await p.getByLabel("Calorías", { exact: true }).fill("4200");
await p.getByRole("button", { name: "Agregar", exact: true }).click();
assert.match(await p.locator(".form-etiqueta .error").innerText(), /no cierran/);
await p.getByLabel("Calorías", { exact: true }).fill("420");
await p.getByRole("button", { name: "Agregar", exact: true }).click();
await p.waitForTimeout(400);
assert.match(await p.locator(".fila-item").first().innerText(), /Galletitas de agua\s*105 kcal/, "1 porción de 25 g = 105 kcal");
await ctx.close();

// 3) Sin código: desde el enlace, foto que no se puede leer → carga a mano con la foto de respaldo.
({ ctx, p } = await abrir({ json: { esEtiqueta: false, base: "porcion", porcionG: null, valores: { kcal: 0, p: 0, c: 0, g: 0 } } }));
await p.getByLabel("Foto de la tabla nutricional").setInputFiles("archivos/foto-original.jpg");
await p.locator(".form-etiqueta").waitFor({ timeout: 120000 });
assert.match(await p.locator(".form-etiqueta .nota").innerText(), /No pudimos leer la tabla/);
await p.getByRole("radio", { name: "Por porción" }).click();
await p.getByLabel("Nombre del producto").fill("Barrita");
await p.getByLabel("Calorías", { exact: true }).fill("90");
await p.getByRole("button", { name: "Agregar", exact: true }).click();
assert.match(await p.locator(".form-etiqueta .error").innerText(), /cuántos gramos es la porción/);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("etiqueta: pruebas pasadas");
