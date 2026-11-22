// Fotos fijadas en el perfil (SQL 065): hasta 3, arriba de todo; solo las fija el dueño; los demás ven el pin.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  return { ctx, p };
}
const fotosDeLaGaleria = (p) => p.locator(".galeria li > button:first-child").evaluateAll((l) => l.map((x) => x.getAttribute("aria-label")));

// 1) Sin el SQL 065: no hay pines.
let { ctx, p } = await abrir();
await p.getByRole("button", { name: "Tu perfil" }).click();
await p.getByRole("tab", { name: "Fotos" }).click();
await p.waitForTimeout(500);
assert.equal(await p.locator(".galeria .fijar").count(), 0);
await ctx.close();

// 2) Mi perfil: fijo el asado (que estaba último) y pasa arriba de todo.
({ ctx, p } = await abrir({ __con065: true }));
await p.getByRole("button", { name: "Tu perfil" }).click();
await p.getByRole("tab", { name: "Fotos" }).click();
await p.waitForTimeout(500);
const antes = await fotosDeLaGaleria(p);
assert.ok(!/Asado/.test(antes[0]), "el asado no estaba primero");
await p.getByRole("button", { name: "Fijar la foto Asado con ensalada" }).click();
await p.waitForTimeout(500);
const despues = await fotosDeLaGaleria(p);
assert.match(despues[0], /Asado con ensalada \(fijada\)/, "queda arriba de todo");
assert.ok(await p.evaluate(() => window.__db.comidas.find((c) => c.id === "c6").fijada_en), "se guarda");
await p.locator(".galeria").screenshot({ path: "capturas/fotos-fijadas.png" });
// Hasta 3: la cuarta avisa.
await p.getByRole("button", { name: "Fijar la foto Milanesa con puré" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Fijar la foto Tostadas con palta y café" }).click();
await p.waitForTimeout(300);
const libres = p.locator(".galeria .fijar:not(.activo)");
if (await libres.count()) {
  await libres.first().click();
  await p.waitForTimeout(300);
  assert.match(await p.locator(".aviso, [role=status]").last().innerText(), /hasta 3 fotos/);
  assert.equal(await p.evaluate(() => window.__db.comidas.filter((c) => c.usuario_id === "u1" && c.fijada_en).length), 3);
}
// Soltar.
await p.getByRole("button", { name: "Soltar la foto Asado con ensalada" }).click();
await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => window.__db.comidas.find((c) => c.id === "c6").fijada_en), null);
await ctx.close();

// 3) El perfil de otro: ve la fijada arriba con el pin, pero no puede fijar.
({ ctx, p } = await abrir({ __con065: true, __fijadas: { c10: "2026-11-20T10:00:00Z" } }));
const nahuel = p.locator(".tarjeta-amigo", { hasText: "Nahuel" });
await nahuel.scrollIntoViewIfNeeded();
await nahuel.locator(".amigo-cabecera").click();
await p.waitForTimeout(400);
await nahuel.getByRole("button", { name: /Ver perfil/ }).click();
await p.waitForTimeout(800);
await p.getByRole("tab", { name: "Fotos" }).click();
await p.waitForTimeout(500);
assert.match((await fotosDeLaGaleria(p))[0], /Hamburguesa completa \(fijada\)/);
assert.equal(await p.locator(".galeria button.fijar").count(), 0, "no se fijan fotos de otro");
assert.equal(await p.locator(".galeria span.fijar").count(), 1, "pero se ve el pin");
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("fotos fijadas: pasaron");
