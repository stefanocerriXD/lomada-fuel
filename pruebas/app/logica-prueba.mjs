// Se ejecuta desde la carpeta del proyecto para resolver sus dependencias. No sale a internet.
import assert from "node:assert/strict";
import webpush from "web-push";
import { analizarGastoReal, calcularPlan } from "../../src/lib/cuerpo.js";
import { puntajes, diasRestantes, objetivoDesafio } from "../../src/lib/desafios.js";
import { calcularRacha } from "../../src/lib/macros.js";
import { haceDias, fechaLocal } from "../../src/lib/fechas.js";

// ---------- Meta adaptativa ----------
const salud = { sexo: "masculino", anio_nacimiento: 1998, altura_cm: 178, peso_kg: 82, dias_actividad: 4, peso_objetivo: 76, ritmo: 0.5 };
const plan = calcularPlan(salud);
assert.equal(plan.gasto, 2480, "gasto con el día a día de 051");
assert.equal(plan.calorias, 1930);

const dias = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const comidasDe = (kcal, cantidad = 20) => dias(cantidad, (i) => [
  { fecha: haceDias(i), calorias: kcal / 2 },
  { fecha: haceDias(i), calorias: kcal / 2 },
]).flat();

// Bajó 0,5 kg por semana comiendo 2.300: gasta unas 2.300 + 550 = 2.850.
const bajando = dias(5, (i) => ({ fecha: haceDias(21 - i * 5), peso_kg: 82 - (0.5 / 7) * (i * 5) }));
const r1 = analizarGastoReal(bajando, comidasDe(2300), plan);
assert.equal(r1.listo, true);
assert.equal(r1.gasto, 2850);
assert.equal(r1.kgPorSemana, -0.5);
assert.equal(r1.calorias, 2300, "mantiene el mismo recorte sobre el gasto real");

// Valores absurdos: no se va más de 20% de la fórmula.
const absurdo = dias(5, (i) => ({ fecha: haceDias(21 - i * 5), peso_kg: 82 + i * 3 }));
assert.equal(analizarGastoReal(absurdo, comidasDe(800), plan).gasto >= 1980, true, "no baja de 80% de 2480");

// Sin datos suficientes explica qué falta.
const corto = analizarGastoReal([{ fecha: fechaLocal(), peso_kg: 82 }], [], plan);
assert.equal(corto.listo, false);
assert.equal(corto.faltan.pesajes, 3);
assert.equal(corto.faltan.dias, 10);
const incompletos = analizarGastoReal(bajando, dias(20, (i) => ({ fecha: haceDias(i), calorias: 2000 })), plan);
assert.equal(incompletos.listo, false, "los días con una sola comida no cuentan");

// ---------- Desafíos ----------
const perfiles = { a: { id: "a", nombre: "Ana" }, b: { id: "b", nombre: "Beto" } };
const d = { tipo: "proteina", meta: 100, inicio: haceDias(2), fin: haceDias(-2) };
const comidas = [
  { usuario_id: "a", fecha: haceDias(2), proteinas: 60 },
  { usuario_id: "a", fecha: haceDias(2), proteinas: 50 },
  { usuario_id: "a", fecha: haceDias(1), proteinas: 120 },
  { usuario_id: "b", fecha: haceDias(1), proteinas: 500, privada: true },
  { usuario_id: "b", fecha: haceDias(9), proteinas: 500 },
];
const [uno, dos] = puntajes(d, perfiles, comidas, []);
assert.equal(uno.perfil.id, "a");
assert.equal(uno.puntos, 2, "suma comidas del mismo día");
assert.equal(dos.puntos, 0, "lo privado y lo de otras fechas no cuenta");
assert.equal(objetivoDesafio(d), 5);
assert.equal(diasRestantes(d), 3);
const agua = puntajes({ tipo: "agua", meta: 2000, inicio: haceDias(1), fin: fechaLocal() }, perfiles, [], [{ usuario_id: "b", fecha: haceDias(1), ml: 2000 }]);
assert.equal(agua[0].perfil.id, "b");
const fotos = puntajes({ tipo: "fotos", meta: 3, inicio: haceDias(1), fin: fechaLocal() }, perfiles, [{ usuario_id: "a", fecha: haceDias(1), foto_path: "x" }, { usuario_id: "a", fecha: haceDias(1) }], []);
assert.equal(fotos[0].puntos, 1);

