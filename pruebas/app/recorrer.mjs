import { chromium } from "playwright-core";

const URL_APP = "http://localhost:5199";
const SALIDA = new URL("./capturas/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
import fs from "node:fs";
fs.mkdirSync(SALIDA, { recursive: true });

// Contraste real: recorre cada elemento con texto y compara su color contra el fondo opaco que tiene detrás.
const auditarContraste = () => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const lienzo = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const color = (t) => { lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = t; lienzo.fillRect(0, 0, 1, 1); const d = lienzo.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const fondoDe = (el) => {
    const capas = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage !== "none") return null;
      const c = color(cs.backgroundColor);
      if (c[3] > 0) { capas.push(c); if (c[3] === 1) break; }
    }
    let base = capas.length && capas[capas.length - 1][3] === 1 ? capas.pop().slice(0, 3) : [255, 255, 255];
    for (const c of capas.reverse()) base = base.map((v, i) => c[i] * c[3] + v * (1 - c[3]));
    return base;
  };
  const fallas = [];
  for (const el of document.querySelectorAll("body *")) {
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (!texto || !/[\p{L}\p{N}]/u.test(texto)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    if (el.closest(":disabled")) continue;
    const fondo = fondoDe(el);
    if (!fondo) continue;
    const t = color(cs.color);
    const a = lum(t), b = lum(fondo);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(cs.fontSize);
    const minimo = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
    if (ratio < minimo) fallas.push(`${ratio.toFixed(2)} «${texto.slice(0, 32)}» .${el.className}`);
  }
  return fallas;
};

const navegador = await chromium.launch({ channel: "chrome", headless: true });
const resultados = [];

async function recorrer(nombre, viewport, esquema) {
  const ctx = await navegador.newContext({ viewport, colorScheme: esquema, deviceScaleFactor: 2, hasTouch: viewport.width < 600 });
  await ctx.route(/\/api\/whoop/, (r) => r.fulfill({ json: { disponible: true, conectado: true } }));
  await ctx.route(/supabase.co/, (r) => { console.log("BLOQUEADO", r.request().url()); r.abort(); });
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });

  const auditar = async (vista) => {
    await p.waitForTimeout(1300);
    await p.screenshot({ path: `${SALIDA}${nombre}-${vista}.png` });
    const fallas = await p.evaluate(auditarContraste);
    const desborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    resultados.push({ nombre, vista, fallas, desborde });
  };

  await p.addInitScript(() => { window.__sinSesion = true; });
  await p.goto(URL_APP);
  await auditar("login");
  await p.close();

  const a = await ctx.newPage();
  a.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
  a.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  Object.assign(p, {});
  const audit = async (vista) => {
    await a.waitForTimeout(1300);
    await a.screenshot({ path: `${SALIDA}${nombre}-${vista}.png` });
    const fallas = await a.evaluate(auditarContraste);
    const desborde = await a.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    resultados.push({ nombre, vista, fallas, desborde });
  };
  await a.goto(URL_APP);
  await audit("resumen");
  await a.getByRole("button", { name: /Nahuel/ }).first().click();
  await audit("resumen-amigo");
  await a.getByRole("tab", { name: "Semana" }).click();
  await audit("semana");
  await a.getByRole("button", { name: "Muro" }).locator("visible=true").click();
  await audit("muro");
  await a.getByRole("button", { name: "Grupo", exact: true }).locator("visible=true").first().click(); await a.waitForTimeout(350); await a.getByRole("button", { name: /^Chat/ }).locator("visible=true").first().click();
  await audit("chat");
  await a.getByRole("button", { name: "Ajustes", exact: true }).locator("visible=true").click();
  await audit("ajustes");
  await a.getByRole("button", { name: /Subir comida/ }).locator("visible=true").first().click();
  await audit("subir");
  resultados.push({ nombre, vista: "errores-consola", fallas: errores, desborde: 0 });
  await ctx.close();
}

await recorrer("movil-claro", { width: 390, height: 844 }, "light");
await recorrer("movil-oscuro", { width: 390, height: 844 }, "dark");
await recorrer("escritorio-claro", { width: 1360, height: 860 }, "light");
await recorrer("escritorio-oscuro", { width: 1360, height: 860 }, "dark");
await navegador.close();

let malos = 0;
for (const r of resultados) {
  const problema = r.fallas.length || r.desborde > 0;
  if (problema) { malos++; console.log(`✗ ${r.nombre}/${r.vista} desborde=${r.desborde}\n   ${r.fallas.slice(0, 8).join("\n   ")}`); }
}
console.log(`\n${resultados.length - malos}/${resultados.length} revisiones sin problemas`);
