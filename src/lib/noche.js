// La noche del modo fiesta: se guarda en el celu y se sube. Va aparte para que el modo fiesta se baje recién al abrirlo.
import { supabase } from "./supabase.js";
import { fechaLocal, haceDias } from "./fechas.js";
import { vasoDe } from "../data/tragos.js";

// La noche sigue siendo la misma hasta el mediodía: el vaso de las 7 de la mañana es de la noche anterior.
export const HORA_FIN_NOCHE = 12;
export function fechaDeLaNoche(d = new Date()) {
  return d.getHours() < HORA_FIN_NOCHE ? haceDias(1, d) : fechaLocal(d);
}
export const esDeNoche = (d = new Date()) => d.getHours() >= 20 || d.getHours() < 6;

export const numero = (n) => Math.round(n).toLocaleString("es-AR");
export const MAX_FOTOS_NOCHE = 4;
export const sumarVasos = (lista) => lista.reduce((t, v) => ({ kcal: t.kcal + v.kcal, p: t.p + v.p, c: t.c + v.c, g: t.g + v.g, alcohol: t.alcohol + (v.alcohol || 0) }), { kcal: 0, p: 0, c: 0, g: 0, alcohol: 0 });

// La noche se guarda primero en el celu y después se sube: sin señal en el boliche no se pierde ningún vaso.
export const claveNoche = (usuarioId) => `lomada-fiesta-${usuarioId}`;
export const CLAVE_TRAGO = "lomada-ultimo-trago";
export const leer = (clave) => {
  try {
    return JSON.parse(localStorage.getItem(clave) || "null");
  } catch {
    return null;
  }
};
export const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento, se sube directo.
  }
};

// La noche de hoy: lo del celu si todavía no se subió; si no, lo de la base.
export function nocheActual(usuarioId, comidas, fecha = fechaDeLaNoche()) {
  const local = leer(claveNoche(usuarioId));
  if (local?.fecha === fecha && local.pendiente) return local;
  const guardada = comidas.find((c) => c.usuario_id === usuarioId && c.tipo === "fiesta" && c.fecha === fecha);
  return {
    fecha,
    id: guardada?.id || (local?.fecha === fecha ? local.id : null) || null,
    vasos: guardada?.alimentos || [],
    gol: guardada?.gol ?? null,
    foto_path: guardada?.foto_path || null,
    fotos_extra: guardada?.fotos_extra || [],
    salida: guardada?.salida || null,
    salida_con: guardada?.salida_con || [],
    pendiente: false,
  };
}

// Sube la noche entera (es una sola carga que se va actualizando). Si ya existe la actualiza; si no, la crea.
// Las columnas nuevas (gol y salida) se mandan solo si la base ya las tiene.
export async function subirNoche(usuarioId, noche, conGol = true) {
  const t = sumarVasos(noche.vasos);
  const fila = {
    descripcion: `Fiesta: ${noche.vasos.length} ${noche.vasos.length === 1 ? "vaso" : "vasos"}`,
    calorias: Math.round(t.kcal),
    proteinas: Math.round(t.p * 10) / 10,
    carbohidratos: Math.round(t.c * 10) / 10,
    grasas: Math.round(t.g * 10) / 10,
    alimentos: noche.vasos,
    macros_editados: false,
    foto_path: noche.foto_path || null,
    ...(noche.fotos_extra?.length || noche.habiaExtras ? { fotos_extra: noche.fotos_extra || [] } : {}),
    ...(conGol && typeof noche.gol === "boolean" ? { gol: noche.gol } : {}),
    ...(conGol && noche.salida ? { salida: noche.salida, salida_con: noche.salida_con || [] } : {}),
  };
  if (!noche.vasos.length && !noche.foto_path && typeof noche.gol !== "boolean" && !noche.salida) {
    const { error } = await supabase.from("comidas").delete().eq("id", noche.id);
    return !error;
  }
  const { data, error } = await supabase.from("comidas").update(fila).eq("id", noche.id).select("id");
  // Si la base todavía no tiene lo del gol (falta el SQL), los vasos se guardan igual.
  if (error && conGol && /gol|salida/.test(error.message || "")) return subirNoche(usuarioId, noche, false);
  if (error) return false;
  if (data?.length) return true;
  const { error: errNueva } = await supabase.from("comidas").insert({ ...fila, id: noche.id, usuario_id: usuarioId, tipo: "fiesta", fecha: noche.fecha, privada: false });
  if (errNueva && conGol && /gol|salida/.test(errNueva.message || "")) return subirNoche(usuarioId, noche, false);
  return !errNueva;
}

let subiendo = Promise.resolve(true);
// Guarda en el celu y sube; avisa si llegó a la base. Los cambios se suben de a uno, en orden.
export function guardarNoche(usuarioId, noche) {
  const conId = { ...noche, id: noche.id || crypto.randomUUID(), pendiente: true };
  escribir(claveNoche(usuarioId), conId);
  subiendo = subiendo.then(async () => {
    const actual = leer(claveNoche(usuarioId)) || conId;
    let ok = false;
    try {
      ok = await subirNoche(usuarioId, actual);
    } catch {
      ok = false;
    }
    // Solo se marca subida si mientras tanto no cambió nada más.
    if (ok && JSON.stringify(leer(claveNoche(usuarioId))) === JSON.stringify(actual)) escribir(claveNoche(usuarioId), { ...actual, pendiente: false });
    return ok;
  });
  return { noche: conId, subida: subiendo };
}

// Lo que quedó en el celu sin señal se sube apenas vuelve la conexión o se abre la app.
export async function sincronizarNoche(usuarioId) {
  const local = leer(claveNoche(usuarioId));
  if (!local?.pendiente) return false;
  return guardarNoche(usuarioId, local).subida;
}

// El último trago (y su tamaño) para seguir sumando con un toque.
export function ultimoTrago(vasos = []) {
  const v = vasos[vasos.length - 1];
  if (v?.ml) {
    const f = 100 / v.ml;
    return { nombre: v.nombre, mezcla: v.mezcla || null, ml: v.ml, por100: { kcal: v.kcal * f, p: (v.p || 0) * f, c: (v.c || 0) * f, g: (v.g || 0) * f, alcohol: (v.alcohol || 0) * f } };
  }
  const guardado = leer(CLAVE_TRAGO);
  return guardado?.por100 ? guardado : null;
}

// +1 del último trago sin abrir el modo fiesta.
export function sumarUnVaso(usuarioId, comidas) {
  const noche = nocheActual(usuarioId, comidas);
  const trago = ultimoTrago(noche.vasos);
  if (!trago) return null;
  const vasos = [...noche.vasos, { ...vasoDe(trago, trago.ml), id: crypto.randomUUID(), hora: new Date().toISOString() }];
  return { ...guardarNoche(usuarioId, { ...noche, vasos }), trago };
}
