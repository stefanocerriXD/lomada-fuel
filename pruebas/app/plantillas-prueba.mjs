import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1500);

const img = p.locator(".compartir-ig-vista img");
async function bajar(nombre) {
  await p.waitForTimeout(300);
  await img.waitFor({ timeout: 8000 });
  const datos = await img.evaluate(async (el) => { const r = await fetch(el.src); const a = new Uint8Array(await r.arrayBuffer()); let s = ""; a.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); });
  fs.writeFileSync(`capturas/${nombre}`, Buffer.from(datos, "base64"));
}
const boton = p.getByRole("button", { name: /Compartir mi día/ });

async function todas(sufijo) {
  await boton.scrollIntoViewIfNeeded();
  await boton.click();
  await p.getByRole("dialog", { name: "Compartir tu día" }).waitFor();
  for (const pl of ["Grilla", "Collage", "Ticket"]) {
    await p.getByRole("radio", { name: pl }).click();
    await p.getByRole("radio", { name: "Historia" }).click();
    await p.waitForTimeout(1200);
    await bajar(`pl-${pl.toLowerCase()}-historia${sufijo}.jpg`);
    await p.getByRole("radio", { name: "Publicación" }).click();
    await p.waitForTimeout(1200);
    await bajar(`pl-${pl.toLowerCase()}-publicacion${sufijo}.jpg`);
  }
  await p.screenshot({ path: `capturas/pl-hoja${sufijo}.png` });
  await p.getByRole("button", { name: "Cerrar" }).last().click(); await p.waitForTimeout(500);
}

await todas("");
// Se recuerda la plantilla elegida.
assert.equal(await p.evaluate(() => localStorage.getItem("lomada-plantilla-dia")), "ticket");

// Día con muchas comidas (una sin foto y con nombre largo).
await p.evaluate(() => {
  const base = window.__db.comidas.find((x) => x.usuario_id === "u1" && x.foto_path);
  const nuevas = [
    { tipo: "merienda", descripcion: "Café con leche y medialunas de manteca", calorias: 380, foto_path: base.foto_path },
    { tipo: "cena", descripcion: "Bife de chorizo con ensalada mixta y papas al horno con romero", calorias: 980, foto_path: base.foto_path },
    { tipo: "colacion", descripcion: "Yogur con granola", calorias: 210, foto_path: null },
    { tipo: "colacion", descripcion: "Banana", calorias: 105, foto_path: base.foto_path },
  ];
  nuevas.forEach((n, i) => {
    const c = { ...base, ...n, id: `nueva-${i}`, fotos_extra: [] };
    window.__db.comidas.push(c);
    window.__canalDatos().emitir("comidas", { eventType: "INSERT", new: c });
  });
});
await p.waitForTimeout(1500);
await todas("-muchas");
await ctx.close();
assert.deepEqual(errores, []);
await b.close();
console.log("plantillas ok");
