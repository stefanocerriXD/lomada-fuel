import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);

// 1. Publicar una cena con dos amigos
await p.getByRole("button", { name: "Agregar cena" }).click();
await p.waitForTimeout(500);
await p.locator(".historial button", { hasText: "Papines" }).click();
await p.waitForTimeout(400);
await p.getByText("Comida grupal").scrollIntoViewIfNeeded();
await p.getByText("Comida grupal").click();
await p.waitForTimeout(300);
const chips = p.locator(".persona-chip");
console.log("integrantes:", await chips.allInnerTexts());
await p.waitForTimeout(400);
await chips.nth(0).click();
await p.waitForTimeout(200);
await chips.nth(1).click();
await p.waitForTimeout(200);
await p.screenshot({ path: "capturas/grupal-debug.png" });
console.log(await chips.evaluateAll((l) => l.map((x) => x.getAttribute("aria-pressed"))));
assert.equal(await p.locator(".persona-chip[aria-pressed='true']").count(), 2);
await p.getByLabel("Nota de la comida").fill("Pizza en lo de Nahuel");
await p.screenshot({ path: "capturas/grupal-elegir.png" });
await p.getByRole("button", { name: "Publicar" }).click();
await p.waitForTimeout(400);
const igual = p.getByRole("button", { name: "Publicar igual" });
if (await igual.count()) await igual.click();
await p.waitForTimeout(900);
await p.screenshot({ path: "capturas/grupal-debug.png" });
console.log("rpc:", await p.evaluate(() => window.__rpc), "comidas:", await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "comidas" && l.op !== "select").length));
const invs = await p.evaluate(() => window.__db.invitaciones_comida);
assert.equal(invs.length, 2, "salen dos solicitudes");
assert.ok(avisos.some((a) => a.tipo === "invitacion"), "avisa a los invitados");
const idCena = invs[0].comida_id;

// La tarjeta muestra a quién espera
await p.getByRole("button", { name: "Perfil" }).count();
await p.evaluate(() => window.__canalDatos().emitir("invitaciones_comida", { eventType: "INSERT" }));
await p.waitForTimeout(600);

// 2. Me llega una solicitud de otro
await p.evaluate(() => {
  const hoy = new Date().toLocaleDateString("en-CA");
  window.__db.comidas.unshift({ id: "gx", usuario_id: "u2", tipo: "almuerzo", fecha: hoy, foto_path: "f5", descripcion: "Asado del domingo", calorias: 950, proteinas: 70, carbohidratos: 10, grasas: 68, alimentos: [{ nombre: "Vacío", kcal: 950 }], privada: false, grupo_comida: "gx", creado_en: new Date().toISOString(), macros_editados: false });
  window.__db.invitaciones_comida.push({ id: "ig1", comida_id: "gx", de_usuario: "u2", para_usuario: "u1", estado: "pendiente", creado_en: new Date().toISOString() });
  window.__canalDatos().emitir("invitaciones_comida", { eventType: "INSERT" });
});
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.locator(".invitacion-comida").waitFor({ timeout: 5000 });
const texto = await p.locator(".invitacion-comida").innerText();
console.log("solicitud:", texto.replace(/\n/g, " | "));
assert.ok(texto.includes("te sumó a su almuerzo grupal") && texto.includes("Asado del domingo"));
await p.waitForTimeout(700);
await p.screenshot({ path: "capturas/grupal-solicitud.png" });
await p.getByRole("button", { name: "Aceptar" }).click();
await p.waitForTimeout(900);
assert.equal(await p.locator(".invitacion-comida").count(), 0, "desaparece al aceptar");
const mia = await p.evaluate(() => window.__db.comidas.find((c) => c.usuario_id === "u1" && c.grupo_comida === "gx"));
assert.ok(mia && mia.calorias === 950, "se sumó a mi día");
assert.ok(avisos.some((a) => a.tipo === "invitacion" && a.id === "ig1"), "avisa a quien invitó");

// 3. En Imágenes aparece una sola vez, con los que comieron
await p.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click();
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(700);
const asados = p.locator(".fotos-lista .comida", { hasText: "Asado del domingo" });
assert.equal(await asados.count(), 1, "una sola tarjeta por comida grupal");
const linea = await asados.locator(".comida-grupal-linea").innerText();
console.log("línea grupal:", linea);
assert.ok(linea.includes("vos"));
await asados.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/grupal-imagenes.png" });

// 4. Rechazar
await p.evaluate(() => {
  window.__db.invitaciones_comida.push({ id: "ig2", comida_id: "gx", de_usuario: "u3", para_usuario: "u1", estado: "pendiente", creado_en: new Date().toISOString() });
  window.__canalDatos().emitir("invitaciones_comida", { eventType: "INSERT" });
});
await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
await p.locator(".invitacion-comida").waitFor({ timeout: 5000 });
await p.getByRole("button", { name: "No comí" }).click();
await p.waitForTimeout(700);
assert.equal(await p.evaluate(() => window.__db.invitaciones_comida.find((i) => i.id === "ig2").estado), "rechazada");
await b.close();
assert.deepEqual(errores, []);
console.log("comidas grupales: pruebas pasadas");
