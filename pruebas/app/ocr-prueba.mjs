import fs from "node:fs";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

// Capturas de ejemplo con el aspecto típico de una app de calorías
const estilo = (fondo, tinta, tarjeta) => `<style>body{margin:0;background:${fondo};color:${tinta};font:16px -apple-system,Segoe UI,Arial}.t{background:${tarjeta};margin:12px;padding:14px;border-radius:14px}.f{display:flex;justify-content:space-between;padding:6px 0}h2{font-size:18px;margin:0 0 6px}.g{font-size:38px;font-weight:700}</style>`;
const dia = `<div class="t"><div>Hoy</div><div class="g">1.850 kcal</div><div>Objetivo 2.200 kcal</div></div><div class="t"><div class="f"><span>Proteínas</span><b>142 g</b></div><div class="f"><span>Carbohidratos</span><b>180 g</b></div><div class="f"><span>Grasas</span><b>62 g</b></div></div>`;
const comidas = `<div class="t"><h2>Breakfast</h2><div class="f"><span>420 kcal</span><span>P 20 C 50 F 15</span></div></div><div class="t"><h2>Lunch</h2><div class="f"><span>780 kcal</span><span>P 45 C 70 F 30</span></div></div><div class="t"><h2>Dinner</h2><div class="f"><span>600 kcal</span><span>P 40 C 40 F 25</span></div></div>`;
const ejemplos = [
  ["claro-dia", estilo("#f4f4f6", "#111", "#fff") + dia],
  ["oscuro-dia", estilo("#0e0f12", "#f3f3f3", "#1c1e24") + dia],
  ["claro-comidas", estilo("#f4f4f6", "#111", "#fff") + comidas],
  ["oscuro-comidas", estilo("#0e0f12", "#f3f3f3", "#1c1e24") + comidas],
];
const capturador = await b.newPage({ viewport: { width: 390, height: 520 }, deviceScaleFactor: 3 });
for (const [n, html] of ejemplos) {
  await capturador.setContent(`<!doctype html><meta charset="utf-8">${html}`);
  await capturador.screenshot({ path: `capturas/ej-${n}.png` });
}
await capturador.close();

const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: "light" });
// Los festejos de logros tapan los botones: en esta prueba no hacen falta.
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error") console.log("consola:", m.text().slice(0, 180)); });
p.on("requestfailed", (r) => console.log("falló:", r.url().slice(0, 110), r.failure()?.errorText));
await p.goto("http://localhost:5199", { timeout: 60000 });
await p.waitForTimeout(1000);
await p.screenshot({ path: "capturas/s-inicio.png" });

const filas = async () => p.locator(".fila-importada").evaluateAll((els) => els.map((e) => [e.querySelector("select").value, ...[...e.querySelectorAll("input")].map((i) => Number(i.value))].join(" ")));
for (const [n] of ejemplos) {
  await p.getByRole("button", { name: /Importar/ }).click();
  await p.waitForTimeout(400);
  const t0 = Date.now();
  await p.getByLabel("Subir captura o archivo").setInputFiles(`capturas/ej-${n}.png`);
  await p.locator(".fila-importada").first().waitFor({ timeout: 40000 }).catch(async () => {
    await p.screenshot({ path: "capturas/s-trabado.png" });
    console.log("TRABADO:", (await p.locator(".hoja-cuerpo").innerText()).replace(/\n+/g, " | ").slice(0, 200));
    throw new Error("trabado");
  });
  console.log(n.padEnd(15), `${((Date.now() - t0) / 1000).toFixed(1)} s`, JSON.stringify(await filas()));
  await p.screenshot({ path: `capturas/s-importar-${n}.png` });
  await p.getByRole("button", { name: "Cerrar", exact: true }).click();
  await p.waitForTimeout(500);
}

// Texto pegado y guardado
await p.getByRole("button", { name: /Importar/ }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: "capturas/s-importar.png" });
await p.getByLabel("Texto del resumen").fill("Calorías 1.850 kcal\nProteínas 142 g\nCarbohidratos 180 g\nGrasas 62 g");
await p.getByRole("button", { name: "Leer texto" }).click();
await p.waitForTimeout(400);
console.log("pegado:", JSON.stringify(await filas()));
await p.getByRole("button", { name: "Guardar", exact: true }).click();
await p.waitForTimeout(900);
// Después de importar ofrece sumar las fotos de cada comida (función nueva): se saltea.
if (await p.getByRole("button", { name: "Ahora no" }).count()) { await p.getByRole("button", { name: "Ahora no" }).click(); await p.waitForTimeout(500); }
const guardado = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "comidas" && l.op === "insert").pop()?.fila);
console.log("guardó:", JSON.stringify({ tipo: guardado?.tipo, kcal: guardado?.calorias, p: guardado?.proteinas, fecha: guardado?.fecha }));
console.log("anillo:", (await p.locator(".anillo-centro").innerText()).replace(/\n/g, " "), "| tarjeta:", (await p.locator(".resumen-importado").innerText()).replace(/\n/g, " "));
// El chat ahora está dentro de Grupo.
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
await p.getByRole("tab", { name: "Chat" }).click();
await p.waitForTimeout(500);
console.log("no aparece en el chat:", (await p.locator(".comida", { hasText: "Resumen importado" }).count()) === 0);

