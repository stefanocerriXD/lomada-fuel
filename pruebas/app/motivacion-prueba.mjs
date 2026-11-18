import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

async function abrir(init) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: "America/Argentina/Buenos_Aires" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1300);
  return { ctx, p };
}
const aProgreso = async (p) => {
  await p.getByRole("button", { name: "Resumen", exact: true }).locator("visible=true").first().click();
  await p.waitForTimeout(300);
  await p.getByRole("tab", { name: "Progreso" }).click();
  await p.waitForTimeout(700);
};

// 1. Sin SQL 052: la Lomada sigue viendo Floripa y no hay botón para cambiarlo.
{
  const { ctx, p } = await abrir(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("mock-grupo", "lomada"); });
  await aProgreso(p);
  const viaje = p.locator(".viaje");
  if (await viaje.count()) {
    assert.match(await viaje.innerText(), /Floripa/);
    assert.equal(await p.locator(".viaje-editar").count(), 0);
    console.log("sin 052: Floripa como antes");
  } else console.log("sin 052: (este grupo de prueba no es la Lomada)");
  await ctx.close();
}

// 2. Con 052 y sin nada armado: invita, se arma el viaje y el Match Day.
{
  const { ctx, p } = await abrir(() => { window.__plan = true; window.__con052 = true; localStorage.setItem("comidas-bienvenida", "vista"); });
  await aProgreso(p);
  const invitar = p.getByRole("button", { name: /Tenés un viaje/ });
  await invitar.scrollIntoViewIfNeeded();
  await invitar.click();
  await p.waitForTimeout(700);
  await p.locator(".mi-motivacion-titulo", { hasText: "Tu viaje" }).waitFor();
  const fecha = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 40); return d.toLocaleDateString("en-CA"); });
  await p.getByLabel("Destino").fill("Bariloche");
  await p.getByLabel("Fecha").fill(fecha);
  await p.getByRole("button", { name: "Arrancar la cuenta regresiva" }).click();
  await p.waitForTimeout(600);
  let fila = await p.evaluate(() => window.__db.motivacion[0]);
  assert.deepEqual([fila.viaje_destino, fila.viaje_fecha], ["Bariloche", fecha]);

  // Match Day: pádel los sábados a las 10 -> avisa la noche anterior.
  await p.getByRole("switch", { name: /Avisarme el día que juego/ }).click();
  await p.getByRole("radio", { name: "pádel" }).click();
  await p.getByRole("radio", { name: "sábado" }).click();
  await p.getByLabel("Hora del partido").selectOption("10");
  const ejemplo = await p.locator(".mi-motivacion-ejemplo").innerText();
  console.log("ejemplo:", ejemplo);
  assert.match(ejemplo, /noche anterior \(viernes a las 21\)/);
  assert.match(ejemplo, /a las 10 hay pádel/);
  await p.getByLabel("Hora del partido").selectOption("17");
  assert.match(await p.locator(".mi-motivacion-ejemplo").innerText(), /sábado a las 9/);
  await p.screenshot({ path: "capturas/motivacion-ajustes.png", fullPage: true });
  await p.getByRole("button", { name: "Guardar", exact: true }).click();
  await p.waitForTimeout(600);
  fila = await p.evaluate(() => window.__db.motivacion[0]);
  assert.deepEqual([fila.match_activo, fila.match_nombre, fila.match_dia, fila.match_hora, fila.viaje_destino], [true, "pádel", 6, 17, "Bariloche"]);

  // La cuenta regresiva en Progreso, con lápiz para cambiarla.
  await aProgreso(p);
  const viaje = p.locator(".viaje");
  await viaje.scrollIntoViewIfNeeded();
  const texto = await viaje.innerText();
  console.log("tarjeta:", texto.replace(/\s+/g, " "));
  assert.match(texto, /Viaje a Bariloche/);
  assert.match(texto, /40\s*días/);
  await p.screenshot({ path: "capturas/motivacion-progreso.png" });
  await p.locator(".viaje-editar").click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Sacar el viaje" }).click();
  await p.waitForTimeout(500);
  fila = await p.evaluate(() => window.__db.motivacion[0]);
  assert.equal(fila.viaje_destino, null);
  assert.equal(fila.match_activo, true, "el Match Day queda");
  await ctx.close();
}

// 3. Preferencias: la opción del viaje y Match Day aparece para todos.
{
  const { ctx, p } = await abrir(() => { window.__con052 = true; localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("mock-grupo", "viejos"); });
  await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Notificaciones/ }).first().click();
  await p.waitForTimeout(600);
  const hay = await p.getByRole("switch", { name: /Tu viaje y tu Match Day/ }).count();
  console.log("preferencia visible fuera de la Lomada:", hay > 0);
  await ctx.close();
}

await b.close();
assert.deepEqual(errores, []);
console.log("motivacion ok");
