// Comidas de MyFitnessPal que completan las de Lomada, Apple Salud fuera del desglose y el viaje a Floripa.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\/notificar/, (r) => r.fulfill({ json: { enviadas: 1 } }));
await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199/");
await p.waitForTimeout(800);

// Hoy: una merienda publicada solo con foto y el resumen de Apple Salud.
const hoy = await p.evaluate(() => {
  const d = new Date();
  const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ahora = new Date().toISOString();
  window.__db.comidas.unshift(
    { id: "mer1", usuario_id: "u1", tipo: "merienda", fecha: f, foto_path: "f1", descripcion: "Merienda", calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, macros_editados: false, alimentos: [{ nombre: "Foto", fuente: "foto", kcal: 0, p: 0, c: 0, g: 0 }], creado_en: ahora },
    { id: "ah1", usuario_id: "u1", tipo: "resumen", fecha: f, foto_path: null, descripcion: "Resumen de Apple Salud", calorias: 1900, proteinas: 120, carbohidratos: 200, grasas: 60, macros_editados: false, alimentos: [{ nombre: "Apple Salud", fuente: "importado", kcal: 1900, p: 120, c: 200, g: 60 }], creado_en: ahora },
  );
  window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: {} });
  return f;
});
await p.waitForTimeout(5000);

// Apple Salud no aparece como una comida más, pero cuenta en el total (gana el mayor: 1.900 > 1.200 cargadas).
assert.equal(await p.locator(".resumen-importado").count(), 0, "sin tarjeta de Apple Salud");
assert.ok((await p.locator(".heroe-numero").innerText()).includes("1.900"), "cuenta en el total");
const yo = p.locator(".tarjeta-amigo", { hasText: "(vos)" });
await yo.locator(".amigo-cabecera").click();
await p.waitForTimeout(400);
const desglose = await yo.locator(".amigo-detalle-interno li").allInnerTexts();
assert.ok(!desglose.some((t) => /Apple/.test(t)), desglose.join(" | "));
assert.ok((await yo.locator(".amigo-datos").innerText()).includes("3 comidas"), "cuenta solo las comidas");

// Importar el día de MyFitnessPal: completa lo que ya está.
await p.getByRole("button", { name: /Importar el día/ }).click();
const hoja = p.getByRole("dialog").last();
await hoja.getByLabel("Texto del resumen").fill([
  "Almuerzo 820 cal", "Pechuga de pollo 350", "200 g", "Arroz blanco 470", "1 taza",
  "Aperitivos 210 cal", "Yogur 210", "1 pote",
  "Cena 600 cal", "Fideos 600", "1 plato",
].join("\n"));
await hoja.getByRole("button", { name: "Leer texto" }).click();
await hoja.locator(".fila-importada").first().waitFor();
const destinos = await hoja.locator(".fila-importada").evaluateAll((els) => els.map((e) => [e.querySelector("select").value, e.querySelector(".destino-importado")?.textContent || ""]));
console.log(destinos);
assert.deepEqual(destinos, [
  ["almuerzo", "Completa tu almuerzo publicado con foto"],
  ["colacion", "Completa tu merienda publicada con foto"],
  ["cena", ""],
]);
await p.screenshot({ path: "capturas/vi-revisar.png" });
const antes = await p.evaluate(() => window.__llamadas.length);
await hoja.getByRole("button", { name: "Guardar" }).click();
await hoja.getByText("¿Subís las fotos?").waitFor();
const escrituras = await p.evaluate((n) => window.__llamadas.slice(n).filter((l) => l.tabla === "comidas" && ["insert", "update"].includes(l.op)).map((l) => [l.op, l.fila.tipo, l.fila.descripcion, l.fila.calorias]), antes);
console.log(escrituras);
assert.deepEqual(escrituras.map((e) => e[0]), ["update", "update", "insert"], "almuerzo y merienda se completan, la cena es nueva");
assert.equal(escrituras[0][2], "Milanesa con puré", "conserva el nombre que le puso");
assert.equal(escrituras[1][1], "merienda", "los snacks completan la merienda con foto");
assert.equal(escrituras[2][2], "Fideos");
// Solo pide la foto de lo que no tiene.
const ranuras = await hoja.locator(".ranura-foto-nombre").allInnerTexts();
assert.deepEqual(ranuras.map((t) => t.trim()), ["Cena"], ranuras.join(" | "));
await p.screenshot({ path: "capturas/vi-fotos.png" });
await hoja.getByRole("button", { name: "Ahora no" }).click();
await p.waitForTimeout(600);

// Viaje a Floripa en Progreso.
await p.getByRole("tab", { name: "Progreso" }).click();
const viaje = p.locator(".viaje");
await viaje.waitFor();
const dias = Math.round((new Date("2026-12-26T12:00:00") - new Date(`${hoy}T12:00:00`)) / 86400000);
const textoViaje = await viaje.innerText();
console.log(textoViaje.replace(/\n+/g, " | "));
assert.ok(textoViaje.includes(`${dias}`) && /Floripa/.test(textoViaje) && /cuadraditos/.test(textoViaje));
await p.waitForTimeout(1300);
await viaje.screenshot({ path: "capturas/vi-viaje.png" });

assert.deepEqual(errores, []);
await b.close();
console.log("viaje, importar a cada comida y Apple Salud: pruebas pasadas");
