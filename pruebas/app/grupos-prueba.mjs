// Grupo sin Bocha (tipo BeReal) y alguien que quedó sin grupo.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(modo, banderas = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/prueba\.local/, (r) => r.abort());
  await ctx.addInitScript(([modo, banderas]) => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("mock-grupo", modo); Object.assign(window, banderas); }, [modo, banderas]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  return { ctx, p };
}
const ir = (p, n) => p.getByRole("button", { name: n, exact: true }).locator("visible=true").first().click();

// ---------- Grupo sin Bocha, con la caca de ayer ----------
let { ctx, p } = await abrir("viejos");
await p.evaluate(() => {
  const f = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toLocaleDateString("en-CA"); };
  window.__db.comidas = window.__db.comidas.filter((c) => !(c.usuario_id === "u1" && c.fecha === f(0)));
  window.__db.multas = [{ usuario_id: "u1", fecha: f(1), fotos: 0 }];
  window.__canalDatos().emitir("multas", { eventType: "INSERT" });
  window.__canalDatos().emitir("comidas", { eventType: "DELETE", old: {} });
});
await p.waitForTimeout(3000);
assert.equal(await p.getByRole("dialog", { name: "La maldición del Bocha" }).count(), 0, "sin cartel del Bocha");
assert.equal(await p.locator(".mancha-caca, .bocha-asomado, .cartel-bocha").count(), 0, "sin caca en la pantalla");
assert.ok((await p.locator(".avatar-caca").count()) > 0, "💩 al lado del nombre");
assert.equal(await p.locator(".viaje").count(), 0);
await p.screenshot({ path: "capturas/gr-resumen.png" });

await ir(p, "Grupo");
await p.waitForTimeout(700);
// El chat se baja al abrirlo: se espera a que esté (con un tiempo fijo a veces no llegaba).
await p.getByLabel("Mandar foto o GIF").first().waitFor({ timeout: 8000 });
assert.ok(await p.getByLabel("Mandar foto o GIF").count() >= 1, "el chat sigue igual");
assert.equal(await p.locator(".castigo-nota.chat").count(), 0);
assert.ok((await p.evaluate(() => window.__canalChat().nombre)).endsWith("g2"), "canal del chat propio del grupo");
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(600);
assert.ok((await p.locator(".foto-castigo").count()) > 0, "fotos de los demás borrosas");
await p.screenshot({ path: "capturas/gr-imagenes.png" });

await ir(p, "Logros");
await p.waitForTimeout(600);
assert.equal(await p.getByRole("heading", { name: "La maldición de la cacona" }).count(), 1);
assert.equal(await p.getByText(/Bocha/).count(), 0, "en Logros no aparece el Bocha");
await p.locator(".multas").screenshot({ path: "capturas/gr-logros.png" });

await ir(p, "Ajustes");
await p.waitForTimeout(500);
await p.getByRole("button", { name: /La maldición de la cacona/ }).click();
await p.waitForTimeout(500);
assert.ok(await p.getByText(/como en BeReal/).count() >= 1);
assert.equal(await p.getByText(/Bocha/).count(), 0, "las reglas no hablan del Bocha");
await p.screenshot({ path: "capturas/gr-reglas.png" });
await ctx.close();

// ---------- Sin grupo: pide entrar y espera que el admin acepte ----------
({ ctx, p } = await abrir("sin"));
await p.getByRole("heading", { name: "Entrá a un grupo" }).waitFor();
assert.equal(await p.locator(".tarjeta-amigo").count(), 0);
await p.screenshot({ path: "capturas/gr-sin-grupo.png" });
await p.getByLabel("Código del grupo").fill("cualquiera");
await p.getByRole("button", { name: "Pedir entrar" }).click();
await p.getByRole("alert").waitFor();
assert.match(await p.getByRole("alert").innerText(), /no es de ningún grupo/);
await p.getByLabel("Código del grupo").fill("viejos");
await p.getByRole("button", { name: "Pedir entrar" }).click();
await p.getByRole("heading", { name: "Esperando que te acepten" }).waitFor();
assert.match(await p.locator(".pedidos-enviados").innerText(), /Lomada Viejos[\s\S]*Esperando que el admin te acepte/);
assert.equal(await p.locator(".tarjeta-amigo").count(), 0, "todavia no entra");
await p.screenshot({ path: "capturas/gr-esperando.png" });
// El admin acepta: al volver a la app (o a los 15 s) entra solo.
await p.evaluate(() => {
  window.__misPedidos = [];
  const g2 = { id: "g2", nombre: "Lomada Viejos", con_bocha: false };
  window.__db.grupos.push(g2);
  window.__db.perfiles.forEach((pf) => { pf.grupo_id = "g2"; });
  document.dispatchEvent(new Event("visibilitychange"));
});
await p.locator(".tarjeta-amigo").first().waitFor({ timeout: 5000 });
await ctx.close();

// ---------- Sin el SQL 046 todavía: se entra directo como antes ----------
({ ctx, p } = await abrir("sin", { __sin046: true }));
await p.getByLabel("Código del grupo").fill("viejos");
await p.getByRole("button", { name: "Pedir entrar" }).click();
await p.locator(".tarjeta-amigo").first().waitFor({ timeout: 5000 });
await ctx.close();

// ---------- Crear un grupo: quien lo crea lo administra ----------
({ ctx, p } = await abrir("sin", { __pedidos: [{ id: "s1", usuario_id: "u9", nombre: "Tiago", usuario: "tiago", creado_en: new Date().toISOString() }, { id: "s2", usuario_id: "u8", nombre: "Pepa", usuario: "pepa", creado_en: new Date().toISOString() }] }));
await p.getByPlaceholder("Nombre del grupo").fill("Los Pibes");
await p.getByRole("button", { name: "Crear", exact: true }).click();
await p.locator(".tarjeta-amigo").first().waitFor({ timeout: 5000 });
assert.ok(await p.locator(".punto-novedad").locator("visible=true").count() >= 1, "puntito en Ajustes por los pedidos");
await ir(p, "Ajustes");
await p.waitForTimeout(500);
assert.match(await p.getByRole("button", { name: /^Grupos/ }).innerText(), /2 pedidos para entrar/);
await p.getByRole("button", { name: /^Grupos/ }).click();
await p.waitForTimeout(600);
const admin = p.locator(".admin-grupo");
assert.match(await admin.innerText(), /Administrás Los Pibes/i);
assert.match(await admin.locator("code").innerText(), /lomada-1234/);
assert.match(await p.locator(".grupo-fila", { hasText: "Los Pibes" }).innerText(), /Lo administrás/);
await admin.screenshot({ path: "capturas/gr-admin.png" });
await admin.getByRole("button", { name: "Aceptar a Tiago" }).click();
await p.waitForTimeout(600);
await admin.getByRole("button", { name: "Rechazar a Pepa" }).click();
await p.waitForTimeout(600);
assert.match(await admin.innerText(), /Nadie esperando/);
assert.deepEqual(await p.evaluate(() => window.__pedidos.map((x) => x.estado)), ["aceptada", "rechazada"]);
await ctx.close();

// ---------- Lomada sigue con el Bocha y el viaje ----------
({ ctx, p } = await abrir("lomada"));
await ir(p, "Logros");
await p.waitForTimeout(500);
assert.equal(await p.getByRole("heading", { name: "La maldición del Bocha" }).count(), 1);
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("grupos: pruebas pasadas");
