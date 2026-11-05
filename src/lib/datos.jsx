import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { accionWhoop } from "./api.js";
import { haceDias } from "./fechas.js";

const Contexto = createContext(null);
export const useDatos = () => useContext(Contexto);

const VENTANA_DIAS = 30;
const RENOVAR_FOTOS_MS = 50 * 60 * 1000; // Los links firmados duran 1 hora.

export const AVATAR_BASE = { emoji: "🍽️", color: "#E4572E", meta_calorias: 2000 };

export function DatosProvider({ usuario, children }) {
  const [perfiles, setPerfiles] = useState({});
  const [comidas, setComidas] = useState([]);
  const [fotos, setFotos] = useState({});
  const [estado, setEstado] = useState({ listo: false, error: "" });
  const [whoop, setWhoop] = useState({ disponible: false, conectado: false, dias: {} });
  // undefined: la tabla todavía no existe. null: existe, pero la persona no cargó su plan.
  const [salud, setSalud] = useState(undefined);
  const [pesos, setPesos] = useState([]);
  const [reacciones, setReacciones] = useState([]);
  const [extras, setExtras] = useState({ disponible: false, comentarios: [], favoritas: [], agua: [], ayuno: null, desafios: [], medallas: [] });
  const espera = useRef(null);

  const cargarPerfiles = useCallback(async () => {
    const { data, error } = await supabase.from("perfiles").select("*");
    if (error) throw error;
    setPerfiles(Object.fromEntries(data.map((p) => [p.id, { ...AVATAR_BASE, ...p }])));
  }, []);

  const firmarFotos = useCallback(async (lista) => {
    const rutas = lista.filter((c) => c.foto_path).map((c) => c.foto_path);
    if (!rutas.length) return;
    const { data } = await supabase.storage.from("fotos").createSignedUrls(rutas, 3600);
    setFotos(Object.fromEntries((data || []).filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl])));
  }, []);

  const cargarComidas = useCallback(async () => {
    const { data, error } = await supabase
      .from("comidas")
      .select("*")
      .gte("fecha", haceDias(VENTANA_DIAS))
      .order("creado_en", { ascending: false })
      .limit(800);
    if (error) throw error;
    await firmarFotos(data);
    setComidas(data);
    return data;
  }, [firmarFotos]);

  const cargarSalud = useCallback(async () => {
    const [cuerpo, historial] = await Promise.all([
      supabase.from("perfiles_salud").select("*").eq("usuario_id", usuario.id).maybeSingle(),
      supabase.from("pesos").select("*").eq("usuario_id", usuario.id).order("fecha", { ascending: true }).limit(180),
    ]);
    if (cuerpo.error) return setSalud(undefined);
    setSalud(cuerpo.data);
    setPesos(historial.data || []);
  }, [usuario.id]);

  const cargarReacciones = useCallback(async () => {
    const { data, error } = await supabase.from("reacciones").select("*").limit(3000);
    if (!error) setReacciones(data);
  }, []);

  const alternarReaccion = useCallback(
    async (comidaId, emoji) => {
      const clave = (r) => r.comida_id === comidaId && r.usuario_id === usuario.id && r.emoji === emoji;
      const fila = { comida_id: comidaId, usuario_id: usuario.id, emoji };
      let tenia = false;
      setReacciones((prev) => {
        tenia = prev.some(clave);
        return tenia ? prev.filter((r) => !clave(r)) : [...prev, fila];
      });
      const consulta = supabase.from("reacciones");
      const { error } = await (tenia
        ? consulta.delete().eq("comida_id", comidaId).eq("usuario_id", usuario.id).eq("emoji", emoji)
        : consulta.insert(fila));
      if (error) cargarReacciones();
    },
    [usuario.id, cargarReacciones],
  );

  const cargarExtras = useCallback(async () => {
    const desde = haceDias(VENTANA_DIAS);
    const [desafios, comentarios, favoritas, agua, ayuno, medallas] = await Promise.all([
      supabase.from("desafios").select("*").gte("fin", haceDias(VENTANA_DIAS)).order("inicio", { ascending: false }),
      supabase.from("comentarios").select("*").order("creado_en", { ascending: true }).limit(2000),
      supabase.from("favoritas").select("*").eq("usuario_id", usuario.id).order("creado_en", { ascending: false }),
      supabase.from("agua").select("*").gte("fecha", desde),
      supabase.from("ayunos").select("*").eq("usuario_id", usuario.id).order("inicio", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("medallas").select("*"),
    ]);
    if (desafios.error) return; // Las tablas todavía no existen.
    setExtras({
      disponible: true,
      desafios: desafios.data,
      comentarios: comentarios.data || [],
      favoritas: favoritas.data || [],
      agua: agua.data || [],
      ayuno: ayuno.data || null,
      medallas: medallas.data || [],
    });
  }, [usuario.id]);

  const cambiarAgua = useCallback(
    async (fecha, ml) => {
      const valor = Math.max(0, Math.min(ml, 15000));
      const fila = { usuario_id: usuario.id, fecha, ml: valor };
      setExtras((prev) => ({
        ...prev,
        agua: [...prev.agua.filter((a) => !(a.usuario_id === usuario.id && a.fecha === fecha)), fila],
      }));
      const { error } = await supabase.from("agua").upsert(fila, { onConflict: "usuario_id,fecha" });
      if (error) cargarExtras();
    },
    [usuario.id, cargarExtras],
  );

  const cargarWhoop = useCallback(
    async (forzar = false) => {
      const estado = await accionWhoop("sincronizar", forzar);
      let dias = {};
      if (estado.conectado) {
        const { data } = await supabase.from("whoop_dias").select("*").eq("usuario_id", usuario.id).gte("fecha", haceDias(VENTANA_DIAS));
        dias = Object.fromEntries((data || []).map((d) => [d.fecha, d]));
      }
      setWhoop({ ...estado, dias });
      return estado;
    },
    [usuario.id],
  );

  // WHOOP es un extra: si falla, el resto de la app sigue igual.
  useEffect(() => {
    cargarWhoop().catch(() => {});
  }, [cargarWhoop]);

  useEffect(() => {
    cargarSalud().catch(() => {});
    cargarReacciones().catch(() => {});
    cargarExtras().catch(() => {});
    // El bot publica una sola vez por semana, sin importar cuántas veces se llame.
    supabase.rpc("publicar_resumen_semanal").then(() => {}, () => {});
  }, [cargarSalud, cargarReacciones, cargarExtras]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const nombre = usuario.user_metadata?.nombre || usuario.email.split("@")[0];
        // Tiene que existir antes de cualquier comida o mensaje, que dependen del perfil.
        const { error } = await supabase
          .from("perfiles")
          .upsert({ id: usuario.id, nombre }, { onConflict: "id", ignoreDuplicates: true });
        if (error) throw error;
        await Promise.all([cargarPerfiles(), cargarComidas()]);
        if (activo) setEstado({ listo: true, error: "" });
      } catch (err) {
        if (activo) setEstado({ listo: true, error: err.message || "No se pudieron cargar los datos" });
      }
    })();

    const canal = supabase
      .channel("comidas-grupo")
      .on("postgres_changes", { event: "*", schema: "public", table: "comidas" }, () => {
        clearTimeout(espera.current);
        espera.current = setTimeout(() => cargarComidas().catch(() => {}), 300);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reacciones" }, () => {
        cargarReacciones().catch(() => {});
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comentarios" }, () => {
        cargarExtras().catch(() => {});
      })
      .subscribe();

    const renovar = setInterval(() => cargarComidas().catch(() => {}), RENOVAR_FOTOS_MS);

    return () => {
      activo = false;
      clearTimeout(espera.current);
      clearInterval(renovar);
      supabase.removeChannel(canal);
    };
  }, [usuario.id, cargarPerfiles, cargarComidas, cargarReacciones, cargarExtras]); // El objeto usuario cambia en cada renovación de sesión.

  const valor = useMemo(
    () => ({
      usuario,
      yo: perfiles[usuario.id] || { ...AVATAR_BASE, id: usuario.id, nombre: "" },
      perfiles,
      comidas,
      fotos,
      estado,
      cargarComidas,
      cargarPerfiles,
      whoop,
      cargarWhoop,
      salud,
      pesos,
      cargarSalud,
      reacciones,
      alternarReaccion,
      extras,
      cargarExtras,
      cambiarAgua,
    }),
    [usuario, perfiles, comidas, fotos, estado, cargarComidas, cargarPerfiles, whoop, cargarWhoop, salud, pesos, cargarSalud, reacciones, alternarReaccion, extras, cargarExtras, cambiarAgua],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