// ---------- Notificaciones ----------
const claves = webpush.generateVAPIDKeys();
Object.assign(process.env, { SUPABASE_URL: "https://p.supabase.test", SUPABASE_ANON_KEY: "pub", VITE_VAPID_PUBLIC_KEY: claves.publicKey, VAPID_PRIVATE_KEY: claves.privateKey });
let respuesta = { titulo: "Steve", cuerpo: "Hola grupo", vista: "chat", destinos: [{ endpoint: "https://push.test/otro", p256dh: "a", auth: "b" }, { endpoint: "https://push.test/vencida", p256dh: "a", auth: "b" }] };
const llamadas = [];
globalThis.fetch = async (entrada, op = {}) => {
  const funcion = String(entrada).split("/").pop();
  llamadas.push({ funcion, auth: op.headers.Authorization, cuerpo: JSON.parse(op.body) });
  if (funcion === "destinos_aviso") return new Response(JSON.stringify(respuesta), { status: 200, headers: { "content-type": "application/json" } });
  // Control de seguridad (todos del mismo grupo) y preferencias de avisos (todos los quieren).
  if (funcion === "solo_mi_grupo" || funcion === "filtrar_preferencias") return new Response(JSON.stringify(JSON.parse(op.body).p_endpoints), { status: 200, headers: { "content-type": "application/json" } });
  return new Response(null, { status: 204 });
};
const enviados = [];
webpush.sendNotification = async (sub, cuerpo) => {
  if (sub.endpoint.endsWith("vencida")) throw Object.assign(new Error("gone"), { statusCode: 410 });
  enviados.push({ a: sub.endpoint, ...JSON.parse(cuerpo) });
};
const { default: notificar } = await import("../../api/notificar.js");
const pedir = async (cuerpo, auth = "Bearer sesion") => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(d) { this.cuerpo = d; return this; } };
  await notificar({ method: "POST", headers: { authorization: auth, host: "app.prueba" }, body: cuerpo }, res);
  return res;
};
let r = await pedir({ tipo: "mensaje", id: "m1" });
assert.equal(r.cuerpo.enviadas, 1);
assert.equal(llamadas[0].auth, "Bearer sesion", "consulta con la sesión de quien pide");
assert.equal(enviados[0].a, "https://push.test/otro");
assert.equal(enviados[0].titulo, "Steve");
assert.equal(enviados[0].destinos, undefined, "no reparte los destinos a los celulares");
assert.deepEqual(llamadas.find((l) => l.funcion === "borrar_suscripciones").cuerpo, { p_endpoints: ["https://push.test/vencida"] }, "limpia lo vencido");
respuesta = null;
assert.equal((await pedir({ tipo: "comida", id: "c" })).cuerpo.enviadas, 0);
assert.equal((await pedir({ tipo: "comida", id: "c" }, "")).statusCode, 401);
assert.equal((await pedir({})).statusCode, 400);
delete process.env.VAPID_PRIVATE_KEY;
assert.equal((await pedir({ tipo: "mensaje", id: "m1" })).cuerpo.enviadas, 0, "sin claves no rompe");

