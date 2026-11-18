// Registros del día: creatina, gym, fútbol, running... y los que escriba cada uno. Se tildan cada día. Son privados.
import { useCallback, useEffect, useState } from "react";
import { Activity, CircleCheck, Dumbbell, Footprints, Milk, PersonStanding, Pill, Tablets, Trophy, Volleyball } from "lucide-react";
import { supabase } from "./supabase.js";
import { aFecha, fechaLocal, haceDias } from "./fechas.js";

// Los que vienen armados. Los códigos son los de la base (SQL 043 y 053).
export const REGISTROS = [
  { codigo: "creatina", nombre: "Creatina", accion: "Tomé la creatina", icono: Pill, tipo: "tomar" },
  { codigo: "gym", nombre: "Gym", accion: "Fui al gym", icono: Dumbbell, tipo: "actividad" },
  { codigo: "magnesio", nombre: "Magnesio", accion: "Tomé el magnesio", icono: Tablets, tipo: "tomar" },
  { codigo: "futbol", nombre: "Fútbol", accion: "Jugué al fútbol", icono: Volleyball, tipo: "actividad", nuevo: true },
  { codigo: "running", nombre: "Running", accion: "Salí a correr", icono: Footprints, tipo: "actividad", nuevo: true },
  { codigo: "padel", nombre: "Pádel", accion: "Jugué al pádel", icono: Trophy, tipo: "actividad", nuevo: true },
  { codigo: "caminata", nombre: "Caminata", accion: "Salí a caminar", icono: PersonStanding, tipo: "actividad", nuevo: true },
  { codigo: "proteina", nombre: "Proteína", accion: "Tomé la proteína", icono: Milk, tipo: "tomar", nuevo: true },
  { codigo: "vitaminas", nombre: "Vitaminas", accion: "Tomé las vitaminas", icono: Pill, tipo: "tomar", nuevo: true },
];

export const TIPOS_PROPIOS = [
  ["actividad", "Actividad", Activity],
  ["tomar", "Para tomar", Pill],
  ["otro", "Otro", CircleCheck],
];
const ICONO_TIPO = Object.fromEntries(TIPOS_PROPIOS.map(([id, , icono]) => [id, icono]));
const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

// Todos los que puede elegir cada uno: los armados y los suyos.
export function definiciones(config) {
  const propios = (config.personalizados || []).map((p) => ({
    codigo: p.codigo,
    nombre: p.nombre,
    accion: p.nombre,
    icono: ICONO_TIPO[p.tipo] || CircleCheck,
    tipo: p.tipo,
    propio: true,
  }));
  return [...REGISTROS, ...propios];
}

const EVENTO = "lomada:registros";
// Cada tilde avisa (para los logros de gym y creatina).
export const EVENTO_TILDE = "lomada:registro-tildado";
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
  const [config, setConfig] = useState(() => ({ personalizados: [], ...(leerLocal(usuarioId) || { activos: [], aviso: true }) }));
  // Sin el SQL 053 no hay registros propios ni otros recordatorios: queda como antes.
  const [sin053, setSin053] = useState(false);
  const [marcas, setMarcas] = useState(() => new Set());
  const [listo, setListo] = useState(false);
  const [sinBase, setSinBase] = useState(false);

  const cargar = useCallback(async () => {
    if (!usuarioId) return;
    let [conf, filas] = await Promise.all([
      supabase.from("registros_config").select("activos, aviso, personalizados").eq("usuario_id", usuarioId).maybeSingle(),
      supabase.from("registros_diarios").select("fecha, codigo").eq("usuario_id", usuarioId).gte("fecha", haceDias(DIAS)),
    ]);
    if (conf.error && /personalizados/.test(conf.error.message || "")) {
      conf = await supabase.from("registros_config").select("activos, aviso").eq("usuario_id", usuarioId).maybeSingle();
      setSin053(true);
    } else if (!conf.error) setSin053(false);
    if (conf.error || filas.error) {
      // Falta correr el SQL: la elección queda en el celu y no se puede tildar todavía.
      setSinBase(true);
    } else {
      setSinBase(false);
      if (conf.data) {
        const nueva = { activos: conf.data.activos || [], aviso: conf.data.aviso !== false, personalizados: conf.data.personalizados || [] };
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
    // El orden es siempre el mismo: primero los armados y después los propios, como se agregaron.
    nueva.activos = definiciones(nueva).map((r) => r.codigo).filter((c) => nueva.activos.includes(c));
    setConfig(nueva);
    guardarLocal(usuarioId, nueva);
    const { error } = await supabase.from("registros_config").upsert(
      { usuario_id: usuarioId, activos: nueva.activos, aviso: nueva.aviso, ...(sin053 ? {} : { personalizados: nueva.personalizados || [] }), actualizado_en: new Date().toISOString() },
      { onConflict: "usuario_id" },
    );
    window.dispatchEvent(new Event(EVENTO));
    return !error;
  }

  // Uno escrito por cada uno ("Yoga", "Estirar", "Omega 3"). Queda elegido.
  async function agregarPropio(nombre, tipo) {
    const limpio = nombre.trim().slice(0, 30);
    if (!limpio) return false;
    const base = `p-${slug(limpio) || "registro"}`;
    const usados = new Set(definiciones(config).map((r) => r.codigo));
    let codigo = base;
    for (let i = 2; usados.has(codigo); i += 1) codigo = `${base}-${i}`;
    return guardarConfig({ personalizados: [...(config.personalizados || []), { codigo, nombre: limpio, tipo }], activos: [...config.activos, codigo] });
  }

  async function quitarPropio(codigo) {
    return guardarConfig({ personalizados: (config.personalizados || []).filter((p) => p.codigo !== codigo), activos: config.activos.filter((c) => c !== codigo) });
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
    window.dispatchEvent(new CustomEvent(EVENTO_TILDE, { detail: { fecha, codigo, puso: !tenia } }));
    return true;
  }

  return { config, marcas, listo, sinBase, sin053, guardarConfig, agregarPropio, quitarPropio, alternar };
}
