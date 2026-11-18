import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const fuente = fs.readFileSync("recorrer.mjs", "utf8");
const contraste = fuente.slice(fuente.indexOf("const auditarContraste"), fuente.indexOf("const navegador"));
const auditarContraste = eval(`(${contraste.replace("const auditarContraste = ", "").trim().replace(/;$/, "")})`);
const auditarTamanos = () => {
  const chicos = [];
  for (const el of document.querySelectorAll("button:not(.grafico-columna), a[href], input:not([type=file]):not([type=checkbox]), summary")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    if (r.height < 36 || r.width < 36) chicos.push(`${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName}.${el.className || el.getAttribute("aria-label") || ""}`);
  }
  return [...new Set(chicos)];
};

const b = await chromium.launch({ channel: "chrome", headless: true });
const errores = [];
const problemas = [];
const avisos = [];

async function abrir(viewport, esquema = "light", url = "http://localhost:5199") {
  const ctx = await b.newContext({ viewport, isMobile: viewport.width < 800, hasTouch: true, deviceScaleFactor: 2, colorScheme: esquema });
  await ctx.route(/\/api\/notificar/, (r) => { avisos.push(r.request().postDataJSON()); r.fulfill({ json: { enviadas: 1 } }); });
  await ctx.route(/\/api\/(whoop|alimentos)/, (r) => r.fulfill({ json: { disponible: false, conectado: false, resultados: [] } }));
  await ctx.route(/supabase\.co/, (r) => { errores.push(`salida real: ${r.request().url()}`); r.abort(); });
  await ctx.addInitScript(() => { window.__plan = true; localStorage.setItem("comidas-bienvenida", "vista"); });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load/.test(m.text())) errores.push(m.text().slice(0, 220)); });
  await p.goto(url, { timeout: 60000 });
  await p.waitForTimeout(900);
  return { ctx, p };
}

const revisar = async (p, nombre) => {
  await p.waitForTimeout(450);
  await p.screenshot({ path: `capturas/g-${nombre}.png` });
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (ancho > 1) problemas.push(`${nombre}: se desborda ${ancho}px`);
  const des = await p.evaluate(auditarContraste);
  des.slice(0, 5).forEach((d) => problemas.push(`${nombre}: contraste ${typeof d === "string" ? d : JSON.stringify(d)}`));
  (await p.evaluate(auditarTamanos)).slice(0, 5).forEach((d) => problemas.push(`${nombre}: chico ${d}`));
  const cortados = await p.evaluate(() => [...document.querySelectorAll("h1,h2,h3,strong,button")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width && r.top < innerHeight && r.bottom > 0 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).textOverflow !== "ellipsis" && getComputedStyle(e).overflow === "hidden";
  }).map((e) => e.innerText.slice(0, 30)));
  cortados.slice(0, 4).forEach((c) => problemas.push(`${nombre}: cortado "${c}"`));
};

const nav = (p, n) => p.getByRole("button", { name: n, exact: true }).locator("visible=true").first().click();

