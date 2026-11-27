// Las historias de un día (Resumen): por comida, cada foto es una historia; la comida sin foto, una tarjeta.
// Van por hora de carga. No entran las planeadas, las privadas, el resumen del día ni la fiesta.
import { TIPOS } from "./macros.js";
import { puntuable } from "./estrellas.js";

const conAlimentos = (c) => (c.alimentos || []).some((a) => a.fuente !== "foto" && !/^(importado|foto)$/i.test(a.nombre || ""));

export function historiasDelDia(delDia) {
  return TIPOS.map((tipo) => {
    const lista = delDia
      .filter((c) => c.tipo === tipo.id && puntuable(c) && (c.foto_path || c.postre_foto || Number(c.calorias) > 0 || conAlimentos(c)))
      .sort((a, b) => (a.creado_en < b.creado_en ? -1 : a.creado_en > b.creado_en ? 1 : 0));
    const items = lista.flatMap((comida) => {
      const rutas = [comida.foto_path, ...(comida.fotos_extra || []), comida.postre_foto].filter(Boolean);
      return (rutas.length ? rutas : [null]).map((ruta, n) => ({ clave: `${comida.id}:${n}`, comida, ruta, postre: Boolean(ruta) && ruta === comida.postre_foto }));
    });
    return { tipo, items, personas: new Set(lista.map((c) => c.usuario_id)).size };
  });
}
