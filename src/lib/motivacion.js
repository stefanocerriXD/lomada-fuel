// El viaje y el Match Day de cada uno (SQL 052): destino y fecha del viaje; deporte, día y hora del partido.
// Solo lo ve cada uno. Los avisos los arma la base con estos datos.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const EVENTO = "lomada:motivacion";

// Ordenados de lunes a domingo; el número es el de la base (0 = domingo).
export const DIAS_SEMANA = [
  [1, "Lun", "lunes"],
  [2, "Mar", "martes"],
  [3, "Mié", "miércoles"],
  [4, "Jue", "jueves"],
  [5, "Vie", "viernes"],
  [6, "Sáb", "sábado"],
  [0, "Dom", "domingo"],
];
export const nombreDiaSemana = (n) => DIAS_SEMANA.find(([d]) => d === Number(n))?.[2] || "";
export const DEPORTES = ["fútbol", "pádel", "básquet", "tenis", "rugby", "hockey", "running"];

// datos: undefined mientras carga, null si todavía no armó nada.
export function useMotivacion(usuarioId) {
  const [datos, setDatos] = useState(undefined);
  const [sinTabla, setSinTabla] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("motivacion").select("*").eq("usuario_id", usuarioId).maybeSingle();
    if (error) {
      setSinTabla(true);
      setDatos(null);
      return;
    }
    setSinTabla(false);
    setDatos(data || null);
  }, [usuarioId]);

  useEffect(() => {
    cargar();
    const otra = () => cargar();
    window.addEventListener(EVENTO, otra);
    return () => window.removeEventListener(EVENTO, otra);
  }, [cargar]);

  const guardar = useCallback(async (cambios) => {
    const { error } = await supabase.from("motivacion").upsert({ usuario_id: usuarioId, ...cambios }, { onConflict: "usuario_id" });
    if (error) return false;
    window.dispatchEvent(new Event(EVENTO));
    return true;
  }, [usuarioId]);

  return { datos, sinTabla, guardar };
}
