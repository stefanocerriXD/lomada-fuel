// Se ejecuta desde la carpeta del proyecto.
import assert from "node:assert/strict";
import { itemImportado, leerResumen } from "../../src/lib/importar.js";

const fila = (t) => leerResumen(t)[0];
const nombres = (t) => (fila(t)?.alimentos || []).map((a) => a.nombre);

// Una línea por alimento
let r = fila("Avena 40 g 150 kcal P 5 C 27 G 3\nBanana 1 unidad 90 kcal P 1 C 23 G 0");
assert.deepEqual(r.alimentos, [
  { nombre: "Avena", medida: "40 g", gramos: 40, kcal: 150, p: 5, c: 27, g: 3 },
  { nombre: "Banana", medida: "1 unidad", kcal: 90, p: 1, c: 23, g: 0 },
]);
assert.equal(r.tipo, "resumen");
assert.equal(r.kcal, 240);
assert.equal(r.c, 50);

// Nombre arriba y datos abajo, bajo el título de la comida
r = fila("Desayuno\nAvena instantánea\n40 g · 150 kcal\nP 5 · C 27 · G 3\nLeche descremada\n200 ml · 90 kcal\nP 6 C 10 G 1");
assert.equal(r.tipo, "desayuno");
assert.deepEqual(r.alimentos.map((a) => [a.nombre, a.gramos, a.kcal, a.p, a.c, a.g]), [["Avena instantánea", 40, 150, 5, 27, 3], ["Leche descremada", 200, 90, 6, 10, 1]]);
assert.equal(r.kcal, 240);

// Títulos con total y varias comidas
const varias = leerResumen("Desayuno 420 kcal\nAvena 40 g 150 kcal P 5 C 27 G 3\nHuevo 2 unidades 140 kcal P 12 C 1 G 10\nAlmuerzo 500 kcal\nPollo 200 g 330 kcal P 62 C 0 G 7\nTotal 620 kcal");
assert.deepEqual(varias.map((v) => [v.tipo, v.alimentos.length, v.kcal]), [["desayuno", 2, 290], ["almuerzo", 1, 330]]);

// Columnas sin unidad, en distinto orden según la app
r = fila("Avena 40 g 150 27 3 5");
assert.deepEqual([r.alimentos[0].p, r.alimentos[0].c, r.alimentos[0].g], [5, 27, 3], "orden calorías, carbos, grasas, proteínas");
r = fila("Pollo 200 g 330 62 0 7");
assert.deepEqual([r.alimentos[0].p, r.alimentos[0].c, r.alimentos[0].g], [62, 0, 7], "orden calorías, proteínas, carbos, grasas");

// Con nombres de macros
r = fila("Yogur natural 190 g\nProteínas 6 g\nCarbohidratos 20 g\nGrasas 3 g\n120 kcal");
assert.deepEqual([r.alimentos[0].nombre, r.alimentos[0].gramos, r.alimentos[0].kcal, r.alimentos[0].p, r.alimentos[0].c, r.alimentos[0].g], ["Yogur natural", 190, 120, 6, 20, 3]);

// Porcentajes y separadores
assert.deepEqual(nombres("Leche 1% 200 ml 90 kcal P 6 C 10 G 1"), ["Leche 1%"]);
r = fila("Pollo a la plancha, 150 gr, 250 cal");
assert.equal(r.alimentos[0].nombre, "Pollo a la plancha");
assert.equal(r.alimentos[0].gramos, 150);
assert.equal(r.alimentos[0].kcal, 250);
assert.equal(fila("Café 1 taza - 5 kcal").alimentos[0].medida, "1 taza");
assert.equal(fila("Tostada 2 rebanadas - 160 kcal").alimentos[0].medida, "2 rebanadas");

