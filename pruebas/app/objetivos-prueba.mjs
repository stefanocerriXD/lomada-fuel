// Objetivos traídos de MyFitnessPal y la sugerencia para la próxima comida.
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
await p.waitForTimeout(5000);

// Las recomendaciones aparecen solo al tocar "¿Qué puedo comer?".
assert.equal(await p.locator(".sugerencia").count(), 0, "sin tarjeta duplicada");
assert.equal(await p.getByText("¿Qué como?").count(), 0);
await p.getByRole("button", { name: /¿Qué puedo comer\?/ }).click();
const opciones = p.getByRole("dialog", { name: "¿Qué puedo comer?" });
await opciones.waitFor();
const objetivo = await opciones.locator(".objetivo-comida").innerText();
console.log(objetivo);
assert.ok(/\d+ g de proteína/.test(objetivo), "según lo que falta");
assert.ok((await opciones.locator(".tarjeta.receta").count()) >= 1);
await p.screenshot({ path: "capturas/que-puedo-comer.png" });
await p.keyboard.press("Escape");
await opciones.waitFor({ state: "detached" }).catch(() => {});
await p.waitForTimeout(500);

// Objetivos de MyFitnessPal
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.getByRole("button", { name: /Tu perfil Foto, nombre/ }).click();
await p.getByRole("button", { name: "Traer objetivos de MyFitnessPal" }).click();
const hoja = p.getByRole("dialog", { name: "Objetivos de MyFitnessPal" });
await hoja.waitFor();
await hoja.getByLabel("Texto del resumen").fill("Objetivos de calorías y macronutrientes\nCalorías\n2.300\nCarbohidratos 40%\nProteínas 35%\nGrasas 25%");
await hoja.getByRole("button", { name: "Leer texto" }).click();
await hoja.locator(".objetivo-kcal").waitFor();
await p.screenshot({ path: "capturas/objetivos-mfp.png" });
assert.equal((await hoja.locator(".objetivo-kcal strong").innerText()).trim(), "2.300");
assert.deepEqual(await hoja.locator(".objetivo-macros strong").allInnerTexts(), ["201 g", "230 g", "64 g"]);
await hoja.getByRole("button", { name: "Usar estos objetivos" }).click();
await hoja.waitFor({ state: "detached" });
const llamadas = await p.evaluate(() => window.__llamadas.filter((l) => l.op === "update" && ["perfiles", "perfiles_salud"].includes(l.tabla)).map((l) => [l.tabla, l.fila]));
assert.ok(llamadas.some(([t, f]) => t === "perfiles" && f.meta_calorias === 2300), JSON.stringify(llamadas));
assert.ok(llamadas.some(([t, f]) => t === "perfiles_salud" && f.proteinas_propias === 201 && f.carbos_propios === 230 && f.grasas_propias === 64), JSON.stringify(llamadas));
assert.equal(await p.getByRole("button", { name: "Guardar cambios" }).count(), 0, "el formulario queda al día");

// Una captura con porcentajes que no suman 100 avisa
await p.getByRole("button", { name: "Traer objetivos de MyFitnessPal" }).click();
await hoja.getByLabel("Texto del resumen").fill("Calorías 2000\nCarbohidratos 50%\nProteínas 30%\nGrasas 30%");
await hoja.getByRole("button", { name: "Leer texto" }).click();
await hoja.getByText("Los porcentajes suman 110%").waitFor();

assert.deepEqual(errores, []);
await b.close();
console.log("objetivos de MyFitnessPal y sugerencia: pruebas pasadas");
