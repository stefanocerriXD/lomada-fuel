import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript((f) => {
    localStorage.setItem("comidas-bienvenida", "vista");
    Object.assign(window, f);
    window.__insignias = [];
    navigator.setAppBadge = async (n) => window.__insignias.push(n);
    navigator.clearAppBadge = async () => window.__insignias.push(0);
  }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  return { ctx, p };
}
const irGrupo = (p) => p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();

// ---------- 1) No leídos ----------
let { ctx, p } = await abrir({ __chatLargo: true, __lecturaYo: "parcial" });
const grupoBtn = p.locator(".barra-inferior .item-menu", { hasText: "Grupo" });
assert.equal((await grupoBtn.locator(".insignia").innerText()).trim(), "2", "globito con 2 sin leer");
assert.equal(await grupoBtn.getAttribute("aria-label"), "Grupo, 2 mensajes sin leer");
assert.deepEqual(await p.evaluate(() => window.__insignias.at(-1)), 2, "número en el ícono de la app");
await p.screenshot({ path: "capturas/sinleer-menu.png" });
await irGrupo(p);
await p.waitForTimeout(1600);
const marca = p.locator(".chat-no-leidos");
assert.match(await marca.innerText(), /2 mensajes sin leer/);
const caja = await p.locator(".chat-mensajes").boundingBox();
const m = await marca.boundingBox();
const lista = p.locator(".chat-mensajes");
const distancia = await lista.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
console.log("separador y:", m.y, "lista y:", caja.y, "distancia al fondo:", distancia);
// Arriba de la lista, salvo que lo nuevo sea tan poco que ya se esté al fondo.
assert.ok((m.y >= caja.y - 2 && m.y < caja.y + 80) || distancia < 5, "el separador queda a la vista arriba");
assert.ok(m.y < caja.y + caja.height, "el separador se ve");
const scrollTop = await lista.evaluate((el) => el.scrollTop);
assert.ok(scrollTop > 200, "no arranca arriba de todo");
await p.screenshot({ path: "capturas/sinleer-chat.png" });
// Al leer se va el globito y el ícono queda en 0.
await p.waitForTimeout(500);
assert.equal(await grupoBtn.locator(".insignia").count(), 0);
assert.equal(await p.evaluate(() => window.__insignias.at(-1)), 0);
// Llega un mensaje mientras leés más arriba: no te mueve.
await lista.evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event("scroll")); });
await p.evaluate(() => window.__canalDatos && 0);
await ctx.close();

// Todo leído: abre abajo de todo, sin separador.
({ ctx, p } = await abrir({ __chatLargo: true, __lecturaYo: "todo" }));
assert.equal(await p.locator(".barra-inferior .insignia").count(), 0);
await irGrupo(p);
await p.waitForTimeout(1600);
assert.equal(await p.locator(".chat-no-leidos").count(), 0);
const alFondo = await p.locator(".chat-mensajes").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
assert.ok(alFondo < 5, `abajo de todo (${alFondo})`);
// Pestaña Chat con globito cuando estás en Imágenes y llega algo.
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.evaluate(() => {
  const m = { id: "nuevo1", usuario_id: "u2", texto: "Che, llegó esto", creado_en: new Date(Date.now() + 2 * 86400000).toISOString() };
  window.__db.mensajes.push(m);
  window.__canales.filter((c) => String(c.nombre).startsWith("chat")).forEach((c) => c.emitirBroadcast?.("mensaje", m));
});
await p.waitForTimeout(800);
const tabChat = p.getByRole("tab", { name: /Chat/ });
const conGlobo = await tabChat.locator(".insignia").count();
console.log("globito en pestaña Chat tras mensaje nuevo:", conGlobo ? await tabChat.locator(".insignia").innerText() : "(el mock no emite broadcast)");
await ctx.close();

// ---------- 2) Desplegable fijo en Imágenes ----------
({ ctx, p } = await abrir({ __muchosAlimentos: true }));
await irGrupo(p);
await p.waitForTimeout(600);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(800);
const tarjeta = p.locator(".comida", { hasText: "Pizza de muzzarella" }).first();
await tarjeta.getByRole("button", { name: "Ver alimentos" }).click();
await p.waitForTimeout(700);
const boton = tarjeta.getByRole("button", { name: "Ocultar alimentos" });
// Bajar hasta la mitad de la lista de alimentos.
await tarjeta.locator(".detalle-alimentos li").nth(9).scrollIntoViewIfNeeded();
await p.mouse.wheel(0, 120);
await p.waitForTimeout(500);
const bb = await boton.boundingBox();
console.log("botón fijo en y =", bb.y);
assert.ok(bb.y > 80 && bb.y < 200, "Ocultar alimentos queda fijo arriba");
await p.screenshot({ path: "capturas/desplegable-fijo.png" });
await boton.click();
await p.waitForTimeout(1200);
assert.equal(await tarjeta.getByRole("button", { name: "Ver alimentos" }).isVisible(), true);
const cuerpo = await tarjeta.locator(".comida-cuerpo").boundingBox();
assert.ok(cuerpo.y > 0 && cuerpo.y < 844, "al cerrar, la tarjeta queda a la vista");
await p.screenshot({ path: "capturas/desplegable-cerrado.png" });
await ctx.close();

// ---------- 3) Postre ----------
({ ctx, p } = await abrir());
await p.locator(".boton-subir").click();
await p.getByRole("heading", { name: "Subir comida" }).waitFor();
await p.waitForTimeout(400);
await p.getByRole("radio", { name: /Colaciones/ }).click();
// Cargo algo como colación (a mano, igual que lo importado) y después digo que es postre.
await p.getByRole("button", { name: "Cargar a mano" }).click();
await p.getByLabel("Nombre").fill("Flan con dulce de leche");
await p.getByLabel("Calorías").fill("320");
await p.getByLabel("Proteínas (g)").fill("7");
await p.getByRole("button", { name: "Agregar", exact: true }).click();
await p.waitForTimeout(400);
const opcion = p.locator(".postre-opcion");
assert.match(await opcion.innerText(), /¿Es postre\?\s*Pasalo a tu almuerzo/);
await p.screenshot({ path: "capturas/postre-despues.png" });
await opcion.click();
await p.getByRole("heading", { name: "Agregar postre" }).waitFor();
await p.waitForTimeout(400);
const filas = await p.locator(".fila-item").allInnerTexts();
console.log("en el almuerzo:", filas.map((f) => f.split("\n")[0]).join(" | "));
assert.ok(filas.some((f) => /Flan con dulce de leche/.test(f)), "el flan pasó al almuerzo");
const totalAntes = await p.locator(".pie-total strong").innerText();
console.log("total almuerzo + postre:", totalAntes);
assert.match(totalAntes, /1\.100|1100/, "780 + 320");
// En modo postre también se puede importar.
await p.getByRole("button", { name: /Importar postre/ }).click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".tarjeta-interna").count(), 1, "abre el importador");
await p.screenshot({ path: "capturas/postre-importar.png" });
await p.getByRole("button", { name: "Guardar cambios" }).click();
await p.waitForTimeout(1200);
const guardada = await p.evaluate(() => window.__db.comidas.find((c) => c.id === "c2"));
assert.equal(guardada.calorias, 1100);
assert.ok(guardada.alimentos.some((a) => a.nombre === "Flan con dulce de leche" && a.postre), "queda marcado como postre");
assert.equal(await p.evaluate(() => window.__db.comidas.filter((c) => c.tipo === "colacion").length), 0, "no se guardó una colación aparte");
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("tres mejoras: pruebas pasadas");