// Sin macros en la captura: se estiman si conocemos el alimento
r = fila("Kiwi 1 unidad 46 kcal").alimentos[0];
assert.equal(r.estimado, true);
assert.equal(r.kcal, 46, "las calorías de la otra app mandan");
assert.ok(r.c > 5 && r.c < 15, `carbos estimados: ${r.c}`);
assert.equal(r.gramos, 75, "el peso sale de la porción");
r = fila("Zzzcomida 100 g 200 kcal").alimentos[0];
assert.equal(r.estimado, undefined);
assert.deepEqual([r.kcal, r.p, r.c, r.g], [200, 0, 0, 0]);
r = fila("Avena 40 g").alimentos?.[0];
assert.ok(r?.kcal > 100, "solo con el peso calcula las calorías");

r = fila("Oats 40 g 150 kcal").alimentos[0];
assert.equal(r.estimado, true);
assert.ok(r.p > 3 && r.c > 15, `avena en inglés: ${JSON.stringify(r)}`);
assert.equal(r.kcal, 150);
assert.equal(fila("Eggs 100 g 143 kcal").alimentos[0].estimado, true);

r = fila("Leche 200 mi 70 kcal P 7 C 10 G 0").alimentos[0];
assert.deepEqual([r.medida, r.gramos], ["200 ml", 200], "el lector confunde ml con mi");

// Una captura que muestra cada alimento dos veces
r = fila(["Entraña 200 g 450 kcal P 40 C 0 G 32", "Vacío 150 g 380 kcal P 30 C 0 G 28", "Entraña 200 g 450 kcal P 40 C 0 G 32", "Vacío 150 g 380 kcal P 30 C 0 G 28"].join("\n"));
assert.deepEqual(r.alimentos.map((a) => a.nombre), ["Entraña", "Vacío"], "no repite lo que aparece dos veces");
assert.equal(r.kcal, 830);

// La misma fruta con datos de la captura y una copia sin números: queda solo la de la captura
r = fila(["Frutillas 1 taza 49 kcal P 1 C 12 G 0", "Frutillas 1 taza", "Banana 1 unidad 90 kcal P 1 C 23 G 0"].join("\n"));
assert.deepEqual(r.alimentos.map((a) => [a.nombre, a.kcal, Boolean(a.estimado)]), [["Frutillas", 49, false], ["Banana", 90, false]], "sin copia estimada");
r = fila(["Frutillas, 1 taza", "Frutillas 49 kcal"].join("\n"));
assert.equal(r.alimentos.length, 1);
assert.equal(r.alimentos[0].kcal, 49);

// Lo que no es un alimento no entra
assert.deepEqual(leerResumen("Noviembre 2026\nHoy\nAgregar alimento\nTotal 1200"), []);
assert.equal(fila("12:45\n< Hoy >\nAvena 40 g 150 kcal P 5 C 27 G 3\nAgregar alimento\nRestantes 1800 kcal\nObjetivo 2000 kcal").alimentos.length, 1);
assert.equal(nombres("Resumen del día\nCalorías 1.850 kcal\nProteínas 142 g").length, 0, "un total sigue siendo un total");

// CSV
const csv = 'Day,Time,Group,Food Name,Amount,Energy (kcal),Alcohol (g),Protein (g),Carbs (g),Fat (g)\n2026-11-05,8:00,Breakfast,Huevo,2 units,140,0,12,1,10\n2026-11-05,8:10,Breakfast,Pan,30 g,80,0,3,15,1';
r = fila(csv);
assert.equal(r.tipo, "desayuno");
assert.equal(r.alimentos.length, 2);
assert.deepEqual([r.alimentos[1].nombre, r.alimentos[1].gramos, r.alimentos[1].kcal, r.alimentos[1].c], ["Pan", 30, 80, 15]);

// Queda listo para ajustar la cantidad
const item = itemImportado({ nombre: "Avena", gramos: 40, kcal: 150, p: 5, c: 27, g: 3 });
assert.equal(Math.round(item.por100.kcal), 375);
assert.equal(item.fuente, "importado");
assert.equal(itemImportado({ nombre: "Banana", medida: "1 unidad", kcal: 90, p: 1, c: 23, g: 0 }).por100, undefined);

console.log("alimentos uno por uno: todas las pruebas pasaron");
