// Videos de recetas: se pega el link (aunque venga con texto), se reconoce la red, se ve marcado y aparte de las recetas propias.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/ytimg\.com/, (r) => r.fulfill({ status: 404, body: "" }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199/?vista=ajustes");
  await p.waitForTimeout(1200);
  await p.locator(".menu-ajustes button", { hasText: "Mis recetas" }).click();
  await p.waitForTimeout(500);
  return { ctx, p };
}

// 1) Sin el SQL 061 no aparece la sección.
let { ctx, p } = await abrir();
assert.equal(await p.locator(".videos-recetas").count(), 0);
await ctx.close();

// 2) Agregar uno de TikTok pegando lo que comparte la app (texto + link).
({ ctx, p } = await abrir({
  __con061: true,
  __videos: [{ id: "v9", usuario_id: "u3", url: "https://www.youtube.com/shorts/AbCdEf12345", titulo: "Wok de pollo", red: "youtube", compartida: true, creado_en: "2026-11-18T12:00:00Z" }],
}));
const seccion = p.locator(".videos-recetas");
await seccion.waitFor();
// El del grupo: marcado como YouTube, de quién es, y abre el link afuera.
const deJuan = seccion.locator(".lista-videos li", { hasText: "Wok de pollo" });
assert.match(await deJuan.innerText(), /YouTube[\s\S]*Wok de pollo[\s\S]*De /);
const enlace = deJuan.locator("a.video-receta");
assert.equal(await enlace.getAttribute("href"), "https://www.youtube.com/shorts/AbCdEf12345");
assert.equal(await enlace.getAttribute("target"), "_blank");
assert.equal(await deJuan.getByRole("button", { name: /Borrar/ }).count(), 0, "lo de otro no se borra");

await seccion.getByRole("button", { name: "Agregar video" }).click();
const link = p.getByLabel("Link del video");
await link.fill("hola");
assert.match(await p.locator(".nuevo-video [role=status]").innerText(), /No encontré un link/);
await link.fill("Mirá este video de @cocinafit en TikTok https://vm.tiktok.com/ZMabc123/ #receta");
assert.match(await p.locator(".nuevo-video [role=status]").innerText(), /TikTok/);
assert.equal(await p.getByLabel("Nombre del video").getAttribute("placeholder"), "Receta de TikTok");
await p.getByLabel("Nombre del video").fill("Budín proteico sin horno");
await p.screenshot({ path: "capturas/video-receta-nuevo.png" });
await p.getByRole("button", { name: "Guardar video" }).click();
await p.waitForTimeout(600);
const guardado = await p.evaluate(() => window.__db.recetas_videos[0]);
assert.deepEqual([guardado.url, guardado.red, guardado.titulo, guardado.compartida], ["https://vm.tiktok.com/ZMabc123/", "tiktok", "Budín proteico sin horno", true]);
const mio = seccion.locator(".lista-videos li", { hasText: "Budín proteico" });
assert.match(await mio.innerText(), /TikTok[\s\S]*Budín proteico sin horno[\s\S]*Tuyo/);
// No se mezcla con las recetas propias (no entra en la lista de recetas ni en el buscador de comidas).
assert.equal(await p.locator(".lista-recetas li", { hasText: "Budín proteico" }).count(), 0);
await seccion.scrollIntoViewIfNeeded();
await seccion.screenshot({ path: "capturas/videos-recetas.png" });

// Sin nombre: "Receta de Instagram".
await seccion.getByRole("button", { name: "Agregar video" }).click();
await p.getByLabel("Link del video").fill("https://www.instagram.com/reel/C1234abcd/?igsh=xyz");
await p.getByText("Que lo vea el grupo").click();
await p.getByRole("button", { name: "Guardar video" }).click();
await p.waitForTimeout(600);
assert.match(await seccion.locator(".lista-videos li").first().innerText(), /Instagram[\s\S]*Receta de Instagram[\s\S]*solo vos/);

// Borrar pide confirmar.
const borrar = mio.getByRole("button", { name: /Borrar el video/ });
await borrar.click();
assert.equal(await p.evaluate(() => window.__db.recetas_videos.length), 3, "el primer toque no borra");
await mio.getByRole("button", { name: /Tocá de nuevo/ }).click();
await p.waitForTimeout(400);
assert.equal(await p.evaluate(() => window.__db.recetas_videos.length), 2);
assert.equal(await seccion.locator(".lista-videos li", { hasText: "Budín proteico" }).count(), 0);
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("videos de recetas: pasaron");
