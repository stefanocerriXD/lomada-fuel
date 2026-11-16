// Registros del día: creatina, gym, magnesio. Cada uno elige cuáles usar y los tilda. Son privados.
import { useCallback, useEffect, useState } from "react";
import { Dumbbell, Pill, Tablets } from "lucide-react";
import { supabase } from "./supabase.js";
import { aFecha, fechaLocal, haceDias } from "./fechas.js";

export const REGISTROS = [
  { codigo: "creatina", nombre: "Creatina", accion: "Tomé la creatina", icono: Pill },
  { codigo: "gym", nombre: "Gym", accion: "Fui al gym", icono: Dumbbell },
  { codigo: "magnesio", nombre: "Magnesio", accion: "Tomé el magnesio", icono: Tablets },
];

const EVENTO = "lomada:registros";
const DIAS = 120;
const claveConfig = (uid) => `lomada-registros-${uid}`;
const leerLocal = (uid) => {
  try {
    return JSON.parse(localStorage.getItem(claveConfig(uid)) || "null");
  } catch {
    return null;
  }
};
const guardarLocal = (uid, config) => {
  try {
    localStorage.setItem(claveConfig(uid), JSON.stringify(config));
  } catch {
    // Sin almacenamiento: queda solo en la base.
  }
};

// Días seguidos con ese registro, contando hasta hoy (o hasta ayer si hoy todavía no lo tildaste).
export function rachaDe(marcas, codigo, hoy = fechaLocal()) {
  let dia = marcas.has(`${hoy}|${codigo}`) ? hoy : haceDias(1, aFecha(hoy));
  let n = 0;
  while (marcas.has(`${dia}|${codigo}`)) {
    n += 1;
    dia = haceDias(1, aFecha(dia));
  }
  return n;
}

export function useRegistros(usuarioId) {
  const [config, setConfig] = useState(() => leerLocal(usuarioId) || { activos: [], aviso: true });
  const [marcas, setMarcas] = useState(() => new Set());
  const [listo, setListo] = useState(false);
  const [sinBase, setSinBase] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuarioId) return;
    const [conf, filas] = await Promise.all([
      supabase.from("registros_config").select("activos, aviso").eq("usuario_id", usuarioId).maybeSingle(),
      supabase.from("registros_diarios").select("fecha, codigo").eq("usuario_id", usuarioId).gte("fecha", haceDias(DIAS)),
    ]);
    if (conf.error || filas.error) {
      // Falta correr el SQL: la elección queda en el celu y no se puede tildar todavía.
      setSinBase(true);
    } else {
      setSinBase(false);
      if (conf.data) {
        const nueva = { activos: conf.data.activos || [], aviso: conf.data.aviso !== false };
        setConfig(nueva);
        guardarLocal(usuarioId, nueva);
      }
      setMarcas(new Set((filas.data || []).map((f) => `${f.fecha}|${f.codigo}`)));
    }
    setListo(true);
  }, [usuarioId]);

  useEffect(() => {
    cargar();
    const otra = () => cargar();
    window.addEventListener(EVENTO, otra);
    return () => window.removeEventListener(EVENTO, otra);
  }, [cargar]);

  async function guardarConfig(cambios) {
    const nueva = { ...config, ...cambios };
    // El orden es siempre el mismo: creatina, gym, magnesio.
    nueva.activos = REGISTROS.map((r) => r.codigo).filter((c) => nueva.activos.includes(c));
    setConfig(nueva);
    guardarLocal(usuarioId, nueva);
    const { error } = await supabase.from("registros_config").upsert(
      { usuario_id: usuarioId, activos: nueva.activos, aviso: nueva.aviso, actualizado_en: new Date().toISOString() },
      { onConflict: "usuario_id" },
    );
    window.dispatchEvent(new Event(EVENTO));
    return !error;
  }

  async function alternar(fecha, codigo) {
    const clave = `${fecha}|${codigo}`;
    const tenia = marcas.has(clave);
    const cambiar = (poner) => setMarcas((prev) => {
      const nuevo = new Set(prev);
      if (poner) nuevo.add(clave);
      else nuevo.delete(clave);
      return nuevo;
    });
    cambiar(!tenia);
    const { error } = tenia
      ? await supabase.from("registros_diarios").delete().eq("usuario_id", usuarioId).eq("fecha", fecha).eq("codigo", codigo)
      : await supabase.from("registros_diarios").upsert({ usuario_id: usuarioId, fecha, codigo }, { onConflict: "usuario_id,fecha,codigo", ignoreDuplicates: true });
    if (error) {
      cambiar(tenia);
      return false;
    }
    return true;
  }

  return { config, marcas, listo, sinBase, guardarConfig, alternar };
}