// ---------- Medidas ----------
const { prepararItem, conCantidad, conUnidad, unidadesDe, restar, sumar } = await import("../../src/lib/unidades.js");
const { buscarTipicos: buscarTipicosArriba } = await import("../../src/data/alimentos-ar.js");
const kiwi = { nombre: "Kiwi", por100: { kcal: 61, p: 1, c: 15, g: 0.5 }, porcion: { nombre: "1 unidad", g: 75 } };
let it = prepararItem(kiwi);
assert.equal(it.unidad.nombre, "unidad");
assert.equal(it.gramos, 75);
it = conCantidad(it, sumar(it));
assert.equal(it.cantidad, 2);
assert.equal(it.gramos, 150);
const nombres = unidadesDe(kiwi).map((u) => u.nombre);
assert.ok(nombres.includes("unidad") && !nombres.includes("cucharada") && nombres.includes("g"), "una fruta no se mide en cucharadas");
it = conUnidad(it, unidadesDe(kiwi).find((u) => u.nombre === "g"));
assert.equal(it.cantidad, 150, "pasar a gramos conserva la cantidad real");
assert.equal(sumar(it), 160);
const usda = prepararItem({ nombre: "Kiwifruit, green, raw", por100: { kcal: 61, p: 1, c: 15, g: 0.5 } });
assert.equal(usda.unidad.nombre, "unidad", "reconoce el kiwi aunque venga de otra base");
assert.equal(usda.gramos, 75);
const sinRegla = prepararItem({ nombre: "Producto raro", por100: { kcal: 100, p: 1, c: 1, g: 1 } });
assert.equal(sinRegla.unidad.nombre, "porción");
assert.equal(sinRegla.gramos, 100);
assert.ok(!unidadesDe({ nombre: "Producto raro" }).some((u) => u.nombre === "cucharada"));
assert.ok(!unidadesDe({ nombre: "Bondiola de cerdo", por100: { kcal: 250 } }).some((u) => u.nombre.includes("cuchar")), "nada de cucharada de cerdo");
assert.equal(unidadesDe({ nombre: "Cacao amargo en polvo" })[0].nombre, "cucharada");
assert.equal(unidadesDe({ nombre: "Fideos tirabuzón", por100: { kcal: 350 } })[0].nombre, "porción en crudo", "fideos secos");
assert.deepEqual(unidadesDe({ nombre: "Fideos cocidos", por100: { kcal: 158 } })[0], { nombre: "plato", g: 200 });
assert.equal(buscarTipicosArriba("mate")[0].por100.kcal, 0, "el mate no tiene calorías");
assert.equal(buscarTipicosArriba("cafe")[0].por100.kcal, 0, "el café solo tampoco");
assert.deepEqual(buscarTipicosArriba("arandanos")[0].medidas[0], { nombre: "porción de 25 unidades", g: 35 });
const receta = prepararItem({ nombre: "Arroz cocido", gramos: 230, por100: { kcal: 130, p: 2, c: 28, g: 0 } });
assert.equal(receta.gramos, 230, "las recetas conservan sus gramos");
assert.equal(receta.unidad.nombre, "g");
const guardado = prepararItem({ ...conCantidad(prepararItem(kiwi), 3) });
assert.equal(guardado.cantidad, 3, "al editar conserva la cantidad");
assert.equal(guardado.unidad.nombre, "unidad");
const medio = conCantidad(prepararItem(kiwi), 1);
assert.equal(restar(medio), 0.5);
assert.equal(sumar({ ...medio, cantidad: 0.5 }), 1);
const aceite = prepararItem({ nombre: "Aceite de oliva", por100: { kcal: 884, p: 0, c: 0, g: 100 } });
assert.equal(aceite.unidad.nombre, "cucharada");
assert.equal(aceite.gramos, 14);
const { buscarTipicos } = await import("../../src/data/alimentos-ar.js");
assert.equal(buscarTipicos("kiwis")[0].nombre, "Kiwi");
assert.equal(buscarTipicos("KIWI")[0].nombre, "Kiwi");
assert.ok(buscarTipicos("pan de").length > 0);

// ---------- Totales sin doble conteo ----------
const { sumarComidas, configurarTotales } = await import("../../src/lib/macros.js");
const fila2 = (tipo, kcal, p, extra = {}) => ({ usuario_id: "a", fecha: "2026-11-07", tipo, calorias: kcal, proteinas: p, carbohidratos: 10, grasas: 5, ...extra });
const dia2 = [fila2("resumen", 1085, 0), fila2("almuerzo", 700, 40)];
configurarTotales({});
assert.deepEqual(sumarComidas([fila2("almuerzo", 700, 40), fila2("cena", 500, 30)]), { kcal: 1200, p: 70, c: 20, g: 10 }, "sin total se suman");
assert.deepEqual(sumarComidas(dia2), { kcal: 1085, p: 40, c: 10, g: 5 }, "por defecto, el mayor de cada dato");
assert.deepEqual(sumarComidas([...dia2, fila2("cena", 1500, 60)]), { kcal: 2200, p: 100, c: 20, g: 10 }, "una cena cargada que no está en Salud se suma");
configurarTotales({ a: { id: "a", modo_total: "salud" } });
assert.deepEqual(sumarComidas(dia2), { kcal: 1085, p: 0, c: 10, g: 5 }, "en modo Salud manda Salud");
configurarTotales({ a: { id: "a", modo_total: "mayor" } });
assert.deepEqual(sumarComidas(dia2), { kcal: 1085, p: 40, c: 10, g: 5 }, "el mayor de cada dato");
configurarTotales({ a: { id: "a", modo_total: "sumar" } });
assert.deepEqual(sumarComidas(dia2), { kcal: 1785, p: 40, c: 20, g: 10 }, "todo junto");
configurarTotales({ a: { id: "a", modo_total: "salud" } });
assert.equal(sumarComidas([fila2("resumen", 500, 20), fila2("almuerzo", 700, 40, { fecha: "2026-11-06" })]).kcal, 1200, "días distintos se suman");
assert.equal(sumarComidas([fila2("resumen", 500, 20), fila2("almuerzo", 700, 40, { usuario_id: "b" })]).kcal, 1200, "personas distintas se suman");
assert.deepEqual(sumarComidas([]), { kcal: 0, p: 0, c: 0, g: 0 });
configurarTotales({});

