// Foto de perfil (SQL 066): se elige, se encuadra (mover y acercar) y queda cuadrada dentro del marco;
// tocando el avatar se ve en grande; la tuya se cambia o se saca. Sin el SQL, avisa.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { encuadre } from "../../src/lib/encuadre.js";

// La cuenta del encuadre: siempre tapa todo el cuadrado.
let e = encuadre({ w: 800, h: 400, lado: 300 });
assert.deepEqual([e.ancho, e.alto, e.origen.lado, e.origen.x, e.origen.y], [600, 300, 400, 200, 0], "una apaisada: el centro");
e = encuadre({ w: 800, h: 400, lado: 300, dx: 1000 });
assert.deepEqual([e.dx, e.origen.x], [150, 0], "no se puede correr más allá del borde");
e = encuadre({ w: 800, h: 400, lado: 300, zoom: 2, dy: -500 });
assert.deepEqual([e.dy, e.origen.lado, e.origen.y], [-150, 200, 200], "acercada: abajo de todo");
assert.equal(encuadre({ w: 100, h: 100, lado: 300, zoom: 9 }).zoom, 4, "zoom con tope");

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(flags = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
  await ctx.addInitScript((f) => { localStorage.setItem("comidas-bienvenida", "vista"); Object.assign(window, f); }, flags);
  const p = await ctx.newPage();
  p.on("pageerror", (x) => errores.push(x.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1500);
  // El festejo de "Nuevo logro" tapa todo un par de segundos.
  await p.locator(".nuevo-logro").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  return { ctx, p };
}
// Una foto apaisada: mitad izquierda roja, mitad derecha azul.
async function fotoDePrueba(p) {
  const base64 = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 600;
    const x = c.getContext("2d");
    x.fillStyle = "#d00"; x.fillRect(0, 0, 600, 600);
    x.fillStyle = "#00d"; x.fillRect(600, 0, 600, 600);
    // Un poco de dibujo para mirar las capturas (el centro de cada mitad queda de su color).
    x.fillStyle = "#ffd29a"; x.beginPath(); x.arc(900, 250, 120, 0, 7); x.fill();
    x.fillStyle = "#4a2a12"; x.fillRect(780, 120, 240, 50);
    x.fillStyle = "#fff"; x.beginPath(); x.arc(860, 240, 14, 0, 7); x.arc(940, 240, 14, 0, 7); x.fill();
    x.fillStyle = "#00d"; x.fillRect(880, 280, 40, 40);
    return c.toDataURL("image/png").split(",")[1];
  });
  return { name: "yo.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}
// El color del centro y el tamaño de una imagen ya cargada.
const leerFoto = (loc) => loc.evaluate(async (img) => {
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const [r, , bl] = x.getImageData(c.width / 2, c.height / 2, 1, 1).data;
  return { w: img.naturalWidth, h: img.naturalHeight, color: r > bl ? "rojo" : "azul" };
});

// 1) Sin el SQL 066: se puede elegir, pero avisa que falta.
let { ctx, p } = await abrir();
await p.getByRole("button", { name: "Tu perfil" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: "Poner foto de perfil" }).click();
let elegir = p.waitForEvent("filechooser", { timeout: 8000 });
await p.getByRole("dialog", { name: /^Foto de / }).getByRole("button", { name: "Poner foto" }).click();
await (await elegir).setFiles(await fotoDePrueba(p));
await p.waitForTimeout(800);
await p.getByRole("button", { name: "Usar esta foto" }).click();
await p.getByText(/falta el SQL 066/).first().waitFor({ timeout: 5000 });
await ctx.close();

// 2) Con el SQL: desde mi perfil, tocar el avatar → "Poner foto" → encuadrar (corrida a la derecha y acercada).
({ ctx, p } = await abrir({ __con066: true }));
await p.getByRole("button", { name: "Tu perfil" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: "Poner foto de perfil" }).click();
const grande = p.getByRole("dialog", { name: /^Foto de / });
await grande.waitFor();
elegir = p.waitForEvent("filechooser");
await grande.getByRole("button", { name: "Poner foto" }).click();
await (await elegir).setFiles(await fotoDePrueba(p));
const hoja = p.getByRole("dialog", { name: "Tu foto de perfil" });
await hoja.locator(".recorte img").waitFor();
await p.waitForTimeout(500);
// Arrastro la foto a la izquierda: queda en el centro la parte azul.
const area = await hoja.locator(".recorte").boundingBox();
await p.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
await p.mouse.down();
await p.mouse.move(area.x + 10, area.y + area.height / 2, { steps: 8 });
await p.mouse.up();
await hoja.getByLabel("Acercar la foto").fill("1.5");
await p.waitForTimeout(500);
// La vista previa dentro del marco.
assert.equal(await hoja.locator(".recorte-vista .avatar-foto").count(), 2, "se ve cómo queda");
await hoja.screenshot({ path: "capturas/foto-perfil-encuadre.png" });
await hoja.getByRole("button", { name: "Usar esta foto" }).click();
await p.waitForTimeout(1200);
const guardada = await p.evaluate(() => window.__db.perfiles.find((x) => x.id === "u1").foto_path);
assert.match(guardada, /^u1\/perfil\/\d+\.jpg$/);
assert.ok(await p.evaluate(() => window.__subidas.some((s) => s.ruta.includes("/perfil/") && s.contentType === "image/jpeg")));
// En la cabecera del perfil: la foto, cuadrada, con lo azul en el centro.
const enCabecera = p.locator(".perfil-cabecera .avatar-foto");
await enCabecera.waitFor();
assert.deepEqual(await leerFoto(enCabecera), { w: 720, h: 720, color: "azul" });
await p.locator(".perfil-cabecera").screenshot({ path: "capturas/foto-perfil-cabecera.png" });

// 3) Tocarla la abre en grande.
await p.getByRole("button", { name: /Ver foto de perfil de/ }).click();
await grande.waitFor();
assert.equal(await grande.locator("img").count(), 1);
await p.waitForTimeout(700);
await p.screenshot({ path: "capturas/foto-perfil-grande.png" });

// 4) Cambiarla: se sube otra y la anterior se borra.
elegir = p.waitForEvent("filechooser");
await grande.getByRole("button", { name: "Cambiar foto" }).click();
await (await elegir).setFiles(await fotoDePrueba(p));
await hoja.locator(".recorte img").waitFor();
await p.waitForTimeout(300);
await hoja.getByRole("button", { name: "Usar esta foto" }).click();
await p.waitForTimeout(1200);
const nueva = await p.evaluate(() => window.__db.perfiles.find((x) => x.id === "u1").foto_path);
assert.notEqual(nueva, guardada);
assert.ok(await p.evaluate((r) => window.__quitados.includes(r), guardada), "la vieja se borra");

// 5) Sacarla (con confirmación): vuelve la inicial.
await p.getByRole("button", { name: /Ver foto de perfil de/ }).click();
await grande.getByRole("button", { name: "Sacar" }).click();
await grande.getByRole("button", { name: "¿Sacarla?" }).click();
await p.waitForTimeout(900);
assert.equal(await p.evaluate(() => window.__db.perfiles.find((x) => x.id === "u1").foto_path), null);
assert.equal(await p.locator(".perfil-cabecera .avatar-foto").count(), 0);
assert.equal(await p.locator(".perfil-cabecera .avatar-letra").count(), 1);
await ctx.close();

// 6) La de otro: se ve en su tarjeta y en su perfil; se abre en grande, sin botones para cambiarla.
({ ctx, p } = await abrir({ __con066: true, __fotoNahuel: true }));
const nahuel = p.locator(".tarjeta-amigo", { hasText: "Nahuel" });
await nahuel.scrollIntoViewIfNeeded();
assert.equal(await nahuel.locator(".avatar-foto").count() > 0, true, "en Resumen");
await nahuel.locator(".amigo-cabecera").click();
await p.waitForTimeout(400);
await nahuel.getByRole("button", { name: /Ver perfil/ }).click();
await p.waitForTimeout(800);
await p.getByRole("button", { name: "Ver foto de perfil de Nahuel" }).click();
const deNahuel = p.getByRole("dialog", { name: "Foto de Nahuel" });
await deNahuel.waitFor();
assert.equal(await deNahuel.locator("img").count(), 1);
assert.equal(await deNahuel.getByRole("button", { name: /Cambiar|Sacar|Poner/ }).count(), 0, "no es tuya");
await p.keyboard.press("Escape");
await p.waitForTimeout(500);
assert.equal(await deNahuel.count(), 0);
await ctx.close();

// 7) Desde Ajustes también se pone.
({ ctx, p } = await abrir({ __con066: true }));
await p.getByRole("button", { name: /Ajustes|Config/ }).last().click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Tu perfil Foto, nombre/ }).click();
await p.waitForTimeout(500);
elegir = p.waitForEvent("filechooser");
await p.locator(".perfil-vista").getByRole("button", { name: "Poner foto de perfil" }).click();
await (await elegir).setFiles(await fotoDePrueba(p));
const hojaAjustes = p.getByRole("dialog", { name: "Tu foto de perfil" });
await hojaAjustes.locator(".recorte img").waitFor();
await p.waitForTimeout(300);
await hojaAjustes.getByRole("button", { name: "Usar esta foto" }).click();
await p.waitForTimeout(1200);
assert.equal(await p.locator(".perfil-vista .avatar-foto").count(), 1);
await p.locator(".perfil-vista").screenshot({ path: "capturas/foto-perfil-ajustes.png" });
await ctx.close();

await b.close();
assert.deepEqual(errores, []);
console.log("foto de perfil: pasaron");
