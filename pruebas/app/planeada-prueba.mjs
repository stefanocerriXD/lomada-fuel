// Comidas planeadas (SQL 062): se cargan antes de comerlas, sin foto ni aviso; con "Ya la comí" se suma la foto y ahí avisa.
// Las que se suben sin foto (ya comidas) siguen avisando. Las planeadas de los demás no se ven.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const avisos = [];

async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => {
    const url = r.request().url();
    if (url.includes("/api/notificar")) { avisos.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ json: { ok: true } }); }
    if (url.includes("/api/alimentos")) {
      return r.fulfill({ json: { resultados: [{ id: "off-1", nombre: "Pechuga de pollo", marca: "", fuente: "argentina", verificado: true, por100: { kcal: 120, p: 23, c: 0, g: 2 }, porcion: { nombre: "1 porción", g: 200 } }] } });
    }
    return r.fulfill({ status: 503, json: { error: "sin ia" } });
  });
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  return { ctx, p };
}

async function sumarPollo(p) {
  await p.getByLabel("Buscar alimento o producto").fill("pollo");
  await p.waitForTimeout(1200);
  await p.locator(".buscador .resultados button", { hasText: "Pechuga de pollo" }).first().click();
  await p.waitForTimeout(400);
  await p.getByLabel("Buscar alimento o producto").fill("");
  await p.waitForTimeout(300);
}

// 1) Sin el SQL 062 no aparece la opción.
let { ctx, p } = await abrir();
await p.getByRole("button", { name: /Agregar cena/ }).click();
await p.waitForTimeout(700);
await p.getByText("Más opciones").click();
assert.equal(await p.getByText("Todavía no la comí").count(), 0);
await ctx.close();

// 2) Cena de hoy planeada: sin foto, sin aviso.
({ ctx, p } = await abrir({ __con062: true }));
// La planeada de Nahuel no se ve en el día de cada uno.
assert.equal(await p.evaluate(() => document.body.innerText.includes("Salmón planeado")), false);
await p.locator(".amigo-cabecera", { hasText: "Nahuel" }).click();
await p.waitForTimeout(400);
assert.equal(await p.getByText("Salmón planeado").count(), 0, "la planeada de otro no se ve");

await p.getByRole("button", { name: /Agregar cena/ }).click();
await p.waitForTimeout(700);
await sumarPollo(p);
await p.getByLabel("Nota de la comida").fill("Pollo de la noche");
assert.equal(await p.getByLabel("Foto de la comida").count(), 1);
await p.getByText("Más opciones").click();
await p.getByText("Todavía no la comí").click();
assert.equal(await p.getByLabel("Foto de la comida").count(), 0, "planeada: sin foto");
await p.screenshot({ path: "capturas/planeada-nueva.png" });
await p.getByRole("button", { name: "Guardar comida planeada" }).click();
await p.waitForTimeout(900);
const fila = await p.evaluate(() => window.__db.comidas.find((c) => c.descripcion === "Pollo de la noche"));
assert.ok(fila, "se guardó");
assert.equal(fila.planeada, true);
assert.equal(fila.foto_path, null);
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 0, "no avisa al planearla");

// En el día: la tarjeta de planeadas con "Ya la comí".
const tarjeta = p.locator(".planeadas");
await tarjeta.waitFor();
assert.match(await tarjeta.innerText(), /Pollo de la noche[\s\S]*Ya la comí/);
// Con el lápiz se edita (sumar una porción) sin marcarla como comida.
await tarjeta.getByRole("button", { name: "Editar Pollo de la noche" }).click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Sumar", exact: true }).click();
await p.waitForTimeout(300);
await p.locator(".pie-botones").getByRole("button", { name: "Guardar cambios" }).click();
await p.waitForTimeout(900);
const editada = await p.evaluate(() => window.__db.comidas.find((c) => c.descripcion === "Pollo de la noche"));
assert.deepEqual([editada.planeada, editada.alimentos[0].cantidad], [true, 2], "sigue planeada, con 2 porciones");
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 0, "editarla no avisa");
await tarjeta.scrollIntoViewIfNeeded();
await tarjeta.screenshot({ path: "capturas/planeadas.png" });

// 3) "Ya la comí": se suma la foto y recién ahí avisa, con la hora renovada.
const antes = fila.creado_en;
await tarjeta.getByRole("button", { name: /Ya la comí/ }).click();
await p.waitForTimeout(700);
assert.match(await p.locator(".comida-planeada").innerText(), /La tenías planeada/);
await p.getByLabel("Foto de la comida").setInputFiles("archivos/foto-original.jpg");
await p.waitForTimeout(1200);
await p.screenshot({ path: "capturas/planeada-comer.png" });
await p.locator(".pie-botones").getByRole("button", { name: "Ya la comí" }).click();
await p.waitForTimeout(1200);
const comida = await p.evaluate((id) => window.__db.comidas.find((c) => c.id === id), fila.id);
assert.equal(comida.planeada, false);
assert.ok(comida.foto_path, "con foto");
assert.ok(comida.creado_en > antes, "la hora se renueva");
assert.deepEqual(avisos.filter((a) => a.tipo === "comida").map((a) => a.id), [fila.id], "avisa al comerla");
assert.equal(await p.locator(".planeadas").count(), 0);

// 4) Una planeada que se come sin foto: pregunta y avisa igual.
await p.getByRole("button", { name: /Agregar merienda/ }).click();
await p.waitForTimeout(700);
await sumarPollo(p);
await p.getByLabel("Nota de la comida").fill("Merienda planeada");
await p.getByText("Más opciones").click();
await p.getByText("Todavía no la comí").click();
await p.getByRole("button", { name: "Guardar comida planeada" }).click();
await p.waitForTimeout(900);
await p.locator(".planeadas").getByRole("button", { name: /Ya la comí/ }).click();
await p.waitForTimeout(700);
await p.locator(".pie-botones").getByRole("button", { name: "Ya la comí" }).click();
await p.waitForTimeout(300);
assert.match(await p.locator(".confirmar-publicar").innerText(), /Te falta la foto/);
await p.getByRole("button", { name: "Publicar igual" }).click();
await p.waitForTimeout(1000);
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 2, "sin foto también avisa al comerla");

// 5) Subida normal sin foto (ya comida): avisa al toque, como siempre.
await p.getByRole("button", { name: /Agregar desayuno/ }).click();
await p.waitForTimeout(700);
await sumarPollo(p);
await p.getByLabel("Nota de la comida").fill("Desayuno sin foto");
await p.getByRole("button", { name: "Publicar comida" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Publicar igual" }).click();
await p.waitForTimeout(1000);
const sinFoto = await p.evaluate(() => window.__db.comidas.find((c) => c.descripcion === "Desayuno sin foto"));
assert.equal(sinFoto.planeada, false);
assert.equal(avisos.filter((a) => a.tipo === "comida").length, 3, "la subida sin foto avisa");
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("comidas planeadas: pasaron");
