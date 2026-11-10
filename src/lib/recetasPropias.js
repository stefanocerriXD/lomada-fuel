// Recetas propias: un budín, una tarta o un guiso que cada uno arma una vez con sus ingredientes
// y después carga por porción. La receta se convierte en un alimento más de la búsqueda.
import { macrosDeItem } from "./macros.js";

const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function totalesDeReceta(ingredientes = []) {
  return ingredientes.reduce(
    (t, i) => {
      const m = macrosDeItem(i);
      return { kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, g: t.g + m.g, gramos: t.gramos + (Number(i.gramos) || 0) };
    },
    { kcal: 0, p: 0, c: 0, g: 0, gramos: 0 },
  );
}

// El peso de la receta terminada manda (el budín pierde agua en el horno); si no está, la suma de los ingredientes.
export function pesoDeReceta(receta) {
  const porciones = Math.max(1, Number(receta.porciones) || 1);
  return Number(receta.peso_final) || totalesDeReceta(receta.ingredientes).gramos || porciones * 100;
}

// autor: el nombre de quien la armó, si es de otro integrante del grupo.
export function recetaComoAlimento(receta, autor = null) {
  const total = totalesDeReceta(receta.ingredientes);
  const porciones = Math.max(1, Number(receta.porciones) || 1);
  const peso = pesoDeReceta(receta);
  const por100 = Object.fromEntries(["kcal", "p", "c", "g"].map((k) => [k, Math.round((total[k] / peso) * 1000) / 10]));
  const porcion = Math.round((peso / porciones) * 10) / 10;
  return {
    id: `receta-${receta.id}`,
    receta_id: receta.id,
    nombre: receta.nombre,
    marca: autor ? `Receta de ${autor}` : "Tu receta",
    fuente: "receta",
    por100,
    medidas: porciones > 1 ? [{ nombre: `porción (1/${porciones})`, g: porcion }, { nombre: "receta entera", g: peso }] : [{ nombre: "receta entera", g: peso }],
  };
}

export function buscarRecetas(recetas, texto) {
  const partes = normal(texto).split(/\s+/).filter((p) => p.length > 1);
  if (!partes.length) return [];
  return recetas.filter((r) => {
    const palabras = normal(r.nombre).split(/[\s,]+/);
    return partes.every((p) => palabras.some((w) => w.startsWith(p)));
  });
}

// Mandar una receta por el chat: un mensaje con su nombre que lleva la receta adentro.
export async function compartirEnChat({ supabase, receta, usuarioId, agregarMensaje, emitirChat, avisarGrupo }) {
  if (receta.usuario_id === usuarioId && receta.compartida === false) {
    const { error } = await supabase.from("recetas_propias").update({ compartida: true }).eq("id", receta.id);
    if (error) throw error;
  }
  const fila = { id: crypto.randomUUID(), usuario_id: usuarioId, texto: `Compartió una receta: ${receta.nombre}`.slice(0, 1000), receta_id: receta.id };
  const { data, error } = await supabase.from("mensajes").insert(fila).select().single();
  if (error) throw error;
  agregarMensaje(data);
  emitirChat("mensaje", data);
  avisarGrupo("mensaje", data.id);
  return data;
}
