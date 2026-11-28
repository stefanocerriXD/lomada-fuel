// Guardar cualquier comida en favoritas (la propia o la de otro) y editar la propia desde las historias.
// Importar el día se mudó del Resumen al +, en Más opciones.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(flags = {}, ruta = "/") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true, enviadas: 0, resultados: [] } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("lomada-guia-historias-estrellas", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(`http://localhost:5199${ruta}`);
  await p.waitForTimeout(1500);
  return { ctx, p };
}
const favoritas = (p) => p.evaluate(() => window.__db.favoritas.filter((f) => f.usuario_id === "u1").map((f) => f.nombre));

// 1) En Imágenes: la comida de otro también se guarda (y se saca).
let { ctx, p } = await abrir({}, "/?vista=chat");
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(700);
const pizza = p.locator(".fotos-lista .comida", { hasText: "Pizza de muzzarella" }).first();
await pizza.getByRole("button", { name: "Guardar en favoritas" }).click();
await p.locator(".aviso", { hasText: "Guardada en favoritas" }).waitFor();
assert.ok((await favoritas(p)).includes("Pizza de muzzarella"), "guardada la de Nahuel");
const guardada = await p.evaluate(() => window.__db.favoritas.find((f) => f.nombre === "Pizza de muzzarella"));
assert.deepEqual(guardada.alimentos.map((a) => a.nombre), ["Pizza de muzzarella", "Cerveza"], "con sus alimentos");
await pizza.getByRole("button", { name: "Sacar de favoritas" }).click();
await p.locator(".aviso", { hasText: "Sacada de favoritas" }).waitFor();
assert.ok(!(await favoritas(p)).includes("Pizza de muzzarella"));
await ctx.close();

// 2) En las historias: la de otro se guarda; la propia, además, se edita.
({ ctx, p } = await abrir({ __segundosHistoria: 600 }));
await p.locator(".hdias").getByRole("button", { name: /^Almuerzo/ }).click();
const visor = p.locator(".hdia-visor");
await visor.waitFor();
await p.waitForTimeout(600);
// Primero Juan (12 h): sin Editar, con favorita y responder.
assert.equal(await visor.getByRole("button", { name: "Editar" }).count(), 0, "la de otro no se edita");
await visor.getByRole("button", { name: "Guardar en favoritas" }).click();
await visor.locator(".hdia-aviso", { hasText: "Guardada en favoritas" }).waitFor();
assert.ok((await favoritas(p)).includes("Ensalada con pollo"));
assert.equal(await visor.getByRole("button", { name: "Sacar de favoritas" }).getAttribute("aria-pressed"), "true");
await p.screenshot({ path: "capturas/historia-favorita.png" });
// Después la propia (Steve, 13 h): Editar abre la comida en el +.
for (let n = 0; n < 3 && (await visor.locator(".hdia-autor > span > strong").innerText()) !== "Vos"; n += 1) {
  const caja = await visor.locator(".hdia-tipo").last().boundingBox();
  await p.mouse.click(caja.x + caja.width * 0.8, caja.y + caja.height * 0.45);
  await p.waitForTimeout(400);
  await p.waitForFunction(() => document.querySelectorAll(".hdia-tipo").length === 1);
}
await visor.getByRole("button", { name: "Editar" }).waitFor();
await p.screenshot({ path: "capturas/historia-editar.png" });
await visor.getByRole("button", { name: "Editar" }).click();
await visor.waitFor({ state: "detached" });
const hoja = p.getByRole("dialog").filter({ has: p.getByLabel("Nota de la comida") });
await hoja.waitFor();
assert.equal(await hoja.getByLabel("Nota de la comida").inputValue(), "Milanesa con puré", "abre la comida propia para editar");
await ctx.close();

// 3) Importar el día: ya no está en el Resumen, sino en el +, en Más opciones.
({ ctx, p } = await abrir());
assert.equal(await p.getByText("Importar el día", { exact: true }).count(), 0, "no está en el resumen");
await p.locator("[aria-label='Subir comida']").last().click();
await p.waitForTimeout(700);
await p.getByText("Más opciones").click();
await p.getByRole("button", { name: "Importar el día entero" }).click();
await p.waitForTimeout(700);
assert.ok(await p.getByText(/Importar/).count(), "abre el importador del día");
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("favoritas, editar desde historias e importar el día: pasaron");
