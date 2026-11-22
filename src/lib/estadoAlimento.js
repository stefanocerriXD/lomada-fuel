import { estadoTipico } from "../data/alimentos-ar.js";

// ¿Crudo o cocido? Lo dice la base propia; lo de USDA viene en inglés ("raw", "cooked"); si no, se mira el nombre.
const CRUDO = /\b(crud[oa]s?|raw)\b/i;
const COCIDO = /\b(cocid[oa]s?|hervid[oa]s?|grillad[oa]s?|asad[oa]s?|frit[oa]s?|al horno|a la plancha|parrilla|cooked|roasted|grilled|broiled|boiled|braised|baked|fried)\b/i;

export function estadoDe(alimento) {
  if (!alimento) return null;
  if (alimento.estado === "crudo" || alimento.estado === "cocido") return alimento.estado;
  const nombre = String(alimento.nombre || "");
  // Lo cargado de la lista antes de que guardara el estado: se busca por el nombre.
  if (alimento.fuente === "tipico") return estadoTipico(nombre);
  if (CRUDO.test(nombre)) return "crudo";
  if (alimento.fuente === "usda" && COCIDO.test(nombre)) return "cocido";
  return null;
}

// La etiqueta solo hace falta si el nombre no lo dice ya ("Merluza cocida" no necesita "Cocido").
export function etiquetaEstado(alimento) {
  const estado = estadoDe(alimento);
  if (!estado) return null;
  const nombre = String(alimento.nombre || "");
  if (alimento.fuente !== "usda" && (estado === "crudo" ? CRUDO : COCIDO).test(nombre)) return null;
  return estado === "crudo" ? "Crudo" : "Cocido";
}
