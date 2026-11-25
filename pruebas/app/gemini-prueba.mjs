// La IA prueba un modelo tras otro: el aviso de "se terminó el cupo" sale solo si TODOS se quedaron sin cupo del día,
// una respuesta cortada o una demora pasa al siguiente, y el límite por minuto se reintenta.
import assert from "node:assert/strict";
process.env.GEMINI_API_KEY = "prueba";
process.env.SUPABASE_URL = "https://base.test";
process.env.SUPABASE_ANON_KEY = "anon";
const { preguntarGemini, limpiarAlimento } = await import("../../api/_gemini.js");

let avisos = 0;
let pedidos = [];
// guion: modelo -> función que devuelve la respuesta de Google
function simular(guion) {
  avisos = 0;
  pedidos = [];
  globalThis.fetch = async (url, op) => {
    if (String(url).includes("anotar_ia_sin_cupo")) { avisos++; return new Response("null"); }
    const modelo = String(url).split("/models/")[1].split(":")[0];
    pedidos.push(modelo);
    const r = guion[modelo]?.(pedidos.filter((m) => m === modelo).length, op);
    if (r === "demora") throw new DOMException("timeout", "TimeoutError");
    return r || new Response("{}", { status: 404 });
  };
}
const ok = (obj, extra = {}) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, ...extra }] }));
const limite = (tipo) => new Response(JSON.stringify({ error: { details: [{ violations: [{ quotaId: `GenerateRequests${tipo}PerProjectPerModel-FreeTier` }] }] } }), { status: 429 });
const modelos = ["a", "b", "gemma-x"];
const base = { partes: [{ text: "hola" }], esquema: {}, modelos, pausa: 10 };
const silencio = console.warn;
console.warn = () => {};

// 1) Sin cupo del día en los Gemini, pero Gemma tarda: NO se avisa "sin cupo" (antes sí).
simular({ a: () => limite("PerDay"), b: () => limite("PerDay"), "gemma-x": () => "demora" });
let r = await preguntarGemini(base);
assert.equal(r.estado, 502);
assert.equal(avisos, 0, "con un modelo que solo tardó, no es falta de cupo");

// 2) Todos sin cupo del día: ahí sí el aviso.
simular({ a: () => limite("PerDay"), b: () => limite("PerDay"), "gemma-x": () => limite("PerDay") });
r = await preguntarGemini(base);
assert.equal(r.estado, 429);
assert.match(r.error, /cupo gratis/);
assert.equal(avisos, 1);

// 3) Respuesta cortada (sin JSON) en el primero: contesta el siguiente.
simular({ a: () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"titulo": "Mila' }] }, finishReason: "MAX_TOKENS" }] })), b: () => ok({ titulo: "Milanesa" }) });
r = await preguntarGemini(base);
assert.deepEqual(r.respuesta, { titulo: "Milanesa" });

// 4) Límite por minuto en todos: tras una pausa se reintenta y contesta.
simular({ a: (n) => (n === 1 ? limite("PerMinute") : ok({ titulo: "Segunda" })), b: () => limite("PerMinute"), "gemma-x": () => limite("PerMinute") });
r = await preguntarGemini(base);
assert.deepEqual(r.respuesta, { titulo: "Segunda" });
assert.deepEqual(pedidos, ["a", "b", "gemma-x", "a"]);

// 5) El razonamiento ("thought") no se mezcla con la respuesta; Gemini 3 pide razonamiento bajo; el tope es 8192.
simular({ "gemini-3-flash": (n, op) => {
  const cfg = JSON.parse(op.body).generationConfig;
  assert.deepEqual(cfg.thinkingConfig, { thinkingLevel: "low" });
  assert.equal(cfg.maxOutputTokens, 8192);
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "pensando...", thought: true }, { text: '{"ok":true}' }] } }] }));
} });
r = await preguntarGemini({ ...base, modelos: ["gemini-3-flash"] });
assert.deepEqual(r.respuesta, { ok: true });

// 6) Sin tiempo, no se sigue probando (la función de Vercel cortaría).
simular({ a: () => "demora", b: () => ok({ titulo: "tarde" }) });
r = await preguntarGemini({ ...base, total: 3000 });
assert.equal(r.estado, 502);
assert.deepEqual(pedidos, [], "con menos de 5 s ni empieza");

// 7) Números como texto (Gemma) y kcal que faltan se calculan con los macros.
assert.deepEqual(limpiarAlimento({ nombre: "Arroz", gramos: "150 g", kcal_100g: "130", proteinas_100g: "2,7", carbohidratos_100g: 28, grasas_100g: 0.3 }).por100, { kcal: 130, p: 2.7, c: 28, g: 0.3 });
assert.equal(limpiarAlimento({ nombre: "Pollo", gramos: 200, proteinas_100g: 25, carbohidratos_100g: 0, grasas_100g: 3 }).por100.kcal, 127);
assert.equal(limpiarAlimento({ nombre: "Nada", gramos: 100 }), null);

console.warn = silencio;
console.log("IA (Gemini): pasaron");
