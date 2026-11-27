// Historias del día (SQL 068 para las estrellas): un círculo por comida abajo del calendario; se abren a pantalla
// completa, se pasan tocando (y solas), se pausan, se cambia de comida deslizando y se cierran. Cada plato se abre
// para ver las calorías y se puntúa con estrellas. En Semana: chef y plato de la semana. Logros de estrellas.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { historiasDelDia } from "../../src/lib/historias.js";
import { cantidadesEstrellas, rankingSemana, semanasChefNuevas } from "../../src/lib/estrellas.js";

// ---------- Cuentas ----------
const hoy = new Date().toLocaleDateString("en-CA");
const com = (id, u, tipo, extra = {}) => ({ id, usuario_id: u, tipo, fecha: hoy, creado_en: `${hoy}T12:00:00Z`, calorias: 500, alimentos: [], foto_path: `${id}.jpg`, ...extra });
const del = [
  com("a", "u1", "almuerzo", { creado_en: `${hoy}T13:00:00Z`, fotos_extra: ["a2.jpg"] }),
  com("b", "u2", "almuerzo", { creado_en: `${hoy}T12:30:00Z` }),
  com("c", "u3", "desayuno", { foto_path: null, alimentos: [{ nombre: "Yogur" }] }),
  com("d", "u3", "cena", { planeada: true }),
  com("e", "u3", "resumen"),
];
const h = historiasDelDia(del);
assert.deepEqual(h.map((g) => g.tipo.id), ["desayuno", "almuerzo", "merienda", "cena", "colacion"]);
assert.deepEqual(h[1].items.map((i) => i.clave), ["b:0", "a:0", "a:1"], "por hora, y cada foto es una historia");
assert.equal(h[0].items[0].ruta, null, "sin foto: una tarjeta");
assert.equal(h[3].items.length, 0, "las planeadas no");
const perfiles = { u1: { id: "u1", nombre: "Yo" }, u2: { id: "u2", nombre: "Nahuel" }, u3: { id: "u3", nombre: "Juan" } };
const pts = [
  { comida_id: "a", usuario_id: "u2", estrellas: 5 }, { comida_id: "a", usuario_id: "u3", estrellas: 4 },
  { comida_id: "b", usuario_id: "u1", estrellas: 3 }, { comida_id: "b", usuario_id: "u3", estrellas: 3 },
  { comida_id: "c", usuario_id: "u1", estrellas: 5 },
];
const comidasSemana = [...del, com("f", "u1", "cena", { creado_en: `${hoy}T21:00:00Z` }), com("g", "u2", "cena")];
pts.push({ comida_id: "f", usuario_id: "u2", estrellas: 5 }, { comida_id: "g", usuario_id: "u1", estrellas: 4 });
const r = rankingSemana({ comidas: comidasSemana, puntajes: pts, perfiles });
assert.deepEqual(r.chefs.map((c) => c.perfil.id), ["u1"], "mejor promedio con 2 platos");
assert.equal(r.plato.comida.id, "a", "plato de la semana: 4,5 con 2 votos");
assert.equal(r.personas.find((p) => p.perfil.id === "u3").platos, 1);
const cant = cantidadesEstrellas({ usuarioId: "u1", comidas: comidasSemana, puntajes: pts, semanasChef: 2 });
assert.deepEqual(cant, { estrellas: 14, cinco: 1, chef: 2, jurado: 3, jurado_dias: 0 });
// Los días puntuando: cada día distinto en que votaste.
const conDias = pts.map((x, n) => ({ ...x, creado_en: `2026-11-${String(20 + (n % 3)).padStart(2, "0")}T15:00:00Z` }));
assert.equal(cantidadesEstrellas({ usuarioId: "u1", comidas: comidasSemana, puntajes: conDias }).jurado_dias, 3);
// La semana pasada ganada se guarda una vez; la que está en curso todavía no.
const pasada = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA");
const viejas = comidasSemana.map((x) => ({ ...x, fecha: pasada }));
const nuevas = semanasChefNuevas({ usuarioId: "u1", comidas: [...viejas, ...comidasSemana], puntajes: pts, perfiles, yaGanadas: [] });
assert.equal(nuevas.length, 1);
assert.match(nuevas[0], /^chef_semana:\d{4}-\d{2}-\d{2}$/);
assert.deepEqual(semanasChefNuevas({ usuarioId: "u1", comidas: viejas, puntajes: pts, perfiles, yaGanadas: nuevas }), []);

