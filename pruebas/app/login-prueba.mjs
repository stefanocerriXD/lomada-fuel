import fs from "node:fs";
import { chromium } from "playwright-core";

const fuente = fs.readFileSync("recorrer.mjs", "utf8");
const auditar = fuente.slice(fuente.indexOf("const auditarContraste"), fuente.indexOf("const navegador")).replace("const auditarContraste = ", "").trim().replace(/;$/, "");
const b = await chromium.launch({ channel: "chrome", headless: true });
const tamanos = [
  ["320", { width: 320, height: 568 }, "light"],
  ["360", { width: 360, height: 740 }, "dark"],
  ["390", { width: 390, height: 844 }, "light"],
  ["430", { width: 430, height: 932 }, "dark"],
  ["horizontal", { width: 844, height: 390 }, "light"],
  ["tablet", { width: 768, height: 1024 }, "dark"],
  ["escritorio", { width: 1440, height: 900 }, "light"],
];
const problemas = [];
for (const [nombre, viewport, esquema] of tamanos) {
  const ctx = await b.newContext({ viewport, isMobile: viewport.width < 800, hasTouch: viewport.width < 800, deviceScaleFactor: 2, colorScheme: esquema });
  await ctx.route(/supabase\.co/, (r) => r.abort());
  await ctx.addInitScript(() => { window.__sinSesion = true; });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => problemas.push(`error: ${e.message}`));
  await p.goto("http://localhost:5199", { timeout: 60000 });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `capturas/l-${nombre}.png` });
  const fallas = await p.evaluate(`(${auditar})()`);
  const datos = await p.evaluate(() => {
    const c = document.querySelector(".login-tarjeta").getBoundingClientRect();
    const f = document.querySelector(".login-foto img").getBoundingClientRect();
    const boton = document.querySelector(".login-tarjeta button").getBoundingClientRect();
    return { tarjetaArriba: Math.round(c.top), tarjetaAbajo: Math.round(c.bottom), fotoAlto: Math.round(f.height), fotoAncho: Math.round(f.width), boton: Math.round(boton.bottom), alto: innerHeight, scroll: document.documentElement.scrollWidth - innerWidth };
  });
  // Los platos están cerca del 55% de la altura de la foto.
  const platos = datos.fotoAlto * 0.6;
  console.log(nombre, JSON.stringify(datos), viewport.width > viewport.height ? "" : `platos visibles: ${platos < datos.tarjetaArriba}`);
  if (fallas.length) problemas.push(`${nombre}: ${fallas.slice(0, 3).join(" ; ")}`);
  if (datos.scroll > 0) problemas.push(`${nombre}: desborde`);
  if (datos.boton > datos.alto && viewport.height > 500) problemas.push(`${nombre}: botón fuera de pantalla`);
  await ctx.close();
}
await b.close();
console.log(`${problemas.length} problemas`);
problemas.forEach((x) => console.log(" -", x));
