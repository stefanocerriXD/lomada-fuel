// Guardar una comida como receta, ver las del grupo, compartirlas por el chat y guardarlas como propias.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\/notificar/, (r) => r.fulfill({ json: { enviadas: 1 } }));
await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto("http://localhost:5199/");
await p.waitForTimeout(5000);
// Una receta de Nahuel, compartida con el grupo.
await p.evaluate(() => {
  window.__db.recetas_propias.push({
    id: "r-nahuel", usuario_id: "u2", nombre: "Tarta de atún", porciones: 6, peso_final: null, compartida: true,
    ingredientes: [{ nombre: "Atún al natural", gramos: 340, por100: { kcal: 116, p: 26, c: 0, g: 1 } }, { nombre: "Tapa de tarta", gramos: 400, por100: { kcal: 300, p: 7, c: 45, g: 10 } }],
    creado_en: new Date().toISOString(),
  });
  window.__canalDatos().emitir("medallas", { eventType: "INSERT", new: {} });
});
await p.waitForTimeout(800);

// 1. Cargar una comida y guardarla como receta (budín en 8 porciones).
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.getByLabel(/Buscar alimento|Buscá/).first().fill("banana");
await p.locator(".resultados button").first().click();
await p.waitForTimeout(300);
const guardar = p.getByRole("button", { name: "Guardar como receta" });
await guardar.waitFor();
await guardar.click();
const editor = p.getByRole("dialog", { name: "Nueva receta" });
await editor.waitFor();
assert.ok(await editor.getByText("Si es algo que dividís").count(), "explica las porciones");
assert.equal(await editor.locator(".fila-item, .item").count() >= 0, true);
await editor.getByLabel("Nombre de la receta").fill("Budín de banana");
await editor.getByRole("button", { name: "8", exact: true }).click();
assert.ok(await editor.getByLabel("Que la vea el grupo").isChecked(), "por defecto la ve el grupo");
await p.screenshot({ path: "capturas/rc-editor.png" });
await editor.getByRole("button", { name: "Guardar receta" }).click();
await editor.waitFor({ state: "detached" });
const budin = await p.evaluate(() => window.__db.recetas_propias.find((r) => r.nombre === "Budín de banana"));
assert.ok(budin && budin.porciones === 8 && budin.compartida === true && budin.ingredientes.length === 1, JSON.stringify(budin));
assert.ok(await p.getByRole("dialog").count() >= 1, "la carga sigue abierta");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// 2. Las recetas del grupo aparecen al buscar al cargar una comida.
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.getByLabel(/Buscar alimento|Buscá/).first().fill("tarta");
await p.getByText("Receta de Nahuel").first().waitFor();
await p.keyboard.press("Escape");
await p.waitForTimeout(500);

// 3. En Ajustes > Mis recetas: las propias y las del grupo. Guardar la de Nahuel como propia.
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.locator(".menu-ajustes button", { hasText: "Mis recetas" }).click();
await p.getByText("Recetas del grupo").waitFor();
await p.locator(".lista-recetas button", { hasText: "Tarta de atún" }).click();
const ver = p.getByRole("dialog", { name: "Receta" });
await ver.waitFor();
assert.ok((await ver.innerText()).includes("Receta de Nahuel"));
assert.equal(await ver.locator(".ingredientes-receta li").count(), 2);
await p.waitForTimeout(600);
await p.screenshot({ path: "capturas/rc-ver.png" });
await ver.getByRole("button", { name: "Guardar en mis recetas" }).click();
await ver.waitFor({ state: "detached" });
const copia = await p.evaluate(() => window.__db.recetas_propias.find((r) => r.nombre === "Tarta de atún" && r.usuario_id === "u1"));
assert.ok(copia && copia.porciones === 6, "copiada a las propias");

// 4. Compartir el budín en el chat.
await p.locator(".lista-recetas button", { hasText: "Budín de banana" }).click();
const ed = p.getByRole("dialog", { name: "Editar receta" });
await ed.waitFor();
const antes = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").length);
await ed.getByRole("button", { name: "Compartir en el chat" }).click();
await ed.waitFor({ state: "detached" });
// No se manda sola: lleva al chat con el mensaje escrito.
const campoChat = p.getByLabel("Mensaje", { exact: true });
await campoChat.waitFor();
await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").length), antes, "todavía no se mandó");
assert.equal(await campoChat.inputValue(), "Les paso mi receta: Budín de banana 🍽️");
assert.match(await p.locator(".chat-receta").innerText(), /Budín de banana/);
await p.screenshot({ path: "capturas/rc-borrador.png" });
await campoChat.fill("Les paso mi receta: Budín de banana, sale buenísimo");
await p.getByRole("button", { name: "Enviar" }).click();
await p.waitForTimeout(500);
const msj = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").pop().fila);
assert.equal(msj.receta_id, budin.id);
assert.equal(msj.texto, "Les paso mi receta: Budín de banana, sale buenísimo");
const difundido = await p.evaluate(() => (window.__enviados || []).filter((m) => m.event === "mensaje").pop()?.payload);
assert.equal(difundido?.receta_id, budin.id, "llega al instante a los demás");
assert.equal(await p.locator(".chat-receta").count(), 0);

// 5. En el chat se ve el texto y la tarjeta, y se abre.
assert.match(await p.locator(".chat-fila", { hasText: "sale buenísimo" }).innerText(), /sale buenísimo[\s\S]*Budín de banana/);
const tarjeta = p.locator(".receta-chat", { hasText: "Budín de banana" });
await tarjeta.waitFor();
await p.waitForTimeout(400);
await p.screenshot({ path: "capturas/rc-chat.png" });
await tarjeta.click();
await p.getByRole("dialog", { name: "Receta" }).waitFor();
assert.ok((await p.getByRole("dialog", { name: "Receta" }).innerText()).includes("Tu receta"));

// Una receta de otro que llega por el chat y todavía no estaba cargada se busca.
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
await p.evaluate(() => {
  window.__db.recetas_propias.push({ id: "r-juan", usuario_id: "u3", nombre: "Bowl de pollo", porciones: 1, compartida: true, ingredientes: [{ nombre: "Pollo", gramos: 200, por100: { kcal: 165, p: 31, c: 0, g: 3.6 } }] });
  window.__canalChat().difundir("mensaje", { id: "rm2", usuario_id: "u3", texto: "Compartió una receta: Bowl de pollo", receta_id: "r-juan", creado_en: new Date().toISOString() });
});
await p.locator(".receta-chat", { hasText: "Bowl de pollo" }).waitFor({ timeout: 2000 });

assert.deepEqual(errores, []);
await b.close();
console.log("recetas compartidas: pruebas pasadas");