// ---------- En la app ----------
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".nuevo-logro, .subida-nivel { display: none !important; }"; document.head.append(s); }));
  await ctx.route(/\/api\//, (rr) => rr.fulfill({ json: { ok: true, enviadas: 0, resultados: [] } }));
  // La guía de novedades se prueba aparte (en el resto ya la vieron).
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); if (!f.__guia) localStorage.setItem("lomada-guia-historias-estrellas", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  return { ctx, p };
}
const visor = (p) => p.locator(".hdia-visor");
// Espera a que termine el pase de una comida a otra (un rato conviven las dos).
const quieto = (p) => p.waitForFunction(() => document.querySelectorAll(".hdia-tipo").length === 1);
const autor = async (p) => { await quieto(p); return visor(p).locator(".hdia-autor > span > strong").innerText(); };
// Un toque en un lado de la historia (a la izquierda vuelve, a la derecha avanza).
async function tocar(p, lado) {
  const caja = await visor(p).locator(".hdia-tipo").last().boundingBox();
  await p.mouse.click(caja.x + caja.width * (lado === "izq" ? 0.12 : 0.8), caja.y + caja.height * 0.45);
  await p.waitForTimeout(350);
}

// 1) Sin el SQL 068: las historias andan, sin estrellas.
let { ctx, p } = await abrir();
const fila = p.locator(".hdias");
await fila.waitFor();
assert.equal(await fila.locator(".hdia").count(), 5);
assert.deepEqual(await fila.locator(".hdia-nombre").allInnerTexts(), ["Desayuno", "Almuerzo", "Merienda", "Cena", "Colación"]);
assert.equal(await fila.locator(".hdia.vacia").count(), 3, "merienda, cena y colación vacías hoy");
await fila.screenshot({ path: "capturas/historias-fila.png" });
await p.screenshot({ path: "capturas/historias-resumen.png" });
await fila.getByRole("button", { name: /^Almuerzo/ }).click();
await visor(p).waitFor();
await p.waitForTimeout(500);
assert.equal(await visor(p).locator(".estrellas").count(), 0, "sin la tabla no hay estrellas");
await p.keyboard.press("Escape");
await visor(p).waitFor({ state: "detached" });
await ctx.close();

// 2) Con estrellas.
({ ctx, p } = await abrir({ __segundosHistoria: 600, __con068: true, __puntajes: [{ comida_id: "c2", usuario_id: "u2", estrellas: 5 }, { comida_id: "c2", usuario_id: "u3", estrellas: 4 }] }));
await p.locator(".hdias").getByRole("button", { name: /^Almuerzo/ }).click();
await visor(p).waitFor();
await p.waitForTimeout(600);
// El almuerzo de hoy, por hora: Juan (12), Steve (13) y Nahuel (13).
const orden = [await autor(p)];
assert.equal(await visor(p).locator(".hdia-barras > span").count(), 3);
await p.screenshot({ path: "capturas/historias-visor-1.png" });
await tocar(p, "der");
orden.push(await autor(p));
await tocar(p, "der");
orden.push(await autor(p));
assert.deepEqual([...orden].sort(), ["Juan", "Nahuel", "Vos"].sort(), orden.join(","));
await tocar(p, "izq");
assert.equal(await autor(p), orden[1], "a la izquierda vuelve");
await tocar(p, "der");
// La de Nahuel: se puntúa.
for (let n = 0; n < 4 && (await autor(p)) !== "Nahuel"; n++) await tocar(p, "izq");
assert.equal(await autor(p), "Nahuel");
await visor(p).getByRole("radio", { name: "4 estrellas" }).click();
await p.waitForTimeout(500);
let guardado = await p.evaluate(() => window.__db.puntajes_comida.find((x) => x.comida_id === "c3" && x.usuario_id === "u1"));
assert.equal(guardado?.estrellas, 4);
assert.equal(await visor(p).locator(".estrella.llena").count(), 4);
await p.screenshot({ path: "capturas/historias-estrellas.png" });
// Tocar la misma la saca.
await visor(p).getByRole("radio", { name: "4 estrellas" }).click();
await p.waitForTimeout(500);
guardado = await p.evaluate(() => window.__db.puntajes_comida.find((x) => x.comida_id === "c3" && x.usuario_id === "u1"));
assert.equal(guardado, undefined);
await visor(p).getByRole("radio", { name: "5 estrellas" }).click();
await p.waitForTimeout(300);
// El desglose de calorías (pausa la historia).
await visor(p).getByRole("button", { name: /Ver calorías/ }).click();
const panel = p.locator(".hdia-panel");
await panel.waitFor();
assert.match(await panel.innerText(), /950/);
await p.waitForTimeout(400);
await p.screenshot({ path: "capturas/historias-detalle.png" });
await panel.getByRole("button", { name: "Cerrar detalle" }).click();
await panel.waitFor({ state: "detached" });
// La propia: el promedio y quién la puntuó.
// (Steve y Nahuel cargaron a la misma hora: se busca la milanesa, 780 kcal, en el almuerzo.)
const pie = async () => { await quieto(p); return visor(p).locator(".hdia-pie").innerText(); };
if (!(await pie()).includes("780")) await tocar(p, "der");
if (!(await pie()).includes("780")) { await tocar(p, "izq"); await tocar(p, "izq"); }
assert.match(await pie(), /780/);
assert.equal(await autor(p), "Vos");
assert.match(await visor(p).locator(".hdia-promedio").innerText(), /4,5\s*· 2 votos/, await visor(p).locator(".hdia-pie").innerText() + " | " + await visor(p).getAttribute("aria-label"));
await p.keyboard.press("Escape");
await visor(p).waitFor({ state: "detached" });