// Reimportar reemplaza
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Importar/ }).click();
await p.waitForTimeout(400);
await p.getByLabel("Texto del resumen").fill("Calorías 2.000\nProteínas 150 g");
await p.getByRole("button", { name: "Leer texto" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Guardar", exact: true }).click();
await p.waitForTimeout(900);
// Después de importar ofrece sumar las fotos de cada comida (función nueva): se saltea.
if (await p.getByRole("button", { name: "Ahora no" }).count()) { await p.getByRole("button", { name: "Ahora no" }).click(); await p.waitForTimeout(500); }
console.log("reimportado:", (await p.locator(".resumen-importado").count()), "tarjeta |", (await p.locator(".resumen-importado").innerText()).replace(/\n/g, " "));

// Carga simple
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.screenshot({ path: "capturas/s-subir.png" });
const buscador = p.getByLabel("Buscar alimento o producto");
await buscador.fill("kiwi");
await p.waitForTimeout(300);
await p.screenshot({ path: "capturas/s-buscar.png" });
console.log("resultado kiwi:", (await p.locator(".resultados li").first().innerText()).replace(/\n+/g, " | "));
await p.locator(".resultados li button").first().click();
await p.waitForTimeout(450);
console.log("teclado baja:", await buscador.evaluate((e) => document.activeElement !== e), "| vacío:", (await buscador.inputValue()) === "");
await p.getByLabel("Sumar", { exact: true }).click();
await p.waitForTimeout(800);
console.log("2 kiwis:", await p.locator(".pie-total strong").innerText(), "| medidas:", await p.getByLabel("Medida de Kiwi").locator("option").allInnerTexts());
await p.screenshot({ path: "capturas/s-items.png" });
await p.getByLabel("Medida de Kiwi").selectOption("g");
await p.waitForTimeout(700);
console.log("en gramos:", await p.getByLabel("Cantidad de Kiwi").inputValue(), "g |", await p.locator(".pie-total strong").innerText());
await buscador.fill("dulce");
await p.waitForTimeout(300);
await p.locator(".resultados li button", { hasText: "Dulce de leche" }).first().click();
await p.waitForTimeout(500);
console.log("cucharada:", await p.getByLabel("Medida de Dulce de leche").inputValue());
const pie = await p.locator(".pie-publicar").boundingBox();
console.log("publicar visible:", pie.y + pie.height <= 844);
await p.getByLabel("Cargar a mano").click();
await p.waitForTimeout(250);
await p.getByLabel("Calorías").fill("100");
await p.getByRole("button", { name: "Agregar", exact: true }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Publicar comida" }).click();
await p.waitForTimeout(600);
// Sin foto, la app pide confirmar.
if (await p.getByRole("button", { name: /Publicar igual/ }).count()) await p.getByRole("button", { name: /Publicar igual/ }).click();
await p.waitForTimeout(1000);
console.log("publicó:", JSON.stringify(await p.evaluate(() => { const f = window.__llamadas.filter((l) => l.tabla === "comidas" && l.op === "insert").pop()?.fila; return { desc: f?.descripcion, kcal: f?.calorias, medidas: f?.alimentos?.map((a) => `${a.cantidad} ${a.unidad?.nombre}`) }; })));

// Chat único
// El chat ahora está dentro de Grupo.
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
await p.getByRole("tab", { name: "Chat" }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: "capturas/s-chat.png" });
console.log("en el chat:", await p.locator(".chat-comida").count(), "comidas,", await p.locator(".burbuja").count(), "mensajes | sin Muro:", (await p.getByRole("button", { name: "Muro" }).count()) === 0);

// Apple Salud
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
// Ajustes es un menú: Apple Salud tiene su sección, y el botón ahora crea la llave.
await p.locator(".menu-ajustes button", { hasText: "Apple Salud" }).click();
await p.waitForTimeout(500);
const conectar = p.getByRole("button", { name: /Crear mi llave|Crear otra llave/ });
await conectar.scrollIntoViewIfNeeded();
await conectar.click();
await p.waitForTimeout(400);
// La dirección ya no se copia a mano (va dentro del Atajo): solo se muestra la llave.
const llave = await p.locator(".dato-copiable code").first().innerText();
console.log("llave visible:", llave.length);
if (!(llave.length > 10)) throw new Error("no se ve la llave");
await p.screenshot({ path: "capturas/s-salud.png" });
await b.close();
console.log("errores:", errores);
