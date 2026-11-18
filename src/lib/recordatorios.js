// Recordatorios propios (SQL 053): varios por persona, a la hora que quiera (de a 15 minutos),
// los días que elija y con su texto. La base los manda cada 15 minutos.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export const MAX_RECORDATORIOS = 10;
const TODOS = [0, 1, 2, 3, 4, 5, 6];

// "20:07" -> { hora: 20, minuto: 0 }: los minutos van de a 15.
export function leerHora(texto) {
  const [h, m] = String(texto || "").split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  const minuto = Math.round((Number.isFinite(m) ? m : 0) / 15) * 15;
  return minuto === 60 ? { hora: (h + 1) % 24, minuto: 0 } : { hora: h, minuto };
}
export const textoHora = (r) => `${String(r.hora).padStart(2, "0")}:${String(r.minuto).padStart(2, "0")}`;

export function useRecordatorios(usuarioId) {
  const [lista, setLista] = useState(null);
  const [sinTabla, setSinTabla] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("recordatorios").select("id, hora, minuto, dias, texto, solo_si_falta, activo, creado_en").eq("usuario_id", usuarioId).order("creado_en");
    if (error) {
      setSinTabla(true);
      setLista([]);
      return;
    }
    setSinTabla(false);
    setLista(data || []);
  }, [usuarioId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function crear(datos = {}) {
    const fila = { usuario_id: usuarioId, hora: 20, minuto: 0, dias: TODOS, texto: null, solo_si_falta: true, activo: true, ...datos };
    const { data, error } = await supabase.from("recordatorios").insert(fila).select("id, hora, minuto, dias, texto, solo_si_falta, activo, creado_en").single();
    if (error) return false;
    setLista((l) => [...(l || []), data || { id: `n${Date.now()}`, ...fila }]);
    return true;
  }

  async function cambiar(id, cambios) {
    const antes = lista;
    setLista((l) => l.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
    const { error } = await supabase.from("recordatorios").update(cambios).eq("id", id);
    if (error) setLista(antes);
    return !error;
  }

  async function borrar(id) {
    const antes = lista;
    setLista((l) => l.filter((r) => r.id !== id));
    const { error } = await supabase.from("recordatorios").delete().eq("id", id);
    if (error) setLista(antes);
    return !error;
  }

  return { lista, sinTabla, crear, cambiar, borrar };
}
