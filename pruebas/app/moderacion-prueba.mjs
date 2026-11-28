// Denunciar y bloquear (SQL 070), lo que pide Apple para apps con contenido de usuarios.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(flags, ruta = "/?vista=chat") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
  await ctx.route(/\/api\//, (r) => {
    if (r.request().url().includes("/api/notificar")) (globalThis.__avisos ||= []).push(r.request().postDataJSON());
    return r.fulfill({ json: { ok: true, enviadas: 0, resultados: [] } });
  });
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(`http://localhost:5199${ruta}`);
  await p.waitForTimeout(1500);
  return { ctx, p };
}

// 1) Sin el SQL 070: no aparece nada de esto.
let { ctx, p } = await abrir({});
let burbuja = p.locator(".chat-fila", { hasText: "Quién se suma el sábado?" }).locator(".burbuja");
await burbuja.click({ button: "right" });
let opciones = p.getByRole("dialog", { name: "Opciones" });
await opciones.getByRole("button", { name: "Responder" }).waitFor();
assert.equal(await opciones.getByRole("button", { name: "Denunciar mensaje" }).count(), 0);
await ctx.close();

// 2) Denunciar un mensaje y bloquear a quien lo mandó: sus mensajes dejan de verse.
({ ctx, p } = await abrir({ __con070: true }));
burbuja = p.locator(".chat-fila", { hasText: "Quién se suma el sábado?" }).locator(".burbuja");
await burbuja.click({ button: "right" });
opciones = p.getByRole("dialog", { name: "Opciones" });
assert.equal(await opciones.getByRole("button", { name: "Bloquear a Nahuel" }).count(), 1);
await opciones.getByRole("button", { name: "Denunciar mensaje" }).click();
const hoja = p.getByRole("dialog", { name: "Denunciar" });
await hoja.waitFor();
await hoja.getByRole("button", { name: "Mandar denuncia" }).click();
await hoja.getByText("Elegí qué pasa").waitFor();
await hoja.getByText("Acoso o burla hacia alguien").click();
await hoja.getByLabel("Detalle de la denuncia").fill("Se burla de Juan");
await hoja.getByText("Bloquear también a Nahuel").click();
await p.screenshot({ path: "capturas/denunciar.png" });
await hoja.getByRole("button", { name: "Mandar denuncia" }).click();
await p.locator(".aviso", { hasText: "Denuncia enviada. Bloqueaste a Nahuel" }).waitFor();
const d = await p.evaluate(() => window.__db.denuncias[0]);
assert.equal(d.tipo, "mensaje");
assert.equal(d.objeto_id, "m5");
assert.equal(d.denunciado_id, "u2");
assert.equal(d.motivo, "acoso");
assert.equal(d.detalle, "Se burla de Juan");
assert.equal(d.contenido, "Quién se suma el sábado?");
assert.ok(globalThis.__avisos.some((x) => x.tipo === "denuncia"), "avisa al dueño");
assert.deepEqual(await p.evaluate(() => window.__db.bloqueos.map((x) => x.bloqueado_id)), ["u2"]);
await p.waitForTimeout(500);
assert.equal(await p.locator(".chat-fila", { hasText: "Quién se suma el sábado?" }).count(), 0, "no se ven sus mensajes");
assert.ok(await p.locator(".chat-fila", { hasText: "Te juzgamos" }).count(), "los de los demás sí");

// 3) Ajustes › Cuenta: la lista de bloqueados, para desbloquear.
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.locator(".menu-ajustes button", { hasText: "bloqueados y borrar cuenta" }).click();
const bloqueados = p.locator("section[aria-label='Personas bloqueadas']");
await bloqueados.getByText("Nahuel").waitFor();
await bloqueados.screenshot({ path: "capturas/bloqueados.png" });
await bloqueados.getByRole("button", { name: "Desbloquear" }).click();
await bloqueados.getByText("No bloqueaste a nadie").waitFor();
assert.equal(await p.evaluate(() => window.__db.bloqueos.length), 0);

// 4) El dueño las revisa en su panel: borrar el mensaje.
await p.getByRole("button", { name: "Volver" }).first().click().catch(() => {});
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Panel del dueño/ }).click();
const denuncias = p.locator(".denuncias-dueno");
await denuncias.getByText("Mensaje de Nahuel").waitFor();
assert.match(await denuncias.innerText(), /1 para revisar[\s\S]*Acoso o burla[\s\S]*Quién se suma el sábado\?[\s\S]*Se burla de Juan/i);
await denuncias.screenshot({ path: "capturas/denuncias-dueno.png" });
await denuncias.getByRole("button", { name: "Borrar" }).click();
await denuncias.getByRole("button", { name: "¿Seguro?" }).click();
await denuncias.getByText("Borrado").waitFor();
assert.equal(await p.evaluate(() => window.__db.mensajes.some((m) => m.id === "m5")), false, "el mensaje se borró");
await ctx.close();

// 5) Denunciar una comida desde Imágenes.
({ ctx, p } = await abrir({ __con070: true }));
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^Almuerzo/ }).click();
await p.waitForTimeout(700);
await p.getByRole("button", { name: "Denunciar comida" }).first().click();
const hoja2 = p.getByRole("dialog", { name: "Denunciar" });
await hoja2.getByText("Spam o engaño").click();
await hoja2.getByRole("button", { name: "Mandar denuncia" }).click();
await p.locator(".aviso", { hasText: "La revisamos en menos de 24 horas" }).waitFor();
const dc = await p.evaluate(() => window.__db.denuncias[0]);
assert.equal(dc.tipo, "comida");
assert.notEqual(dc.denunciado_id, "u1", "la propia no se denuncia");
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("denunciar y bloquear: pasaron");