// 3) Pasan solas: en el desayuno (2 historias) a los 6 s pasa a la otra.
await p.evaluate(() => { window.__segundosHistoria = 0; });
await p.locator(".hdias").getByRole("button", { name: /^Desayuno/ }).click();
await visor(p).waitFor();
const primero = await autor(p);
await p.waitForTimeout(6800);
assert.notEqual(await autor(p), primero, "pasó sola");
// Deslizar a la izquierda salta a la otra comida (el almuerzo).
await quieto(p);
const caja = await visor(p).locator(".hdia-tipo").last().boundingBox();
await p.mouse.move(caja.x + caja.width * 0.8, caja.y + caja.height / 2);
await p.mouse.down();
await p.mouse.move(caja.x + caja.width * 0.2, caja.y + caja.height / 2, { steps: 6 });
await p.mouse.up();
await p.waitForTimeout(700);
await quieto(p);
assert.match(await visor(p).getAttribute("aria-label"), /Almuerzo/);
// Hacia abajo se cierra.
const c2 = await visor(p).locator(".hdia-tipo").last().boundingBox();
await p.mouse.move(c2.x + c2.width / 2, c2.y + c2.height * 0.4);
await p.mouse.down();
await p.mouse.move(c2.x + c2.width / 2, c2.y + c2.height * 0.4 + 220, { steps: 8 });
await p.mouse.up();
await visor(p).waitFor({ state: "detached" });
// Ya vistas: el aro gris.
assert.equal(await p.locator(".hdias .hdia.nueva").count(), 0, "todas vistas");

// 4) En Semana: el plato y el chef.
await p.getByRole("tab", { name: "Semana" }).click();
const tarjeta = p.locator(".estrellas-semana");
await tarjeta.waitFor();
assert.match(await tarjeta.innerText(), /plato de la semana[\s\S]*Milanesa con puré/i);
await tarjeta.screenshot({ path: "capturas/historias-semana.png" });
// Una estrella que llega en vivo se suma sola, sin volver a bajar toda la lista.
const lecturas = () => p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "puntajes_comida" && l.op === "select").length);
const antes = await lecturas();
await p.evaluate(() => window.__canalDatos().emitir("puntajes_comida", { eventType: "INSERT", new: { comida_id: "c3", usuario_id: "u4", estrellas: 3 } }));
await p.waitForTimeout(600);
assert.match(await tarjeta.locator(".tabla-estrellas li", { hasText: "Nahuel" }).innerText(), /2 votos/);
assert.equal(await lecturas(), antes, "no se vuelve a bajar la lista");
await p.evaluate(() => window.__canalDatos().emitir("puntajes_comida", { eventType: "DELETE", old: { comida_id: "c3", usuario_id: "u4" } }));
await p.waitForTimeout(600);
assert.match(await tarjeta.locator(".tabla-estrellas li", { hasText: "Nahuel" }).innerText(), /1 voto\b/);
await ctx.close();

// 5) La guía de novedades: sale sola, se pasa con OK, la cruz la cierra y no vuelve a salir.
({ ctx, p } = await abrir({ __con068: true, __guia: true }));
let guia = p.getByRole("dialog", { name: /^Novedades:/ });
await guia.waitFor({ timeout: 8000 });
assert.match(await guia.innerText(), /1 de 5[\s\S]*historias del día/);
await p.waitForTimeout(500);
await p.screenshot({ path: "capturas/guia-1.png" });
const titulos = [];
for (let n = 0; n < 4; n++) {
  titulos.push(await guia.locator("strong").innerText());
  await guia.getByRole("button", { name: "OK" }).click();
  await p.waitForTimeout(450);
}
titulos.push(await guia.locator("strong").innerText());
assert.deepEqual(titulos, ["Nuevo: historias del día", "Cómo se pasan", "Puntuá los platos", "Chef y plato de la semana", "Logros de estrellas"]);
await p.screenshot({ path: "capturas/guia-5.png" });
await guia.getByRole("button", { name: "¡Listo!" }).click();
await guia.waitFor({ state: "detached" });
await p.reload();
await p.waitForTimeout(3500);
assert.equal(await guia.count(), 0, "no vuelve a salir");
await ctx.close();
// La cruz la cierra de una.
({ ctx, p } = await abrir({ __con068: true, __guia: true }));
guia = p.getByRole("dialog", { name: /^Novedades:/ });
await guia.waitFor({ timeout: 8000 });
await guia.getByRole("button", { name: "Cerrar la guía" }).click();
await guia.waitFor({ state: "detached" });
assert.equal(await p.evaluate(() => localStorage.getItem("lomada-guia-historias-estrellas")), "vista");
await ctx.close();
// Sin el SQL 068 no sale (las estrellas todavía no andan).
({ ctx, p } = await abrir({ __guia: true }));
await p.waitForTimeout(3500);
guia = p.getByRole("dialog", { name: /^Novedades:/ });
assert.equal(await guia.count(), 0);
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("historias: pasaron");
