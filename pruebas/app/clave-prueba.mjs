import { chromium } from "playwright-core";

const URL_APP = "http://localhost:5199";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(init, viewport = { width: 390, height: 844 }) {
  const ctx = await b.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: "light" });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false } }));
  await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
  await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto(URL_APP, { timeout: 60000 });
  await p.waitForTimeout(1000);
  return { ctx, p };
}
const sinSesion = () => { window.__sinSesion = true; };
const error = (p) => p.locator(".login .error").innerText();

// Entrar
let { ctx, p } = await abrir(sinSesion);
console.log("abre en:", await p.getByRole("tab", { selected: true }).innerText());
await p.screenshot({ path: "capturas/u-entrar.png" });
await p.getByLabel("Usuario").fill("steve");
await p.getByLabel("Contraseña").fill("mala");
await p.getByRole("button", { name: "Entrar", exact: true }).last().click();
await p.waitForTimeout(350);
console.log("clave mala:", await error(p));
await p.getByLabel("Usuario").fill("bloqueado");
await p.getByRole("button", { name: "Entrar", exact: true }).last().click();
await p.waitForTimeout(350);
console.log("bloqueado:", await error(p));
await p.getByLabel("Usuario").fill("steve");
await p.getByLabel("Contraseña").fill("correcta123");
await p.getByRole("button", { name: "Entrar", exact: true }).last().click();
await p.waitForTimeout(900);
console.log("ingreso:", JSON.stringify(await p.evaluate(() => window.__ingreso)), "| adentro:", await p.locator(".barra-superior .marca").isVisible());
await ctx.close();

// Crear cuenta
({ ctx, p } = await abrir(sinSesion));
await p.getByRole("tab", { name: "Crear cuenta" }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: "capturas/u-crear.png" });
const crear = p.getByRole("button", { name: "Crear cuenta" }).last();
await p.getByLabel("Usuario").fill("no vale");
await p.getByLabel("Contraseña").fill("clave-segura-1");
await p.getByLabel("Mail de recuperación").fill("nuevo@prueba.test");
await p.getByLabel("Código del grupo").fill("mal");
await crear.click(); await p.waitForTimeout(300);
console.log("usuario inválido:", await error(p));
await p.getByLabel("Usuario").fill("Tobi_9");
await p.getByLabel("Contraseña").fill("corta");
await crear.click(); await p.waitForTimeout(300);
console.log("clave corta:", await error(p));
await p.getByLabel("Contraseña").fill("clave-segura-1");
await crear.click(); await p.waitForTimeout(300);
console.log("código malo:", await error(p));
await p.getByLabel("Código del grupo").fill("grupo");
await p.getByLabel("Usuario").fill("ocupado");
await crear.click(); await p.waitForTimeout(300);
console.log("ocupado:", await error(p));
await p.getByLabel("Usuario").fill("Tobi_9");
await crear.click(); await p.waitForTimeout(1000);
console.log("registro:", JSON.stringify(await p.evaluate(() => ({ ...window.__registro, password: window.__registro?.password?.length }))));
console.log("sigue con plan:", await p.getByRole("dialog").getByRole("heading").first().innerText());
await ctx.close();

// Olvidé mi contraseña
({ ctx, p } = await abrir(sinSesion));
await p.getByRole("button", { name: "Olvidé mi contraseña" }).click();
await p.waitForTimeout(300);
await p.getByLabel("Tu mail de recuperación").fill("yo@prueba.test");
await p.getByRole("button", { name: "Mandame el link" }).click();
await p.waitForTimeout(400);
console.log("recuperación:", JSON.stringify(await p.evaluate(() => window.__recuperacion)), "|", (await p.locator(".login-enviado").innerText()).replace(/\n+/g, " | "));
await ctx.close();

// Vuelta desde el mail de recuperación
({ ctx, p } = await abrir(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); }));
await p.evaluate(() => window.__auth().disparar("PASSWORD_RECOVERY"));
await p.waitForTimeout(600);
console.log("pide:", await p.getByRole("dialog").getByRole("heading").innerText());
await p.getByLabel("Contraseña nueva").fill("clave-segura-2");
await p.getByLabel("Repetila").fill("clave-segura-2");
await p.getByRole("button", { name: "Guardar contraseña" }).click();
await p.waitForTimeout(700);
console.log("clave cambiada:", JSON.stringify(await p.evaluate(() => Object.keys(window.__claveNueva))), "| hoja cerrada:", (await p.getByRole("dialog").count()) === 0);

await p.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").first().click();
await p.waitForTimeout(500);
console.log("cuenta:", (await p.locator(".ajuste", { hasText: "Mail de recuperación" }).first().innerText()).replace(/\n+/g, " | "));
await ctx.close();

// Sesión guardada
({ ctx, p } = await abrir(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); }));
await p.reload(); await p.waitForTimeout(900);
console.log("sigue con sesión:", await p.locator(".barra-superior .marca").isVisible());
await ctx.close();

// Registro en el celular más chico
({ ctx, p } = await abrir(sinSesion, { width: 320, height: 568 }));
await p.getByRole("tab", { name: "Crear cuenta" }).click();
await p.waitForTimeout(400);
const caja = await p.getByRole("button", { name: "Crear cuenta" }).last().boundingBox();
const alto = await p.evaluate(() => ({ pagina: document.documentElement.scrollHeight, ventana: innerHeight, ancho: document.documentElement.scrollWidth - innerWidth, primero: document.querySelector(".login-tarjeta").getBoundingClientRect().top }));
await p.getByRole("button", { name: "Crear cuenta" }).last().scrollIntoViewIfNeeded();
await p.screenshot({ path: "capturas/u-crear-320.png", fullPage: true });
console.log("320:", JSON.stringify({ ...alto, boton: Math.round(caja.y) }));
await ctx.close();

await b.close();
console.log("errores:", errores);
