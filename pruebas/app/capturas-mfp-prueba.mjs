// Se ejecuta desde la carpeta del proyecto. Los tres problemas de las capturas de MyFitnessPal (18/11).
import assert from "node:assert/strict";
import { leerResumen } from "../../src/lib/importar.js";

const fila = (t) => leerResumen(t)[0];
const datos = (t) => (fila(t)?.alimentos || []).map((a) => [a.nombre, a.gramos, a.kcal]);

// 1. Los gramos entre paréntesis: "1 porción (150 g)".
assert.deepEqual(datos(["Almuerzo 400", "Pechuga de pollo", "Genérico, 1 porción (150 g)", "250", "Arroz blanco", "Gallo, 0.5 taza (90 g) · 150 kcal"].join("\n")),
  [["Pechuga de pollo (Genérico)", 150, 250], ["Arroz blanco (Gallo)", 90, 150]], "peso entre paréntesis");
const r = fila("Yogur bebible\nSer, 1 pote (200 ml)\n120");
assert.equal(r.alimentos[0].medida, "1 pote (200 ml)");

// 2. El peso no se lee como calorías (antes "(90 g)" quedaba como 90 kcal) y si quedan cruzados se dan vuelta.
assert.deepEqual(datos("Pan lactal\nBimbo, 2 rebanadas (50 g)\n130"), [["Pan lactal (Bimbo)", 50, 130]]);
assert.deepEqual(datos("Lechuga 20 g 300 kcal"), [["Lechuga", 300, 20]], "más de 9 kcal por gramo es imposible");
assert.deepEqual(datos(["Cena 520", "Milanesa de carne 180 g 420 kcal", "Puré de papas 100 g 280 kcal"].join("\n")),
  [["Milanesa de carne", 180, 420], ["Puré de papas", 280, 100]], "el total del título muestra cuál quedó cruzado");
assert.deepEqual(datos(["Cena 700", "Milanesa de carne 180 g 420 kcal", "Puré de papas 280 g 280 kcal"].join("\n")).map((a) => a[2]), [420, 280], "si cierra, no toca nada");

// 3. Nombres largos: cortados con "…" en una copia, o partidos en dos renglones.
assert.deepEqual(datos(["Almuerzo 120", "Mix de verduras salteadas con…", "Genérico, 200 g", "120", "Mix de verduras salteadas con aceite de oliva", "Genérico, 200 g", "120"].join("\n")),
  [["Mix de verduras salteadas con aceite de oliva (Genérico)", 200, 120]], "una sola vez y con el nombre entero");
assert.deepEqual(datos(["Almuerzo 120", "Mix de verduras salteadas con", "aceite de oliva", "Genérico, 200 g", "120"].join("\n")),
  [["Mix de verduras salteadas con aceite de oliva (Genérico)", 200, 120]], "renglón partido");
assert.equal(datos("Mix de verduras 200 g 120 kcal\nMix de frutas 150 g 120 kcal").length, 2, "nombres parecidos pero distintos");

// Alimentos que empiezan como un título o un dato.
assert.deepEqual(datos(["Colación", "Snacks de arroz", "Gallo, 2 unidades (20 g)", "80", "Proteína en polvo", "Star Nutrition, 1 scoop (30 g)", "120"].join("\n")),
  [["Snacks de arroz (Gallo)", 20, 80], ["Proteína en polvo (Star Nutrition)", 30, 120]]);
assert.equal(fila("Colación\nSnacks de arroz\nGallo, 2 unidades (20 g)\n80").tipo, "colacion");
assert.equal(datos("Proteínas 20 g\nGrasa saturada 3 g").length, 0, "los datos siguen sin ser alimentos");

console.log("capturas de MyFitnessPal: pasaron");