for (const [etiqueta, viewport, esquema] of [["m", { width: 390, height: 844 }, "light"], ["c", { width: 320, height: 640 }, "dark"]]) {
  const { ctx, p } = await abrir(viewport, esquema);
  const r = (n) => revisar(p, `${etiqueta}-${n}`);
  await r("resumen");
  assert.ok((await p.locator(".lista-amigos .tarjeta-amigo").count()) === 4, "aparecen todos");
  assert.ok((await p.locator(".lista-amigos .tarjeta-amigo").first().innerText()).includes("(vos)"), "incluido uno mismo");
  assert.equal(await p.getByText("Ayuno", { exact: true }).count(), 0, "sin ayuno");
  const faltan = (await p.locator(".macros-faltan li").allInnerTexts()).map((x) => x.replace(/\n+/g, " "));
  console.log("faltan:", faltan);
  assert.equal(faltan.length, 3);
  assert.ok(/Proteínas/.test(faltan[0]) && /Carbos/.test(faltan[1]) && /Grasas/.test(faltan[2]));
  assert.ok(faltan.every((f) => /\d+ g/.test(f)));
  // Se puede ver lo que falta, lo que llevás o el porcentaje, y queda elegido.
  assert.equal(await p.getByRole("radio").filter({ hasText: /Faltan|Llevo/ }).count(), 0, "sin botones con texto");
  await p.locator(".macros-faltan .pista-falta").first().waitFor();
  await p.waitForTimeout(4500);
  await p.locator(".macros-del-dia").screenshot({ path: `capturas/macros-falta-${etiqueta}.png` });
  await p.getByRole("button", { name: "Vista siguiente de los macros" }).click();
  await p.waitForTimeout(400);
  await p.locator(".macros-del-dia").screenshot({ path: `capturas/macros-llevo-${etiqueta}.png` });
  const llevo = (await p.locator(".macros-faltan li").allInnerTexts()).map((x) => x.replace(/\n+/g, " "));
  assert.ok(llevo.every((f) => /\d+ g de \d+ g/.test(f)), llevo.join(" | "));
  await p.getByRole("button", { name: "Vista siguiente de los macros" }).click();
  await p.waitForTimeout(800);
  assert.equal(await p.locator(".mini-anillo").count(), 3, "anillos en porcentaje");
  assert.equal(await p.locator(".reparto-kcal span").count(), 3, "reparto de calorías");
  const pct = (await p.locator(".macros-faltan li").allInnerTexts()).map((x) => x.replace(/\n+/g, " "));
  console.log("porcentaje:", pct);
  assert.ok(pct.every((f) => /\d+% de \d+ g/.test(f)), pct.join(" | "));
  await p.locator(".macros-del-dia").screenshot({ path: `capturas/macros-pct-${etiqueta}.png` });
  await r("macros-porcentaje");
  await p.reload();
  await p.locator(".macros-faltan").waitFor();
  assert.equal(await p.locator(".mini-anillo").count(), 3, "se recuerda");
  await p.getByRole("button", { name: "Vista siguiente de los macros" }).click();
  await p.locator(".pista-falta").first().waitFor();
  await nav(p, "Grupo");
  await r("chat");

  // Arriba, siempre, Chat e Imágenes. El chat solo tiene mensajes.
  assert.equal(await p.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected"), "true");
  assert.equal(await p.locator(".tarjeta.comida").count(), 0, "sin comidas en el chat");
  assert.equal(await p.getByRole("button", { name: "Subir foto de comida" }).count(), 0);
  assert.ok((await p.locator(".burbuja").count()) >= 5);
  assert.ok(await p.locator(".burbuja-bot").first().innerText().then((t) => !/\p{Extended_Pictographic}/u.test(t)), "bot sin emojis");

  await p.getByRole("tab", { name: "Imágenes" }).click();
  await r("imagenes");
  await p.getByRole("button", { name: /^Almuerzo/ }).click();
  await r("imagenes-abierta");
  assert.equal(await p.locator(".fotos-lista .comida").count(), 2, "fotos de almuerzo de hoy de cada uno");

  // La foto se ve entera
  const foto = await p.locator(".fotos-lista .comida-foto img").first().evaluate((i) => ({ w: i.clientWidth, h: i.clientHeight, nw: i.naturalWidth, nh: i.naturalHeight, ajuste: getComputedStyle(i).objectFit }));
  assert.equal(foto.ajuste, "contain");
  assert.ok(Math.abs(foto.w / foto.h - foto.nw / foto.nh) < 0.03, `sin recortar: ${JSON.stringify(foto)}`);

  // Datos breves y alimentos al tocar
  const pizza = p.locator(".fotos-lista .comida", { hasText: "Pizza de muzzarella" });
  const breve = await pizza.locator(".comida-macros").innerText();
  assert.ok(/950 kcal/.test(breve) && /P\s*36/.test(breve.replace(/\n/g, " ")) && /C\s*110/.test(breve.replace(/\n/g, " ")) && /G\s*38/.test(breve.replace(/\n/g, " ")), breve);
  await pizza.getByRole("button", { name: "Ver alimentos" }).click();
  await pizza.locator(".detalle-alimentos").waitFor();
  await r("alimentos");
  const detalle = (await pizza.locator(".detalle-alimentos li").allInnerTexts()).map((t) => t.replace(/\n+/g, " | "));
  console.log("detalle:", detalle);
  assert.equal(detalle.length, 2);
  assert.ok(detalle[0].includes("3 porción (300 g)") && detalle[0].includes("780 kcal"), detalle[0]);
  assert.ok(detalle[1].includes("1 lata") && detalle[1].includes("estimado"), detalle[1]);

  // La barra queda fija al bajar
  await p.evaluate(() => scrollTo(0, 500));
  await p.waitForTimeout(250);
  const barra = await p.locator(".grupo-barra").boundingBox();
  assert.ok(barra.y >= 0 && barra.y < 90, `barra fija en ${barra.y}`);
  await r("barra-fija");
  await p.evaluate(() => scrollTo(0, 0));

  // Responder lleva al chat con la foto citada
  assert.equal(await pizza.getByRole("button", { name: /Comentar/ }).count(), 0, "los comentarios ahora van al chat");
  await pizza.getByRole("button", { name: "Responder en el chat" }).click();
  await p.locator(".chat-respondiendo").waitFor();
  await r("respondiendo");
  assert.equal(await p.getByRole("tab", { name: "Chat" }).getAttribute("aria-selected"), "true");
  await p.getByLabel("Mensaje").fill("Qué pizza, por favor");
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
  await p.waitForTimeout(400);
  const mensaje = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "mensajes" && l.op === "insert").pop());
  assert.equal(mensaje.fila.respuesta_comida, "c3");
  assert.equal(avisos[avisos.length - 1].tipo, "mensaje");
  assert.equal(await p.locator(".chat-respondiendo").count(), 0);
  await p.evaluate(() => document.activeElement?.blur());
  await p.waitForTimeout(350);
  await p.getByRole("tab", { name: "Imágenes" }).click();
  await p.waitForTimeout(400);

  // Días anteriores
  await p.getByRole("button", { name: "Día anterior" }).click();
  await r("imagenes-ayer");
  assert.ok((await p.getByRole("button", { name: /^Cena/ }).innerText()).includes("2 fotos"));
  for (let i = 0; i < 31; i += 1) await p.getByRole("button", { name: "Día anterior" }).click();
  await p.getByText("Sin fotos este día").waitFor();

  // La respuesta aparece en el chat con la foto entera
  await p.getByRole("tab", { name: "Chat" }).click();
  await p.waitForTimeout(700);
  await r("chat-cita");
  assert.equal(await p.locator(".burbuja-cita").count(), 1);
  const cita = await p.locator(".burbuja-cita img").boundingBox();
  assert.ok(cita.width <= 44 && cita.height <= 44, `cita chica: ${JSON.stringify(cita)}`);
  assert.ok((await p.locator(".burbuja-cita").innerText()).includes("Respondiste a Nahuel"));
  await p.locator(".burbuja-cita").click();
  await p.locator(".lupa img").waitFor();
  await p.locator(".lupa").click();
  await p.waitForTimeout(300);

  // Integrantes y perfil
  await p.getByRole("button", { name: "Integrantes" }).click();
  await p.waitForTimeout(450);
  await r("integrantes");
  await p.getByRole("button", { name: /^Nahuel/ }).click();
  await p.locator(".perfil-stats").waitFor();
  await p.waitForTimeout(300);
  await r("perfil");
  assert.equal(await p.getByRole("dialog").getByRole("heading", { name: "Nahuel" }).count(), 1);
  assert.ok((await p.locator(".perfil-dia").count()) >= 2);
  assert.equal(await p.getByRole("button", { name: /^Editar/ }).count(), 0, "lo ajeno no se edita");
  await p.locator(".perfil-dia summary").first().click();
  await r("perfil-dia");
  await p.locator(".perfil-miniatura").first().click();
  await p.locator(".visor-foto").waitFor();
  await p.locator(".visor-alimentos summary").click();
  await p.locator(".visor-alimentos li").first().waitFor();
  await r("visor-alimentos");
  await p.getByRole("button", { name: "Cerrar foto" }).click();
  await p.waitForTimeout(300);
  await p.getByRole("tab", { name: "Fotos" }).click();
  await r("perfil-fotos");
  await p.getByRole("tab", { name: "Logros" }).click();
  await r("perfil-logros");
  assert.equal(await p.locator(".nivel-general").count(), 1, "nivel de la persona");
  await p.locator(".medalla").first().click();
  await p.locator(".detalle-logro").waitFor();
  await r("perfil-detalle-logro");
  await p.getByRole("dialog", { name: "Semana completa" }).getByRole("button", { name: "Cerrar" }).click();
  await p.locator(".detalle-logro").waitFor({ state: "detached" });
  await p.waitForTimeout(400);
  assert.ok((await p.locator(".perfil-favoritas li").count()) >= 2);
  await p.getByRole("button", { name: "Cerrar" }).click();
  await p.waitForTimeout(400);

  // Mi perfil: editar y borrar una comida sin foto
  await p.getByRole("button", { name: "Tu perfil" }).click();
  await p.locator(".perfil-stats").waitFor();
  await p.waitForTimeout(300);
  await r("mi-perfil");
  await p.locator(".perfil-dia summary").first().click();
  await p.getByRole("button", { name: /^Editar Milanesa/ }).click();
  await p.waitForTimeout(600);
  assert.equal(await p.getByRole("dialog", { name: "Editar comida" }).count(), 1);
  await p.locator(".mas-opciones summary").click();
  await p.waitForTimeout(250);
  await r("editar");
  await p.getByRole("button", { name: "Borrar comida" }).click();
  await p.getByRole("button", { name: "¿Seguro? Tocá de nuevo" }).click();
  await p.waitForTimeout(700);
  const borrada = await p.evaluate(() => window.__llamadas.filter((l) => l.tabla === "comidas" && l.op === "delete").length);
  assert.equal(borrada, 1);

  // Desde la foto abierta también responde en el chat, sin teclado adentro
  await nav(p, "Grupo");
  await p.getByRole("tab", { name: "Imágenes" }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /^Almuerzo/ }).click();
  await p.waitForTimeout(450);
  await p.locator(".fotos-lista .comida-foto").first().click();
  await p.locator(".visor-foto").waitFor();
  await r("visor");
  assert.equal(await p.locator(".visor-foto input").count(), 0);
  await p.locator(".visor-responder").click();
  await p.locator(".chat-respondiendo").waitFor();
  await p.locator(".visor-foto").waitFor({ state: "detached", timeout: 2000 });
  await p.getByRole("button", { name: "Cancelar respuesta" }).click();
  await p.waitForTimeout(350);
  assert.equal(await p.evaluate(() => document.documentElement.dataset.teclado === undefined || document.activeElement?.tagName === "INPUT"), true);

  // Mejoras
  await nav(p, "Ajustes");
  await p.waitForTimeout(400);
  await p.locator(".menu-ajustes button", { hasText: "Mejoras" }).click();
  await p.waitForTimeout(500);
  await p.locator(".mejoras").scrollIntoViewIfNeeded();
  assert.equal(await p.getByText("Pedidos del grupo").count(), 1, "todos ven los pedidos del grupo");
  await p.getByLabel("Qué querés mejorar").fill("Quiero ver mi peso en el resumen");
  await p.getByRole("button", { name: "Enviar pedido" }).click();
  await p.locator(".lista-mejoras li", { hasText: "Quiero ver mi peso" }).waitFor();
  assert.equal(avisos[avisos.length - 1].tipo, "mejora");
  await p.locator(".lista-mejoras li", { hasText: "Modo oscuro" }).getByRole("button", { name: "Marcar hecha" }).click();
  await p.locator(".lista-mejoras li.hecha").waitFor();
  await p.waitForTimeout(350);
  await r("mejoras");

  // Tutorial
  await nav(p, "Ajustes");
  await p.waitForTimeout(400);
  if (await p.getByRole("button", { name: "Volver a ajustes" }).count()) await p.getByRole("button", { name: "Volver a ajustes" }).click();
  await p.locator(".menu-ajustes button", { hasText: "Tutorial" }).click();
  await p.waitForTimeout(500);
  await p.locator(".tutorial").scrollIntoViewIfNeeded();
  assert.equal(await p.locator(".tutorial-seccion").count(), 9, "el tutorial suma la sección de la caca");
  await p.locator(".tutorial-seccion > summary", { hasText: "Importar de otra app" }).click();
  await p.locator(".tutorial-pregunta > summary", { hasText: "¿Cómo importo una comida?" }).click();
  await r("tutorial");
  assert.ok((await p.locator(".tutorial").innerText()).includes("Pegar"));

  // Logros con nombres nuevos
  await nav(p, "Logros");
  await p.waitForTimeout(500);
  assert.equal(await p.getByRole("heading", { name: "Objetivos" }).count(), 1);
  assert.equal(await p.getByRole("heading", { name: "Alimentación" }).count(), 1);
  assert.equal(await p.getByText(/^(Divertidos|Constancia)$/).count(), 0);
  await p.locator(".medalla", { hasText: "Bebé de la milanesa" }).scrollIntoViewIfNeeded();
  await r("retos-logros");
  assert.equal(await p.locator(".nivel-propio").count(), 1);
  await p.locator(".medalla", { hasText: "Cebador novato" }).click();
  await p.locator(".detalle-logro").waitFor();
  await r("detalle-logro");
  assert.equal(await p.locator(".niveles-logro li").count(), 5);
  assert.ok((await p.locator(".detalle-logro-avance").innerText()).includes("para Cebador novato"));
  assert.equal(await p.getByRole("progressbar", { name: "Avance al próximo nivel" }).count(), 1);
  await p.getByRole("dialog").getByRole("button", { name: "Cerrar" }).click();
  await p.waitForTimeout(400);
  const mila = (await p.locator(".medalla", { hasText: "milanesa" }).first().innerText()).replace(/\n+/g, " | ");
  console.log("milanesa:", mila);
  assert.ok(/de 5 milanesas|de 15 milanesas/.test(mila), mila);
  assert.equal(await p.locator(".medalla").count(), 21, "sin el logro de retos ganados");
  await r("retos");
  await nav(p, "Resumen");
  await p.getByRole("button", { name: "Agregar almuerzo" }).click();
  await r("carga");
  await ctx.close();
}

