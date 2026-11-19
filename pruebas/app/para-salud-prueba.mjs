// Lomada -> Apple Salud: el endpoint del Atajo y la sección en Ajustes.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import handler from "../../api/para-salud.js";

// ---------- El endpoint ----------
process.env.SUPABASE_URL = "https://p.test";
process.env.SUPABASE_ANON_KEY = "pub";
const llamadas = [];
const comidas = [{ nombre: "Milanesa", fecha: "2026-11-19T13:05:00-03:00", kcal: 650, proteinas: 30, carbohidratos: 50, grasas: 10 }, { nombre: "Banana", fecha: "2026-11-19T16:40:00-03:00", kcal: 105, proteinas: 1, carbohidratos: 27, grasas: 0 }];
globalThis.fetch = async (url, op) => {
  const cuerpo = JSON.parse(op.body);
  llamadas.push({ url: String(url), cuerpo });
  if (cuerpo.p_token === "mala") return new Response(JSON.stringify({ message: "token_invalido" }), { status: 400 });
  return new Response(JSON.stringify(comidas), { status: 200 });
};
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { this.cuerpo = d; return this; } });
let r = res();
await handler({ method: "POST", body: { token: " llave " } }, r);
assert.equal(r.statusCode, 200);
assert.equal(llamadas[0].url, "https://p.test/rest/v1/rpc/comidas_para_salud");
assert.deepEqual(llamadas[0].cuerpo, { p_token: "llave", p_marcar: true });
assert.equal(r.cuerpo.cantidad, 2);
assert.equal(r.cuerpo.texto, "A Apple Salud: 2 comidas, 755 kcal.");
r = res();
await handler({ method: "POST", body: { token: "llave", probar: true } }, r);
assert.equal(llamadas[1].cuerpo.p_marcar, false, "probar no marca");
assert.match(r.cuerpo.texto, /Se mandarían/);
r = res();
await handler({ method: "POST", body: { token: "mala" } }, r);
assert.equal(r.statusCode, 401);
r = res();
await handler({ method: "POST", body: {} }, r);
assert.equal(r.statusCode, 400);
r = res();
await handler({ method: "GET" }, r);
assert.equal(r.statusCode, 405);

// ---------- Ajustes > Apple Salud ----------
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (rt) => rt.fulfill({ json: {} }));
await ctx.addInitScript(() => {
  localStorage.setItem("comidas-bienvenida", "vista");
  document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); });
  window.__con057 = true;
});
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199"); await p.waitForTimeout(1500);
await p.evaluate(async () => {
  const { fechaLocal, haceDias } = await import("/src/lib/fechas.js");
  const hoy = fechaLocal(), ayer = haceDias(1);
  window.__db.salud_comidas.push(
    { usuario_id: "u1", fecha: ayer, momento: `${ayer}T13:00:00-03:00`, kcal: 700, proteinas: 40, carbohidratos: 60, grasas: 25 },
    { usuario_id: "u1", fecha: ayer, momento: `${ayer}T21:30:00-03:00`, kcal: 1261, proteinas: 70, carbohidratos: 110, grasas: 50 },
    { usuario_id: "u1", fecha: hoy, momento: `${hoy}T09:10:00-03:00`, kcal: 320, proteinas: 15, carbohidratos: 40, grasas: 8 },
  );
  window.__db.salud_exportadas.push({ usuario_id: "u1", fecha: hoy, momento: `${hoy}T13:05:00-03:00`, kcal: 650 });
});
await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(400);
await p.locator(".menu-ajustes button", { hasText: "Apple Salud" }).click();
await p.waitForTimeout(800);
const llego = p.locator(".salud-detalle");
await llego.waitFor();
assert.match(await llego.innerText(), /Ayer\s*1\.961 kcal[\s\S]*13:00[\s\S]*700 kcal[\s\S]*21:30[\s\S]*1\.261 kcal/);
const mandar = p.locator(".salud-mandar");
assert.match(await mandar.innerText(), /lomada-fuel\.vercel\.app\/api\/para-salud/);
assert.match(await mandar.innerText(), /Mandado a Salud[\s\S]*Hoy\s*1 comida · 650 kcal/);
await llego.screenshot({ path: "capturas/salud-llego.png" });
await mandar.screenshot({ path: "capturas/salud-mandar.png" });
await ctx.close();
await b.close();
assert.deepEqual(errores, []);
console.log("Lomada a Apple Salud: pasaron");
