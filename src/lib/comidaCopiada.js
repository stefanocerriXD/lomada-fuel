import { useEffect, useState } from "react";

// Una comida copiada en Resumen para pegarla en otro día. Queda en este teléfono hasta que se descarta.
const CLAVE = "lomada-comida-copiada";
const EVENTO = "lomada-comida-copiada";
let enMemoria = null;

export function leerCopiada() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "null") || enMemoria;
  } catch {
    return enMemoria;
  }
}

function guardar(dato) {
  enMemoria = dato;
  try {
    if (dato) localStorage.setItem(CLAVE, JSON.stringify(dato));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento queda en memoria mientras la app esté abierta.
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

// Se puede copiar lo que tiene alimentos o calorías (no la foto sola, ni la fiesta, ni los resúmenes).
export const sePuedeCopiar = (c) => !["resumen", "fiesta"].includes(c.tipo) && ((Number(c.calorias) || 0) > 0 || (c.alimentos || []).some((a) => a.nombre && a.fuente !== "foto"));

export function copiarComida(c) {
  const alimentos = (c.alimentos || []).filter((a) => a.nombre && a.fuente !== "foto").map(({ id, indice, ...a }) => a);
  const totales = { kcal: Number(c.calorias) || 0, p: Number(c.proteinas) || 0, c: Number(c.carbohidratos) || 0, g: Number(c.grasas) || 0 };
  guardar({
    id: c.id,
    tipo: c.tipo,
    fecha: c.fecha,
    descripcion: c.descripcion || "",
    kcal: totales.kcal,
    // Sin alimentos (solo totales), va como uno cargado a mano.
    alimentos: alimentos.length ? alimentos : [{ nombre: c.descripcion || "Comida", fuente: "manual", ...totales }],
    // Si se habían ajustado los totales a mano, se respetan.
    ajuste: c.macros_editados && alimentos.length ? totales : null,
  });
}

export const olvidarCopiada = () => guardar(null);

export function useComidaCopiada() {
  const [copiada, setCopiada] = useState(leerCopiada);
  useEffect(() => {
    const cambio = () => setCopiada(leerCopiada());
    window.addEventListener(EVENTO, cambio);
    window.addEventListener("storage", cambio);
    return () => {
      window.removeEventListener(EVENTO, cambio);
      window.removeEventListener("storage", cambio);
    };
  }, []);
  return copiada;
}
