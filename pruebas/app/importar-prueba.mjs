import fs from "node:fs";
// Se ejecuta desde la carpeta del proyecto.
import assert from "node:assert/strict";
import { corregirCaptura, filaDeComida, leerNumero, leerResumen, macrosPosibles, ranurasDeFotos } from "../../src/lib/importar.js";
import handler, { aNumero } from "../../api/salud.js";

assert.equal(leerNumero("1.650"), 1650);
assert.equal(leerNumero("1,650"), 1650);
assert.equal(leerNumero("120,5"), 120.5);
assert.equal(leerNumero("120.5"), 120.5);

const uno = (t) => leerResumen(t)[0];
const caso = (nombre, texto, esperado) => {
  const r = leerResumen(texto).map(({ alimentos, ...x }) => x);
  try {
    assert.deepEqual(r, esperado);
  } catch (e) {
    console.log("FALLA", nombre, JSON.stringify(r));
    throw e;
  }
};

caso("total en español", "Resumen del día\nCalorías 1.850 kcal\nProteínas 142 g\nCarbohidratos 180,5 g\nGrasas 62 g", [{ tipo: "resumen", kcal: 1850, p: 142, c: 180.5, g: 62 }]);
caso("total en inglés con metas", "Calories 1,650 / 2,200\nProtein 120g / 150g\nCarbs 160 g\nFat 55 g\nRemaining 550", [{ tipo: "resumen", kcal: 1650, p: 120, c: 160, g: 55 }]);
caso("etiqueta arriba del número", "Calorías\n1850\nProteínas\n142 g\nCarbos\n180 g\nGrasas\n62 g", [{ tipo: "resumen", kcal: 1850, p: 142, c: 180, g: 62 }]);
caso("número antes de etiqueta", "1650 kcal\n120 g Proteínas\n160 g Carbohidratos\n55 g Grasas", [{ tipo: "resumen", kcal: 1650, p: 120, c: 160, g: 55 }]);
caso("sin calorías las calcula", "Proteínas 100 g\nCarbos 200 g\nGrasas 50 g", [{ tipo: "resumen", kcal: 1650, p: 100, c: 200, g: 50 }]);
caso("ignora objetivos y restantes", "Objetivo 2200 kcal\nCalorías restantes 500\nConsumidas 1700\nProteínas 90 g", [{ tipo: "resumen", kcal: 1700, p: 90, c: 0, g: 0 }]);
caso(
  "por comidas",
  "Desayuno\n420 kcal\nProteínas 20 g\nCarbos 50 g\nGrasas 15 g\nAlmuerzo\n780 kcal\nProteínas 45 g\nCarbos 70 g\nGrasas 30 g\nCena\n600 kcal\nProteínas 40 g\nCarbos 40 g\nGrasas 25 g",
  [
    { tipo: "desayuno", kcal: 420, p: 20, c: 50, g: 15 },
    { tipo: "almuerzo", kcal: 780, p: 45, c: 70, g: 30 },
    { tipo: "cena", kcal: 600, p: 40, c: 40, g: 25 },
  ],
);
caso(
  "comidas en una línea",
  "Breakfast 420 kcal P 20 C 50 F 15\nLunch 780 kcal P 45 C 70 F 30\nSnacks 150 kcal P 5 C 20 F 5\nDinner 600 kcal P 40 C 40 F 25",
  [
    { tipo: "desayuno", kcal: 420, p: 20, c: 50, g: 15 },
    { tipo: "almuerzo", kcal: 780, p: 45, c: 70, g: 30 },
    { tipo: "colacion", kcal: 150, p: 5, c: 20, g: 5 },
    { tipo: "cena", kcal: 600, p: 40, c: 40, g: 25 },
  ],
);
caso("comidas solo con calorías y total con macros", "Desayuno 400\nAlmuerzo 700\nCena 600\nTotal\nCalorías 1700\nProteínas 120 g\nCarbos 170 g\nGrasas 60 g", [{ tipo: "resumen", kcal: 1700, p: 120, c: 170, g: 60 }]);
caso("comidas solo con calorías", "Desayuno 400\nAlmuerzo 700", [{ tipo: "desayuno", kcal: 400, p: 0, c: 0, g: 0 }, { tipo: "almuerzo", kcal: 700, p: 0, c: 0, g: 0 }]);
caso("OCR con ruido", "12:45 ...\n< Hoy >\nkcal 1.530\nProteina: 98g\nCarbohidratos: 140g\nGrasa: 48g\nAgregar comida", [{ tipo: "resumen", kcal: 1530, p: 98, c: 140, g: 48 }]);
caso("macros pegados de captura", "Breakfast\n\n420 kcal P20C50F15\nLunch\n\n780 kcal P45C70F30\nDinner\n\n600 kcal P40 C40 F 25", [
  { tipo: "desayuno", kcal: 420, p: 20, c: 50, g: 15 },
  { tipo: "almuerzo", kcal: 780, p: 45, c: 70, g: 30 },
  { tipo: "cena", kcal: 600, p: 40, c: 40, g: 25 },
]);
caso("g leída como 9", corregirCaptura("Hoy\n1.850 kcal\nProteínas 142 g\nCarbohidratos 180 g\nGrasas 629"), [{ tipo: "resumen", kcal: 1850, p: 142, c: 180, g: 62 }]);
assert.equal(corregirCaptura("Proteínas 119\nGrasas 69"), "Proteínas 119\nGrasas 69", "sin ninguna g no toca los números");
assert.deepEqual(leerResumen("Hola, hoy comí rico"), []);
assert.deepEqual(leerResumen(""), []);

