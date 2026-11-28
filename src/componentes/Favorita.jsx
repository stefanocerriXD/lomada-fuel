// Guardar cualquier comida (la tuya o la de otro) en tus favoritas, con sus alimentos, para repetirla después desde el +.
import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { tipoInfo } from "../lib/macros.js";
import { vibrar } from "./Base.jsx";

export function useFavorita(comida, avisar) {
  const { usuario, extras, cargarExtras } = useDatos();
  const [guardando, setGuardando] = useState(false);
  const alimentos = comida?.alimentos || [];
  const texto = comida ? comida.descripcion || tipoInfo(comida.tipo).texto : "";
  const nombre = texto.slice(0, 200);
  const favorita = (extras.favoritas || []).find((f) => f.nombre === nombre);
  // Ni el resumen del día, ni la fiesta, ni una foto sin calorías.
  const soloFoto = alimentos[0]?.fuente === "foto" && !comida?.calorias;
  const disponible = Boolean(comida) && extras.disponible && !["resumen", "fiesta"].includes(comida.tipo) && !soloFoto;

  async function alternar() {
    if (guardando) return;
    setGuardando(true);
    try {
      if (favorita) {
        const { error } = await supabase.from("favoritas").delete().eq("id", favorita.id);
        if (error) return avisar?.("No se pudo sacar");
        vibrar(8);
        avisar?.("Sacada de favoritas");
      } else {
        // Se guardan los alimentos (sin marcas de postre ni de quién la subió); sin detalle, los totales.
        const items = alimentos.length
          ? alimentos.map(({ postre, ...a }) => a)
          : [{ nombre: texto, fuente: "manual", kcal: comida.calorias, p: comida.proteinas, c: comida.carbohidratos, g: comida.grasas }];
        const { error } = await supabase.from("favoritas").insert({ usuario_id: usuario.id, nombre, alimentos: items });
        if (error) return avisar?.("No se pudo guardar");
        vibrar(12);
        avisar?.("Guardada en favoritas");
      }
      await cargarExtras();
    } finally {
      setGuardando(false);
    }
  }

  return { favorita, alternar, disponible, guardando };
}
