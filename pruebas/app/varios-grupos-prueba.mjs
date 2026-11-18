import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(modo) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/prueba\.local/, (r) => r.abort());
  await ctx.addInitScript((modo) => { window.__plan = true; window.__sin046 = true; localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("mock-grupo", modo); }, modo);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1300);
  return { ctx, p };
}
const ir = (p, n) => p.getByRole("button", { name: n, exact: true }).locator("visible=true").first().click();
const yo = (p) => p.evaluate(() => window.__db.perfiles.find((x) => x.id === "u1"));

// ---------- En dos grupos ----------
let { ctx, p } = await abrir("dos");
const selector = p.locator(".selector-grupo").locator("visible=true");
await selector.waitFor();
assert.equal((await selector.innerText()).trim(), "Lomada");
await p.locator(".barra-superior").screenshot({ path: "capturas/vg-cabecera.png" });
await selector.click();
await p.getByRole("button", { name: /Lomada Viejos/ }).waitFor();
await p.waitForTimeout(400);
await p.screenshot({ path: "capturas/vg-selector.png" });
await p.getByRole("button", { name: /Lomada Viejos/ }).click();
await p.waitForTimeout(1500);
assert.equal((await p.locator(".selector-grupo").locator("visible=true").innerText()).trim(), "Lomada Viejos");
assert.ok((await p.evaluate(() => window.__canalChat().nombre)).endsWith("g2"));

// Ajustes → Grupos: elegir en cada comida
await ir(p, "Ajustes");
await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Grupos/ }).click();
await p.waitForTimeout(400);
assert.equal(await p.locator(".grupo-fila").count(), 2);
await p.getByRole("radio", { name: /Elegir en cada comida/ }).click();
await p.waitForTimeout(600);
assert.equal((await yo(p)).publicar_en, "elegir");
assert.equal(await p.getByRole("radio", { name: /Elegir en cada comida/ }).getAttribute("aria-checked"), "true");
await p.screenshot({ path: "capturas/vg-ajustes.png", fullPage: true });

// Subir una comida eligiendo los dos grupos
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click().catch(async () => p.locator(".boton-mas, [aria-label='Subir comida']").first().click());
await p.locator(".chips-grupos").waitFor();
const chips = p.locator(".chip-grupo");
assert.equal(await chips.count(), 2);
assert.equal(await p.locator(".chip-grupo.activo").innerText(), "Lomada Viejos", "arranca con el grupo que estás viendo");
const lomada = chips.filter({ hasText: /^\s*Lomada\s*$/ });
await lomada.click();
assert.equal(await p.locator(".chip-grupo.activo").count(), 2);
await lomada.click();
await p.locator(".chip-grupo.activo").click();
assert.equal(await p.locator(".chip-grupo.activo").count(), 1, "siempre queda al menos uno");
await lomada.click();
assert.equal(await p.locator(".chip-grupo.activo").count(), 2);
await p.getByLabel("Buscar alimento o producto").fill("banana");
await p.waitForTimeout(800);
await p.locator(".resultado, [class*=resultado] button").first().click();
await p.waitForTimeout(300);
await p.screenshot({ path: "capturas/vg-comida.png" });
await p.getByRole("button", { name: /^Publicar/ }).last().click();
await p.getByRole("button", { name: "Publicar igual" }).click();
await p.waitForTimeout(1500);
await p.screenshot({ path: "capturas/vg-publicada.png" });
console.log(await p.evaluate(() => window.__llamadas.slice(-6).map((l) => l.tabla + ":" + l.op)));
const insertada = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "comidas" && l.op === "insert").pop()?.fila);
console.log("grupos de la comida:", insertada?.grupos);
assert.equal(insertada.grupos.length, 2);

// Con "en todos", una nota dice dónde se publica.
await p.evaluate(() => { window.__db.perfiles.find((x) => x.id === "u1").publicar_en = "todos"; window.__canalDatos().emitir("perfiles", { eventType: "UPDATE" }); });
await p.waitForTimeout(800);
await p.getByRole("button", { name: "Subir comida" }).locator("visible=true").first().click();
await p.locator(".publicar-nota").waitFor();
assert.match(await p.locator(".publicar-nota").innerText(), /Lomada Viejos y Lomada|Lomada y Lomada Viejos/);
assert.equal(await p.locator(".chips-grupos").count(), 0);
await ctx.close();

// ---------- Un solo grupo: sumarse con un código y salir ----------
({ ctx, p } = await abrir("lomada"));
assert.equal(await p.locator(".selector-grupo").count(), 0, "con un grupo no hay selector");
await ir(p, "Ajustes");
await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Grupos/ }).click();
await p.waitForTimeout(400);
assert.ok(await p.getByText(/Cuando estés en más de un grupo/).count());
await p.getByPlaceholder("Código del grupo").fill("cualquiera");
await p.getByRole("button", { name: "Pedir entrar" }).click();
await p.getByRole("alert").waitFor();
await p.getByPlaceholder("Código del grupo").fill("viejos");
await p.getByRole("button", { name: "Pedir entrar" }).click();
await p.locator(".selector-grupo").locator("visible=true").waitFor({ timeout: 5000 });
assert.equal((await p.locator(".selector-grupo").locator("visible=true").innerText()).trim(), "Lomada Viejos", "pasa a ver el grupo nuevo");
await ir(p, "Ajustes");
await p.waitForTimeout(400);
await p.getByRole("button", { name: /^Grupos/ }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Salir de Lomada Viejos" }).click();
await p.getByRole("button", { name: "Salir de Lomada Viejos" }).click();
await p.waitForTimeout(1500);
assert.equal(await p.locator(".selector-grupo").count(), 0);
assert.equal((await yo(p)).grupo_id, "00000000-0000-4000-8000-00000000a001");
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("varios grupos: pruebas pasadas");
