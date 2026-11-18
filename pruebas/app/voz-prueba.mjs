import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const pedidos = [];

async function abrir(respuesta) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/\/api\/reconocer/, (r) => { pedidos.push(r.request().postDataJSON()); r.fulfill(respuesta); });
  await ctx.addInitScript(() => {
    localStorage.setItem("comidas-bienvenida", "vista");
    // Un reconocedor de voz de mentira: "escucha" la frase que deje la prueba.
    window.SpeechRecognition = class {
      start() {
        setTimeout(() => {
          const frase = window.__frase || "";
          this.onresult?.({ results: [[{ transcript: frase }]] });
          setTimeout(() => this.onend?.(), 150);
        }, 300);
      }
      stop() { this.onend?.(); }
      abort() {}
    };
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199");
  await p.waitForTimeout(1200);
  await p.locator(".boton-subir").click();
  await p.getByRole("heading", { name: "Subir comida" }).waitFor();
  await p.waitForTimeout(400);
  return { ctx, p };
}

// 1) Con la IA: decís la comida y se arma sola.
let { ctx, p } = await abrir({ json: { esComida: true, titulo: "Empanadas con ensalada", alimentos: [
  { nombre: "Empanada de carne", gramos: 180, unidades: 2, por100: { kcal: 290, p: 11, c: 28, g: 15 } },
  { nombre: "Ensalada de lechuga y tomate", gramos: 150, unidades: null, por100: { kcal: 20, p: 1, c: 4, g: 0.2 } },
] } });
await p.evaluate(() => { window.__frase = "dos empanadas de carne y una ensalada de lechuga y tomate"; });
await p.getByRole("button", { name: "Dictar la comida" }).click();
await p.screenshot({ path: "capturas/voz-panel.png" });
await p.getByRole("button", { name: /Tocá y decí qué comiste/ }).click();
await p.locator(".nota-ia").waitFor();
await p.waitForTimeout(600);
assert.equal(pedidos.at(-1).modo, "texto");
assert.equal(pedidos.at(-1).texto, "dos empanadas de carne y una ensalada de lechuga y tomate");
const filas = await p.locator(".fila-item").allInnerTexts();
console.log("con IA:", filas.map((f) => f.split("\n").slice(0, 2).join(" ")).join(" / "));
assert.equal(filas.length, 2);
assert.ok(filas.every((f) => /dictado/.test(f)));
assert.match(await p.locator(".nota-ia").innerText(), /Lo cargamos con lo que dictaste/);
assert.equal(await p.getByLabel("Nota de la comida").inputValue(), "Empanadas con ensalada");
await p.screenshot({ path: "capturas/voz-cargado.png" });
await ctx.close();

// 2) Sin IA: se arma con la lista argentina y avisa lo que no encontró.
({ ctx, p } = await abrir({ status: 503, json: { error: "no" } }));
await p.getByRole("button", { name: "Dictar la comida" }).click();
await p.getByLabel("Lo que comiste, en una frase").fill("dos empanadas de carne, 200 gramos de pechuga de pollo y un alfajor triple marciano");
await p.getByRole("button", { name: "Cargar estos alimentos" }).click();
await p.locator(".nota-ia").waitFor();
const sinIA = await p.locator(".fila-item").allInnerTexts();
console.log("sin IA:", sinIA.map((f) => f.split("\n").slice(0, 2).join(" ")).join(" / "));
assert.equal(sinIA.length, 2);
assert.match(await p.locator(".nota-ia").innerText(), /No encontramos: un alfajor triple marciano/);
await p.locator(".enlace-buscar").click();
await p.waitForTimeout(300);
assert.equal(await p.getByLabel("Buscar alimento o producto").inputValue(), "un alfajor triple marciano");
await ctx.close();

assert.deepEqual(errores, []);
await b.close();
console.log("voz: pruebas pasadas");