const csv = 'Day,Time,Group,Food Name,Amount,Energy (kcal),Alcohol (g),Protein (g),Carbs (g),Fat (g)\n2026-11-04,8:00,Breakfast,Avena,"40 g",150,0,5,27,3\n2026-11-05,8:00,Breakfast,Huevo,"2",140,0,12,1,10\n2026-11-05,8:10,Breakfast,Pan,"1",130,0,4,25,1\n2026-11-05,13:00,Lunch,"Pollo, a la plancha",200 g,330,0,62,0,7';
caso("CSV de Cronometer", csv, [{ tipo: "desayuno", kcal: 270, p: 16, c: 26, g: 11 }, { tipo: "almuerzo", kcal: 330, p: 62, c: 0, g: 7 }]);

// Valores que manda un Atajo
assert.equal(aNumero("1.650,5 kcal"), 1650.5);
assert.equal(aNumero("1650 kcal"), 1650);
assert.equal(aNumero("1,650"), 1650);
assert.equal(aNumero("82,4"), 82.4);
assert.equal(aNumero("82.4 kg"), 82.4);
assert.equal(aNumero(""), null);
assert.equal(aNumero(null), null);
assert.equal(aNumero(1650.5), 1650.5);

process.env.SUPABASE_URL = "https://p.test";
process.env.SUPABASE_ANON_KEY = "pub";
let enviado;
globalThis.fetch = async (url, op) => {
  enviado = { url: String(url), cuerpo: JSON.parse(op.body) };
  if (enviado.cuerpo.p_token === "malo") return new Response(JSON.stringify({ message: "token_invalido" }), { status: 400 });
  return new Response("null", { status: 200 });
};
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { this.cuerpo = d; return this; } });
let r = res();
await handler({ method: "POST", body: { token: "bueno", calorias: "1.650 kcal", proteinas: "120,5", carbohidratos: "", peso: "81,2 kg" } }, r);
assert.equal(r.statusCode, 200);
assert.equal(enviado.url, "https://p.test/rest/v1/rpc/registrar_salud");
assert.equal(enviado.cuerpo.p_calorias, 1650);
assert.equal(enviado.cuerpo.p_proteinas, 120.5);
assert.equal(enviado.cuerpo.p_carbohidratos, null);
assert.equal(enviado.cuerpo.p_peso, 81.2);
assert.match(enviado.cuerpo.p_fecha, /^\d{4}-\d{2}-\d{2}$/);
r = res();
await handler({ method: "POST", body: { token: "malo" } }, r);
assert.equal(r.statusCode, 401);
r = res();
await handler({ method: "GET" }, r);
assert.equal(r.statusCode, 405);