// ---------- Historial de alimentos ----------
const { alimentosUsados, buscarEnHistorial, combosDe } = await import("../../src/lib/historial.js");
const usada = (i, alimentos, usuario = "a") => ({ id: `h${i}`, usuario_id: usuario, creado_en: `2026-11-0${i}T12:00:00Z`, alimentos });
const hist2 = alimentosUsados([
  usada(1, [{ nombre: "Papines", fuente: "importado", gramos: 150, kcal: 120, p: 2, c: 26, g: 1, por100: { kcal: 80, p: 1.3, c: 17, g: 0.7 } }]),
  usada(2, [{ nombre: "Pollo", gramos: 200, por100: { kcal: 165, p: 31, c: 0, g: 3.6 }, id: "x" }, { nombre: "Importado", fuente: "importado", kcal: 900 }]),
  usada(3, [{ nombre: "papines", fuente: "manual", kcal: 130, p: 2, c: 28, g: 1 }, { nombre: "Foto", fuente: "foto" }]),
  usada(4, [{ nombre: "Milanesa" }], "b"),
], "a");
assert.deepEqual(hist2.recientes.map((h) => h.alimento.nombre), ["papines", "Pollo"], "lo más nuevo primero y sin repetir");
assert.equal(hist2.recientes[0].veces, 2, "sin distinguir mayúsculas");
assert.equal(hist2.recientes[1].alimento.id, undefined, "sin el id viejo");
assert.ok(!hist2.todos.some((h) => /importado|foto|milanesa/i.test(h.alimento.nombre)), "sin genéricos ni lo de otros");
assert.deepEqual(buscarEnHistorial(hist2.todos, "pap").map((h) => h.alimento.nombre), ["papines"]);
assert.deepEqual(buscarEnHistorial(hist2.todos, "x"), []);
const combo = (i, tipo, nombres, extra = {}) => ({ id: `k${i}`, usuario_id: "a", tipo, fecha: `2026-11-0${i}`, creado_en: `2026-11-0${i}T17:00:00Z`, calorias: 300, descripcion: `Merienda ${i}`, alimentos: nombres.map((n) => ({ nombre: n, kcal: 100 })), ...extra });
const combos2 = combosDe([
  combo(1, "merienda", ["Mate", "Tostadas"]),
  combo(3, "merienda", ["tostadas", "mate"]),
  combo(2, "merienda", ["Yogur"]),
  combo(4, "almuerzo", ["Pollo"]),
  combo(5, "merienda", ["Foto"], { alimentos: [{ nombre: "Foto", fuente: "foto" }] }),
  combo(6, "merienda", ["Alfajor"], { usuario_id: "b" }),
], "a", "merienda");
assert.deepEqual(combos2.map((c) => c.nombre), ["Merienda 3", "Merienda 2"], "sin repetir el mismo combo, lo más nuevo primero");
assert.equal(combos2[0].alimentos.length, 2);