// Un aviso abre la sección correcta
for (const [vista, clase] of [["chat", ".chat-enviar"], ["imagenes", ".dia-selector"]]) {
  const { ctx, p } = await abrir({ width: 390, height: 844 }, "light", `http://localhost:5199/?vista=${vista}`);
  await p.locator(clase).waitFor();
  await ctx.close();
}

// Sin emojis en la pantalla, salvo las reacciones
{
  const { ctx, p } = await abrir({ width: 390, height: 844 });
  const texto = await p.evaluate(() => document.body.innerText);
  assert.ok(!/\p{Extended_Pictographic}/u.test(texto.replace(/[🔥🤤😂👏🐷]/gu, "")), "quedaron emojis en Resumen");
  const fuente = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  assert.match(fuente, /Poppins/);
  await p.evaluate(() => document.fonts.ready);
  assert.ok(await p.evaluate(() => document.fonts.check('800 20px Poppins')), "Poppins cargada");
  await ctx.close();
}

await b.close();
console.log("problemas de diseño:", problemas.length);
[...new Set(problemas)].slice(0, 30).forEach((x) => console.log(" -", x));
console.log("errores:", errores.length ? [...new Set(errores)].slice(0, 8) : "ninguno");
if (errores.length) process.exit(1);
console.log("grupo, imágenes y perfiles: pruebas funcionales pasadas");