// Día por día (SQL 056): con las listas del Atajo se sincroniza la ventana entera.
{
  const llamadas = [];
  let sin056 = false;
  globalThis.fetch = async (url, op) => {
    const funcion = String(url).split("/").pop();
    llamadas.push({ funcion, cuerpo: JSON.parse(op.body) });
    if (funcion === "sincronizar_salud") {
      if (sin056) return new Response(JSON.stringify({ code: "PGRST202", message: "Could not find the function public.sincronizar_salud" }), { status: 404 });
      return new Response(JSON.stringify({ "2026-11-19": 500, "2026-11-18": 1350 }), { status: 200 });
    }
    return new Response("null", { status: 200 });
  };
  // Lo que manda el Atajo: totales agrupados por día (el último es ayer porque hoy quedó vacío) y las comidas sueltas.
  const atajo = {
    token: "bueno", fecha: "2026-11-19",
    calorias: ["900", "1350"], proteinas: ["40", "60"],
    kcal_horas: ["2026-11-18T21:00:00-03:00", "2026-11-18T22:30:00-03:00"], kcal_valores: ["700", "650"],
    proteinas_horas: ["2026-11-18T21:00:00-03:00", "2026-11-18T22:30:00-03:00"], proteinas_valores: ["30", "30"],
  };
  let rs = res();
  await handler({ method: "POST", body: atajo }, rs);
  assert.equal(rs.statusCode, 200);
  assert.deepEqual(llamadas.map((l) => l.funcion), ["sincronizar_salud"], "no usa el total de la lista como si fuera de hoy");
  assert.deepEqual([llamadas[0].cuerpo.p_desde, llamadas[0].cuerpo.p_hasta], ["2026-11-14", "2026-11-19"]);
  assert.deepEqual(llamadas[0].cuerpo.p_entradas.map((e) => [e.momento.slice(0, 10), e.kcal]), [["2026-11-18", 700], ["2026-11-18", 650]]);
  assert.equal(rs.cuerpo.dias["2026-11-18"], 1350);

  // Sin el SQL 056 sigue como antes.
  llamadas.length = 0; sin056 = true;
  rs = res();
  await handler({ method: "POST", body: atajo }, rs);
  assert.equal(rs.statusCode, 200);
  assert.deepEqual(llamadas.map((l) => l.funcion), ["sincronizar_salud", "registrar_salud", "registrar_comidas_salud"]);
  sin056 = false;

  // Llegaron totales pero ninguna comida suelta (Salud no dejó leerlas): no se vacía la semana.
  llamadas.length = 0;
  await handler({ method: "POST", body: { token: "bueno", fecha: "2026-11-19", calorias: ["1200"], kcal_horas: [], kcal_valores: [] } }, res());
  assert.deepEqual(llamadas.map((l) => l.funcion), ["registrar_salud"]);
}

console.log("importador y Apple Salud: todas las pruebas pasaron");

// ---------- Importar desde una comida ----------
const f = (tipo, kcal) => ({ tipo, kcal, p: 1, c: 1, g: 1 });
assert.equal(filaDeComida([f("cena", 500), f("almuerzo", 700)], "almuerzo").kcal, 700);
assert.deepEqual(filaDeComida([f("resumen", 900)], "merienda").tipo, "merienda", "lo único leído va a la comida abierta");
assert.equal(filaDeComida([f("cena", 500), f("almuerzo", 700)], "merienda"), null);
assert.equal(filaDeComida([], "cena"), null);

