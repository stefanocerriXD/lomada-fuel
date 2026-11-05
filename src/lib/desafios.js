import { aFecha, fechaLocal } from "./fechas.js";

export const TIPOS_DESAFIO = [
  { id: "proteina", titulo: "Reto de proteína", emoji: "💪", meta: 120, unidad: "g", etiqueta: "Proteína por día (g)", regla: (m) => `Llegar a ${m} g de proteína por día` },
  { id: "constancia", titulo: "Racha de registros", emoji: "📅", meta: 3, unidad: "comidas", etiqueta: "Comidas por día", regla: (m) => `Cargar al menos ${m} comidas por día` },
  { id: "agua", titulo: "Reto de agua", emoji: "💧", meta: 2000, unidad: "ml", etiqueta: "Agua por día (ml)", regla: (m) => `Tomar ${Number(m).toLocaleString("es-AR")} ml de agua por día` },
  { id: "fotos", titulo: "Reto de fotos", emoji: "📸", meta: 10, unidad: "fotos", etiqueta: "Fotos a subir", regla: (m) => `Subir ${m} comidas con foto` },
];

export const tipoDesafio = (id) => TIPOS_DESAFIO.find((t) => t.id === id) || TIPOS_DESAFIO[0];

export function diasDelDesafio(desafio) {
  const dias = [];
  for (let d = aFecha(desafio.inicio); fechaLocal(d) <= desafio.fin; d.setDate(d.getDate() + 1)) dias.push(fechaLocal(d));
  return dias;
}

export const desafioTerminado = (desafio) => desafio.fin < fechaLocal();

export function diasRestantes(desafio) {
  return Math.max(0, Math.round((aFecha(desafio.fin) - aFecha(fechaLocal())) / 86400000) + 1);
}

// Las comidas privadas no cuentan: así todos ven el mismo ranking.
export function puntajes(desafio, perfiles, comidas, agua) {
  const dias = diasDelDesafio(desafio);
  const meta = Number(desafio.meta);
  const publicas = comidas.filter((c) => !c.privada && c.fecha >= desafio.inicio && c.fecha <= desafio.fin);

  return Object.values(perfiles)
    .map((perfil) => {
      const propias = publicas.filter((c) => c.usuario_id === perfil.id);
      const delDia = (d) => propias.filter((c) => c.fecha === d);
      let puntos = 0;
      if (desafio.tipo === "proteina") puntos = dias.filter((d) => delDia(d).reduce((t, c) => t + Number(c.proteinas || 0), 0) >= meta).length;
      if (desafio.tipo === "constancia") puntos = dias.filter((d) => delDia(d).length >= meta).length;
      if (desafio.tipo === "agua") puntos = dias.filter((d) => (agua.find((a) => a.usuario_id === perfil.id && a.fecha === d)?.ml || 0) >= meta).length;
      if (desafio.tipo === "fotos") puntos = propias.filter((c) => c.foto_path).length;
      return { perfil, puntos };
    })
    .sort((a, b) => b.puntos - a.puntos || a.perfil.nombre.localeCompare(b.perfil.nombre));
}

export const objetivoDesafio = (desafio) => (desafio.tipo === "fotos" ? Number(desafio.meta) : diasDelDesafio(desafio).length);
