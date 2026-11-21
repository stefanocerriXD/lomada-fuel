// Perfil tipo Instagram (SQL 063): cabecera con números y bio, destacadas con visor a pantalla completa y editor.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(flags = {}, url = "http://localhost:5199") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(url);
  await p.waitForTimeout(1500);
  return { ctx, p };
}

// 1) Sin el SQL 063: la cabecera nueva igual, sin destacadas ni bio en Ajustes.
let { ctx, p } = await abrir();
await p.getByRole("button", { name: "Tu perfil" }).click();
await p.locator(".perfil-ig").waitFor();
assert.match(await p.locator(".perfil-ig-numeros").innerText(), /Fotos[\s\S]*Racha[\s\S]*Nivel/);
assert.equal(await p.locator(".destacadas").count(), 0);
await ctx.close();
({ ctx, p } = await abrir({}, "http://localhost:5199/?vista=ajustes"));
await p.locator(".menu-ajustes button", { hasText: "Tu perfil" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByLabel("Bio").count(), 0);
await ctx.close();

// 2) Perfil de Nahuel: bio y su destacada "Gym" con 2 fotos; se ve a pantalla completa y avanza.
({ ctx, p } = await abrir({
  __con063: true,
  __bio: "Volumen · gym 5 veces por semana",
  __destacadas: [{ id: "d1", usuario_id: "u2", nombre: "Gym", privada: false, orden: 0, creado_en: "2026-11-01T10:00:00Z" }],
  __destacadasFotos: [
    { id: "df1", destacada_id: "d1", usuario_id: "u2", foto_path: "f3", texto: "Día de piernas", orden: 0, creado_en: "2026-11-01T10:00:00Z" },
    { id: "df2", destacada_id: "d1", usuario_id: "u2", foto_path: "f6", texto: null, orden: 1, creado_en: "2026-11-01T10:01:00Z" },
  ],
}));
const nahuel = p.locator(".tarjeta-amigo", { hasText: "Nahuel" });
await nahuel.scrollIntoViewIfNeeded();
await nahuel.locator(".amigo-cabecera").click();
await p.waitForTimeout(400);
await nahuel.getByRole("button", { name: /Ver perfil/ }).click();
await p.waitForTimeout(900);
assert.match(await p.locator(".perfil-bio").innerText(), /Volumen · gym 5 veces/);
assert.equal(await p.getByRole("button", { name: "Editar perfil" }).count(), 0, "el de otro no se edita");
assert.equal(await p.getByRole("button", { name: "Nueva destacada" }).count(), 0);
await p.locator(".perfil").screenshot({ path: "capturas/perfil-ig-otro.png" });
await p.getByRole("button", { name: "Destacada Gym" }).click();
await p.waitForTimeout(500);
const visor = p.getByRole("dialog", { name: "Destacada Gym" });
assert.match(await visor.innerText(), /Gym[\s\S]*Día de piernas/);
assert.equal(await visor.getByRole("button", { name: "Editar destacada" }).count(), 0);
await p.screenshot({ path: "capturas/destacada-visor.png" });
await visor.getByRole("button", { name: "Foto siguiente" }).click();
await p.waitForTimeout(300);
assert.doesNotMatch(await visor.innerText(), /Día de piernas/, "pasó a la segunda");
await visor.getByRole("button", { name: "Foto siguiente" }).click();
await p.waitForTimeout(500);
assert.equal(await p.getByRole("dialog", { name: "Destacada Gym" }).count(), 0, "después de la última se cierra");
await ctx.close();

// 3) Mi perfil: crear "Cambio físico" (arranca solo yo) con una foto subida y una de mis comidas.
({ ctx, p } = await abrir({ __con063: true }));
await p.getByRole("button", { name: "Tu perfil" }).click();
await p.locator(".perfil-ig").waitFor();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Nueva destacada" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Cambio físico" }).click();
assert.equal(await p.getByLabel("Nombre de la destacada").inputValue(), "Cambio físico");
assert.equal(await p.getByRole("checkbox", { name: /Solo yo/ }).isChecked(), true, "cambio físico arranca solo yo");
await p.getByRole("button", { name: "Crear destacada" }).click();
assert.match(await p.locator(".editor-destacada [role=alert]").innerText(), /al menos una foto/);
await p.getByLabel("Subir fotos a la destacada").setInputFiles("archivos/foto-original.jpg");
await p.waitForTimeout(1200);
await p.getByRole("button", { name: "Sumar fotos de tus comidas" }).click();
await p.locator(".de-comidas button").first().click();
assert.equal(await p.locator(".editor-destacada-grilla:not(.de-comidas) img").count(), 2);
await p.screenshot({ path: "capturas/destacada-editor.png" });
await p.getByRole("button", { name: "Crear destacada" }).click();
await p.waitForTimeout(1200);
const [d] = await p.evaluate(() => window.__db.destacadas);
assert.deepEqual([d.nombre, d.privada, d.usuario_id], ["Cambio físico", true, "u1"]);
const fotosD = await p.evaluate(() => window.__db.destacadas_fotos);
assert.equal(fotosD.length, 2);
assert.ok(fotosD.some((f) => /^u1\/destacadas\//.test(f.foto_path)), "la subida va a la carpeta de destacadas");
const circulo = p.getByRole("button", { name: "Destacada Cambio físico, solo vos" });
await circulo.waitFor();
await p.locator(".perfil").screenshot({ path: "capturas/perfil-ig-propio.png" });
// Editar desde el visor y borrarla: se van las fotos subidas.
await circulo.click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: "Editar destacada" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Borrar destacada" }).click();
await p.getByRole("button", { name: "¿Seguro? Tocá de nuevo" }).click();
await p.waitForTimeout(800);
assert.equal(await p.evaluate(() => window.__db.destacadas.length), 0);
assert.ok((await p.evaluate(() => window.__quitados || [])).some((r) => /destacadas\//.test(r)), "borra el archivo subido");
assert.equal(await p.getByRole("button", { name: /Destacada Cambio/ }).count(), 0);
await ctx.close();

// 4) La bio se edita en Ajustes.
({ ctx, p } = await abrir({ __con063: true }, "http://localhost:5199/?vista=ajustes"));
await p.locator(".menu-ajustes button", { hasText: "Tu perfil" }).click();
await p.waitForTimeout(400);
await p.getByLabel("Bio").fill("Definición · 5 días de gym");
await p.getByRole("button", { name: "Guardar cambios" }).click();
await p.waitForTimeout(800);
assert.equal(await p.evaluate(() => window.__db.perfiles.find((x) => x.id === "u1").bio), "Definición · 5 días de gym");
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("perfil y destacadas: pasaron");