// ---------- Fotos después de importar ----------
const tipos = ["desayuno", "almuerzo", "merienda", "cena"];
const claves = (r) => r.map((x) => x.tipo + (x.id ? ":" + x.id : ""));
assert.deepEqual(claves(ranurasDeFotos([{ id: "r", tipo: "resumen" }], [], tipos)), tipos, "solo el total: todas las comidas");
assert.deepEqual(claves(ranurasDeFotos([{ id: "r", tipo: "resumen" }], [{ id: "r", tipo: "resumen" }, { id: "a", tipo: "almuerzo", foto_path: "x" }, { id: "b", tipo: "cena" }], tipos)), ["desayuno", "merienda", "cena:b"]);
assert.deepEqual(claves(ranurasDeFotos([{ id: "c", tipo: "cena" }, { id: "d", tipo: "desayuno" }], [], tipos)), ["desayuno:d", "cena:c"], "por comidas: solo las importadas");
assert.deepEqual(claves(ranurasDeFotos([{ id: "c", tipo: "cena", foto_path: "x" }], [{ id: "c", tipo: "cena", foto_path: "x" }], tipos)), [], "reimportar no pide de nuevo la foto");
assert.equal(ranurasDeFotos([{ id: "c", tipo: "cena", privada: true }], [], tipos)[0].privada, true);
// Lo que puede mandar un Atajo
assert.equal(aNumero("1.650,5 kcal"), 1650.5);
assert.equal(aNumero("1,650.5 kcal"), 1650.5);
assert.equal(aNumero("2134 kcal\n1800 kcal\n1950 kcal"), 2134, "lista de días: no pega los números");
assert.equal(aNumero("7 nov 2026, 2134 kcal"), 2134, "con fecha: toma el valor con unidad");
assert.equal(aNumero("95.5 g"), 95.5);
assert.equal(aNumero("2.595000028610229\n0"), 2.595000028610229, "decimal largo del iPhone");
assert.equal(aNumero("0.3299999833106995\n0"), 0.3299999833106995);
assert.equal(aNumero("30.29999923706055\n0"), 30.29999923706055);
assert.equal(aNumero("120\n0"), 120);
assert.equal(aNumero("1084,89990234375"), 1084.89990234375, "con coma decimal");
assert.equal(aNumero("1.234.567"), 1234567, "solo miles");
assert.equal(aNumero([1800, 2134]), 2134, "una lista termina en el último día");
assert.equal(aNumero(2134.46), 2134.46);
assert.equal(aNumero("sin datos"), null);
assert.equal(aNumero(""), null);
// MyFitnessPal: la marca y la porción van debajo del alimento y son el mismo alimento.
const marcas = (t) => leerResumen(t)[0]?.alimentos?.map((a) => [a.nombre, a.medida, a.kcal]);
assert.deepEqual(marcas(["Queso cottage", "Festa, 1 porción", "90"].join("\n")), [["Queso cottage (Festa)", "1 porción", 90]]);
assert.deepEqual(marcas(["Desayuno", "Queso cottage", "Festa, 1 porción · 90 kcal", "Café con leche", "La Serenísima, 200 ml · 70 kcal"].join("\n")), [["Queso cottage (Festa)", "1 porción", 90], ["Café con leche (La Serenísima)", "200 ml", 70]]);
// La marca suelta en la línea de abajo ("Festa") es del mismo alimento, no otro.
assert.deepEqual(marcas(["Queso cottage", "Festa", "1 porción · 98 kcal", "Frutillas", "1 taza · 49 kcal"].join(String.fromCharCode(10))), [["Queso cottage (Festa)", "1 porción", 98], ["Frutillas", "1 taza", 49]], "marca suelta");
// La fila que suma todo lo demás es el total de la comida, no un alimento.
assert.deepEqual(marcas(["Desayuno", "Avena 40 g 150 kcal", "Banana 1 unidad 105 kcal", "Leche 200 ml 120 kcal", "Total 375 kcal"].join(String.fromCharCode(10))).map((x) => x[0]), ["Avena", "Banana", "Leche"]);
assert.deepEqual(marcas(["Desayuno", "Avena 40 g 150 kcal", "Banana 1 unidad 105 kcal", "Leche 200 ml 120 kcal", "375 kcal"].join(String.fromCharCode(10))).map((x) => x[0]), ["Avena", "Banana", "Leche"]);
// Dos alimentos distintos con las mismas calorías se quedan los dos.
assert.equal(marcas(["Huevo 72 kcal", "Huevo frito 72 kcal"].join(String.fromCharCode(10))).length, 2);
// Captura real de MyFitnessPal leída por el lector: encabezado "Aperitivos", línea de macros y marca separada por un punto.
{
  const real = leerResumen(fs.readFileSync(new URL("./archivos/mfp-real.txt", import.meta.url), "utf8"));
  const fila = filaDeComida(real, "merienda");
  assert.deepEqual(fila.alimentos.map((a) => a.nombre), ["galletas de arroz (Microbiotica)", "Queso Cottage (Festa)", "Maracuya (Yolita)", "Yogurt cremoso balance (Milkaut)"]);
  const suma = (k) => Math.round(fila.alimentos.reduce((t, a) => t + a[k], 0));
  assert.deepEqual([suma("kcal"), suma("p"), suma("c"), suma("g")], [139, 9, 22, 1], "los macros estimados se ajustan a los de la captura");
}
// Un macro imposible para las calorías: "C 71g" leído como "C713".
{
  const [mal] = leerResumen(`Almuerzo 650 cal
C713 G20g P 40g
Arroz blanco 300
1 taza
Pechuga de pollo 350
200 g`);
  assert.equal(mal.c, 71.3, "el encabezado mal leído no infla los carbos");
  assert.ok(mal.alimentos.every((a) => a.p * 4 + a.c * 4 + a.g * 9 <= a.kcal * 1.25 + 25), "ningún alimento queda imposible");
  assert.equal(uno(`Almuerzo 650 cal
Carbohidratos 713
Proteínas 40 g
Grasas 20 g`).c, 71.3);
  assert.deepEqual(macrosPosibles({ kcal: 500, p: 30, c: 50, g: 15 }), { kcal: 500, p: 30, c: 50, g: 15 }, "lo que cierra no se toca");
  assert.equal(macrosPosibles({ kcal: 300, p: 10, c: 900, g: 5 }).c, 53.8, "si no cierra ni corrigiendo el dígito, queda lo que sobra");
}
console.log("importar desde comida y fotos: pasaron");
