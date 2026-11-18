import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
async function abrir(f) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: {} }));
  await ctx.addInitScript((f) => { window.__sinSesion = true; Object.assign(window, f); }, f);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199"); await p.waitForTimeout(1200);
  return { ctx, p };
}
// Crear cuenta: pide confirmar el mail
let { ctx, p } = await abrir({ __confirmarMail: true });
await p.getByRole("tab", { name: "Crear cuenta" }).click();
await p.getByLabel("Usuario").fill("nuevito");
await p.getByLabel("Contraseña").fill("clave12345");
await p.getByLabel("Mail de recuperación").fill("nuevo@prueba.test");
await p.getByRole("button", { name: /Crear cuenta/ }).last().click();
await p.getByText("Confirmá tu mail").waitFor();
assert.match(await p.locator(".login-enviado").innerText(), /nuevo@prueba\.test/);
assert.equal(await p.evaluate(() => window.__registro.options.emailRedirectTo), "http://localhost:5199");
await p.getByRole("button", { name: "Reenviar el mail" }).click(); await p.waitForTimeout(300);
assert.deepEqual(await p.evaluate(() => window.__reenvios.map((r) => [r.type, r.email])), [["signup", "nuevo@prueba.test"]]);
await p.screenshot({ path: "capturas/mail-confirmar.png" });
await p.getByRole("button", { name: /Ya lo confirmé/ }).click();
await p.getByRole("tab", { name: "Entrar" }).waitFor();
await ctx.close();
// Entrar sin haber confirmado
({ ctx, p } = await abrir({ __mailSinConfirmar: true }));
await p.getByLabel("Usuario").fill("algo");
await p.getByLabel("Contraseña").fill("correcta123");
await p.getByRole("button", { name: /^Entrar/ }).last().click();
await p.getByText("Confirmá tu mail").waitFor();
assert.match(await p.locator(".login-enviado").innerText(), /yo@prueba\.test/);
await ctx.close();
assert.deepEqual(errores, []);
console.log("mail ok");
await b.close();
