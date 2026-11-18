import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, json: { error: "sin ia" } }));
await ctx.addInitScript(() => { localStorage.setItem("comidas-bienvenida", "vista"); window.__fiestas = true; });
const p = await ctx.newPage();
p.on("pageerror", (e) => errores.push(e.message));
await p.goto("http://localhost:5199");
await p.waitForTimeout(1200);
await p.getByRole("button", { name: /^Grupo/ }).locator("visible=true").first().click();
await p.waitForTimeout(500);
await p.getByRole("tab", { name: "Imágenes" }).click();
await p.waitForTimeout(700);

// Hoy: la fiesta de anoche sigue, primera, sin foto pero con todo.
const cabeceras = await p.locator(".grupo-fotos-cabecera").allInnerTexts();
console.log(cabeceras.map((t) => t.replace(/\n/g, " | ")));
assert.match(cabeceras[0], /Fiesta[\s\S]*Anoche · Nahuel · ⚽ 1 gol/);
assert.ok(!cabeceras.join(" ").includes("Juan"), "la de hace dos noches ya no");
await p.locator(".grupo-fiesta .grupo-fotos-cabecera").click();
await p.waitForTimeout(800);
const tarjeta = p.locator(".tarjeta.comida", { hasText: "Fiesta: 4 vasos" });
const texto = await tarjeta.innerText();
assert.match(texto, /3 ×\s*Fernet con coca/);
assert.match(texto, /1 ×\s*Gin tonic/);
assert.match(texto, /720 kcal/);
assert.match(texto, /92 g de alcohol/);
assert.match(texto, /Hubo gol/);
assert.match(await tarjeta.locator(".cartel-gol").innerText(), /HUBO GOL/);
assert.equal(await tarjeta.getByRole("button", { name: /Ver alimentos/ }).count(), 0, "los tragos ya están a la vista");
await p.screenshot({ path: "capturas/fiesta-grupo.png" });

// Un día atrás (la noche misma) también está.
await p.getByRole("button", { name: "Día anterior" }).click();
await p.waitForTimeout(700);
let todas = (await p.locator(".grupo-fotos-cabecera").allInnerTexts()).join(" ");
assert.match(todas, /Juan, Nahuel|Nahuel, Juan/, "la de esa noche y la de la noche anterior");
// Dos días atrás: solo la de Juan.
await p.getByRole("button", { name: "Día anterior" }).click();
await p.waitForTimeout(700);
todas = (await p.locator(".grupo-fotos-cabecera").allInnerTexts()).join(" ");
assert.match(todas, /Juan/);
assert.ok(!todas.includes("Nahuel"));

assert.deepEqual(errores, []);
await b.close();
console.log("fiesta en el grupo: pruebas pasadas");
