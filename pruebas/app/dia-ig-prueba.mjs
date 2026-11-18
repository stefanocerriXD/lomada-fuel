import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  window.__compartidos = [];
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__compartidos.push(d.files.map((f) => [f.name, f.type, f.size])); };
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);
const hoy = await p.evaluate(() => {
  const mias = window.__db.comidas.filter((x) => x.usuario_id === "u1" && x.fecha === window.__db.comidas.find((y) => y.usuario_id === "u1").fecha);
  return mias.map((c) => [c.tipo, Boolean(c.foto_path), c.calorias]);
});
console.log("comidas propias:", hoy);

const img = p.locator(".compartir-ig-vista img");
async function bajar(nombre) {
  const datos = await img.evaluate(async (el) => { const r = await fetch(el.src); const a = new Uint8Array(await r.arrayBuffer()); let s = ""; a.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); });
  fs.writeFileSync(`capturas/${nombre}`, Buffer.from(datos, "base64"));
}
const medidas = async () => img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);

const boton = p.getByRole("button", { name: /Compartir mi día/ });
await boton.scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/dia-boton.png" });
await boton.click();
await p.getByRole("dialog", { name: "Compartir tu día" }).waitFor();
await img.waitFor({ timeout: 8000 });
assert.deepEqual(await medidas(), [1080, 1920]);
await bajar("dia-historia.jpg");
await p.getByRole("button", { name: "Compartir", exact: true }).click();
await p.waitForTimeout(300);
const compartidos = await p.evaluate(() => window.__compartidos);
assert.match(compartidos[0][0][0], /-dia-[a-z]+-historia\.jpg$/);
await p.getByRole("radio", { name: "Publicación" }).click();
await p.waitForTimeout(1500);
assert.deepEqual(await medidas(), [1080, 1350]);
await bajar("dia-publicacion.jpg");
await p.getByRole("button", { name: "Cerrar" }).last().click(); await p.waitForTimeout(500);

// Muchas fotos (12): la historia muestra 9 con "+3".
await p.evaluate(() => {
  const base = window.__db.comidas.find((x) => x.usuario_id === "u1" && x.foto_path);
  for (let i = 0; i < 10; i++) {
    const c = { ...base, id: `extra-${i}`, tipo: i % 2 ? "colacion" : "cena", descripcion: `Prueba ${i}`, calorias: 100 + i };
    window.__db.comidas.push(c);
    window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: c });
  }
});
await p.waitForTimeout(1500);
await boton.click();
await img.waitFor({ timeout: 8000 });
await bajar("dia-muchas.jpg");
await p.getByRole("radio", { name: "Publicación" }).click();
await p.waitForTimeout(1500);
await bajar("dia-muchas-pub.jpg");
await p.getByRole("button", { name: "Cerrar" }).last().click(); await p.waitForTimeout(500);

// Sin fotos: lista de comidas.
await p.evaluate(() => {
  window.__db.comidas.filter((x) => x.usuario_id === "u1").forEach((c) => { c.foto_path = null; window.__canalDatos().emitir("comidas", { eventType: "UPDATE", new: c }); });
});
await p.waitForTimeout(1500);
await boton.click();
await img.waitFor({ timeout: 8000 });
await bajar("dia-sin-fotos.jpg");
await ctx.close();
assert.deepEqual(errores, []);
await b.close();
console.log("dia ig ok");