// ---------- Perfil ----------
const { comidasFavoritas, estadisticas, porDia } = await import("../../src/lib/perfil.js");
const hist = [
  { id: "1", usuario_id: "a", fecha: haceDias(0), tipo: "almuerzo", calorias: 800, proteinas: 40, carbohidratos: 50, grasas: 20, foto_path: "x", alimentos: [{ nombre: "Milanesa", por100: {} }, { nombre: "Puré", por100: {} }] },
  { id: "2", usuario_id: "a", fecha: haceDias(0), tipo: "cena", calorias: 400, proteinas: 20, carbohidratos: 10, grasas: 10, alimentos: [{ nombre: "milanesa", por100: {} }] },
  { id: "3", usuario_id: "a", fecha: haceDias(1), tipo: "resumen", calorias: 2000, proteinas: 100, carbohidratos: 200, grasas: 50, descripcion: "Resumen importado", alimentos: [{ nombre: "Importado", fuente: "importado" }] },
  { id: "4", usuario_id: "a", fecha: haceDias(1), tipo: "cena", calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, foto_path: "y", descripcion: "Cena", alimentos: [{ nombre: "Foto", fuente: "foto" }] },
];
const dias2 = porDia(hist);
assert.equal(dias2.length, 2);
assert.equal(dias2[0].fecha, haceDias(0), "lo más nuevo primero");
assert.equal(dias2[0].total.kcal, 1200);
assert.equal(dias2[1].total.kcal, 2000, "la foto no suma");
assert.deepEqual(estadisticas(hist), { dias: 2, racha: 2, fotos: 2, kcal: 1600, proteinas: 80 });
assert.deepEqual(estadisticas([]), { dias: 0, racha: 0, fotos: 0, kcal: 0, proteinas: 0 });
const fav = comidasFavoritas(hist);
assert.equal(fav[0].veces, 2, "sin distinguir mayúsculas");
assert.equal(fav.length, 2, "lo importado y las fotos no son favoritas");

// ---------- Logros por niveles ----------
const { LOGROS, cantidades, medallasGanadas, mejorRacha, nivelDe, nivelesGuardados, nombreDeCodigo } = await import("../../src/lib/medallas.js");
const hora = (d, h) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 10, 0, 0); return x.toISOString(); };
const com = (i, extra = {}) => ({ id: `f${i}`, usuario_id: "a", fecha: haceDias(i % 20), tipo: "almuerzo", calorias: 500, proteinas: 10, descripcion: "Algo", alimentos: [], creado_en: hora(i % 20, 13), ...extra });
const base2 = { usuarioId: "a", comidas: [], agua: [], reacciones: [], desafios: [], perfiles, salud: null, pesos: [], yaGanadas: [] };
const logros = (lista, extra = {}) => medallasGanadas({ ...base2, comidas: lista, ...extra });
const varias = (n, extra) => Array.from({ length: n }, (_, i) => com(i, extra));

for (const l of LOGROS) {
  assert.ok(l.niveles.length >= 5, l.codigo);
  l.niveles.reduce((a, n) => { assert.ok(n.meta > a, `${l.codigo}: las metas suben`); return n.meta; }, 0);
  assert.equal(new Set(l.niveles.map((n) => n.nombre)).size, l.niveles.length, `${l.codigo}: nombres distintos`);
}
assert.equal(new Set(LOGROS.map((l) => l.codigo)).size, LOGROS.length);

// El ejemplo pedido
const mate = LOGROS.find((l) => l.codigo === "mate");
assert.deepEqual(mate.niveles.map((n) => n.meta), [10, 20, 50, 100, 300]);
assert.equal(mate.niveles[0].nombre, "Cebador novato");
assert.equal(mate.niveles[4].nombre, "Rey del mate");
assert.equal(nivelDe(mate, 9), 0);
assert.equal(nivelDe(mate, 10), 1);
assert.equal(nivelDe(mate, 299), 4);
assert.equal(nivelDe(mate, 300), 5);
const mila = LOGROS.find((l) => l.codigo === "milanesa");
assert.equal(mila.niveles[0].nombre, "Bebé de la milanesa");
assert.equal(mila.niveles[0].meta, 5);
assert.equal(mila.niveles[4].nombre, "Rey de la milanesa");
assert.ok(mila.niveles[4].meta >= 200, "rey es con muchísimas");

