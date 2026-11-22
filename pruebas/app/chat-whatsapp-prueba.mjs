// El chat con tamaños de WhatsApp: letra de 16 px, burbujas de esquinas chicas con colita en la primera de cada tanda,
// la hora en el renglón del texto, la barra de abajo finita; y sin logros en el chat.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];

for (const tema of ["lomada", "negro"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: { ok: true } }));
  await ctx.addInitScript((t) => { localStorage.setItem("comidas-bienvenida", "vista"); localStorage.setItem("comidas-tema", t); }, tema);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  await p.goto("http://localhost:5199/?vista=chat");
  await p.locator(".chat-fila").first().waitFor();
  await p.waitForTimeout(1200);

  const estilo = await p.evaluate(() => {
    const burbuja = [...document.querySelectorAll(".chat-fila .burbuja")].find((x) => x.querySelector(":scope > p") && x.querySelector(":scope > time"));
    const cs = getComputedStyle(burbuja);
    const hora = getComputedStyle(burbuja.querySelector(":scope > time"));
    const campo = document.querySelector(".chat-enviar input");
    const inicio = document.querySelector(".chat-fila.inicio .burbuja:not(.burbuja-sticker)");
    return {
      letra: cs.fontSize,
      esquina: cs.borderBottomLeftRadius,
      hora: hora.position,
      horaLetra: hora.fontSize,
      campo: campo.getBoundingClientRect().height,
      colita: inicio ? getComputedStyle(inicio, "::before").content : null,
    };
  });
  assert.equal(estilo.letra, "16px");
  assert.equal(estilo.esquina, "8px");
  assert.equal(estilo.hora, "absolute", "la hora va en el renglón del texto");
  assert.equal(estilo.horaLetra, "11px");
  assert.ok(estilo.campo <= 42, `barra finita (${estilo.campo})`);
  assert.equal(estilo.colita, '""', "colita en la primera de la tanda");
  assert.equal(await p.locator(".chat-logro").count(), 0, "sin logros en el chat");
  // Que se vaya el cartel del logro antes de la foto.
  await p.waitForTimeout(4500);
  await p.screenshot({ path: `capturas/chat-wa-${tema}.png` });
  await ctx.close();
}

await b.close();
assert.deepEqual(errores, []);
console.log("chat como WhatsApp: pasaron");