// Sube de a un nivel y no repite
assert.deepEqual(logros([]), []);
const mates = (n) => varias(n, { descripcion: "Mate" });
assert.deepEqual(logros(mates(25), { yaGanadas: ["comidas:1"] }).filter((c) => c.startsWith("mate")), ["mate:1", "mate:2"]);
assert.deepEqual(logros(mates(25), { yaGanadas: ["mate:1"] }).filter((c) => c.startsWith("mate")), ["mate:2"]);
assert.deepEqual(logros(mates(25), { yaGanadas: ["mate:2"] }).filter((c) => c.startsWith("mate")), [], "tener un nivel incluye los anteriores");
assert.deepEqual(logros(mates(120), { yaGanadas: ["mate:2"] }).filter((c) => c.startsWith("mate")), ["mate:3", "mate:4"]);
assert.equal(nombreDeCodigo("mate:4"), "Cebador avanzado");
assert.equal(nombreDeCodigo("victoria:abc"), undefined);
assert.deepEqual(nivelesGuardados(["mate:1", "mate:3", "pizza:2", "victoria:x", "viejo"]), { mate: 3, pizza: 2 });

// Cuenta toda la historia
const viejas = Array.from({ length: 60 }, (_, i) => com(i, { id: `h${i}`, fecha: haceDias(100 + i), creado_en: hora(100 + i, 13), descripcion: "Milanesa" }));
assert.ok(logros(viejas).includes("milanesa:3"), "más allá de los últimos 30 días");

// Cada logro
const c0 = (lista, extra = {}) => cantidades({ ...base2, comidas: lista, ...extra });
assert.equal(c0(varias(5, { privada: true, descripcion: "Milanesa" })).milanesa, 0, "lo privado no cuenta");
assert.equal(c0(varias(3, { alimentos: [{ nombre: "Vacío a la parrilla" }] })).parrillero, 3);
assert.equal(c0([com(0, { calorias: 1500 })]).bomba, 1);
assert.equal(c0([com(0, { calorias: 3000, tipo: "resumen" })]).bomba, 0, "un total importado no es una comida");
assert.equal(c0([com(0, { creado_en: hora(0, 3) })]).heladera, 1);
assert.equal(c0([com(0, { creado_en: hora(0, 3), alimentos: [{ nombre: "Importado", fuente: "importado" }] })]).heladera, 0, "importar de noche no cuenta");
assert.equal(c0(["desayuno", "almuerzo", "merienda", "cena"].map((tipo) => com(0, { id: tipo, tipo }))).cuatro, 1);
const metas = { a: { id: "a", nombre: "Ana", meta_calorias: 2000 } };
assert.equal(c0([com(0, { calorias: 3000 })], { perfiles: metas }).gordito, 1);
assert.equal(c0([com(0, { calorias: 2900 })], { perfiles: metas }).gordito, 0);
assert.equal(c0(varias(20, { foto_path: "x" })).fotografo, 20);
assert.equal(c0(varias(7, { alimentos: [{ nombre: "Tostada" }] })).monotematico, 7);
assert.equal(c0(Array.from({ length: 5 }, (_, i) => com(i, { tipo: "desayuno", creado_en: hora(i, 7) }))).madrugador, 5);
assert.equal(c0([com(0), com(1, { alimentos: [{ nombre: "Foto", fuente: "foto" }] })]).comidas, 1, "la foto suelta no es una comida");
assert.equal(c0([], { agua: [{ usuario_id: "a", ml: 2000 }, { usuario_id: "a", ml: 1000 }, { usuario_id: "b", ml: 3000 }] }).agua, 1);
assert.equal(c0([com(0)], { reacciones: [{ comida_id: "f0" }, { comida_id: "f0" }, { comida_id: "otra" }] }).fotogenico, 2);
assert.equal(c0([], { salud: { ...salud, peso_kg: 75.5 }, pesos: [{ peso_kg: 90 }, { peso_kg: 75.5 }] }).peso, 14, "kilos hacia el objetivo");
assert.equal(c0([], { salud, pesos: [{ peso_kg: 80 }] }).peso, 0, "subir cuando se quiere bajar no suma");
assert.equal(mejorRacha([haceDias(0), haceDias(1), haceDias(2), haceDias(10), haceDias(11)]), 3);
assert.equal(mejorRacha([]), 0);
assert.ok(logros(Array.from({ length: 8 }, (_, i) => com(i))).includes("racha:1"));

console.log("lógica, notificaciones, medidas, perfil y logros: todas las pruebas pasaron");

