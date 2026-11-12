import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { accionWhoop } from "./api.js";
import { haceDias } from "./fechas.js";
import { cantidades, nivelesGuardados, nivelGeneral } from "./medallas.js";
import { configurarTotales } from "./macros.js";
import { castigoDe, marcaDeCaca } from "./multas.js";
import { marcarActividad } from "./vivo.js";

const Contexto = createContext(null);
export const useDatos = () => useContext(Contexto);

export const VENTANA_DIAS = 30;
const HISTORIAL_MAXIMO = 10000;
const RENOVAR_FOTOS_MS = 50 * 60 * 1000; // Los links firmados duran 1 hora.
const REINTENTO_MS = 3000;
const SIN_CONEXION_MS = 15000; // Si el canal se cae, se sigue actualizando por pedidos.
const RESPALDO_MS = 120000;
const AUSENCIA_MS = 15000; // En el iPhone la conexión muere al pasar a segundo plano.
const PAGINA = 1000;

export const AVATAR_BASE = { color: "#E4572E", meta_calorias: 2000 };

// Supabase entrega hasta mil filas por pedido.
async function traerTodo(armar) {
  const filas = [];
  for (;;) {
    const { data, error } = await armar().range(filas.length, filas.length + PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA || filas.length >= HISTORIAL_MAXIMO) return filas;
  }
}

const valorDe = (consulta, clave) => (consulta.error ? null : consulta.data?.find((a) => a.clave === clave)?.valor || null);

// Sin grupo cargado (la base todavía no tiene grupos) se comporta como la Lomada de siempre.
export const GRUPO_BASE = { id: null, nombre: "Lomada", conBocha: true };

const SIN_GRUPOS = [];
const nada = async () => false;

export function DatosProvider({ usuario, grupo = GRUPO_BASE, misGrupos = SIN_GRUPOS, cambiarGrupo = nada, recargarGrupos = nada, children }) {
  const [perfiles, setPerfiles] = useState({});
  const [comidas, setComidas] = useState([]);
  const [fotos, setFotos] = useState({});
  const [estado, setEstado] = useState({ listo: false, error: "" });
  const [whoop, setWhoop] = useState({ disponible: false, conectado: false, dias: {} });
  // undefined: la tabla todavía no existe. null: existe, pero la persona no cargó su plan.
  const [salud, setSalud] = useState(undefined);
  const [pesos, setPesos] = useState([]);
  const [reacciones, setReacciones] = useState([]);
  const [perfilId, abrirPerfil] = useState(null);
  const [respuesta, responder] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [mensajesListos, setMensajesListos] = useState(false);
  const [historial, setHistorial] = useState(null);
  const firmas = useRef({});
  const perfilesRef = useRef(perfiles);
  perfilesRef.current = perfiles;
  const [extras, setExtras] = useState({ disponible: false, favoritas: [], agua: [], desafios: [], medallas: [] });

  const cargarPerfiles = useCallback(async () => {
    const { data, error } = await supabase.from("perfiles").select("*");
    if (error) throw error;
    const mapa = Object.fromEntries(data.map((p) => [p.id, { ...AVATAR_BASE, ...p }]));
    configurarTotales(mapa);
    setPerfiles(mapa);
  }, []);

  const firmarRutas = useCallback(async (todas) => {
    // Solo se firma lo nuevo o lo vencido: firmar de nuevo cambia el link y la foto parpadea.
    const ahora = Date.now();
    const rutas = [...new Set(todas.filter(Boolean))].filter((r) => !(ahora - firmas.current[r] < RENOVAR_FOTOS_MS));
    if (!rutas.length) return;
    const { data } = await supabase.storage.from("fotos").createSignedUrls(rutas, 3600);
    // Se suman a las que ya están: el perfil y los días viejos traen fotos fuera de la ventana.
    const nuevas = (data || []).filter((u) => u.signedUrl);
    nuevas.forEach((u) => { firmas.current[u.path] = ahora; });
    setFotos((prev) => ({ ...prev, ...Object.fromEntries(nuevas.map((u) => [u.path, u.signedUrl])) }));
  }, []);

  const firmarFotos = useCallback((lista) => firmarRutas(lista.map((c) => c.foto_path)), [firmarRutas]);

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

  const traerComidasDe = useCallback(
    (id) => traerTodo(() => supabase.from("comidas").select("*").eq("usuario_id", id).order("fecha", { ascending: false }).order("id")),
    [],
  );

  const cargarHistorial = useCallback(async (id) => {
    const data = await traerComidasDe(id);
    await firmarFotos(data);
    return data;
  }, [firmarFotos, traerComidasDe]);

  // Los logros cuentan toda la historia, no solo los últimos días.
  const cargarLogros = useCallback(async () => {
    const [propias, agua] = await Promise.all([
      traerComidasDe(usuario.id),
      traerTodo(() => supabase.from("agua").select("*").eq("usuario_id", usuario.id).order("fecha")),
    ]);
    setHistorial({ comidas: propias, agua });
  }, [traerComidasDe, usuario.id]);

  const cargarMensajes = useCallback(async () => {
    const { data, error } = await supabase.from("mensajes").select("*").order("creado_en", { ascending: false }).limit(200);
    if (error) throw error;
    await firmarRutas(data.map((m) => m.adjunto_path));
    setMensajes(data.reverse());
    setMensajesListos(true);
  }, [firmarRutas]);

  // Reacciones a mensajes y hasta dónde leyó cada uno. Si las tablas no existen todavía, quedan vacías.
  const [reaccionesMensajes, setReaccionesMensajes] = useState([]);
  const [lecturas, setLecturas] = useState([]);
  const cargarSocial = useCallback(async () => {
    const [r, l] = await Promise.all([
      supabase.from("reacciones_mensajes").select("*").limit(3000),
      supabase.from("lecturas").select("*"),
    ]);
    if (!r.error) setReaccionesMensajes(r.data);
    if (!l.error) setLecturas(l.data);
  }, []);

  // Comidas grupales: las invitaciones que mandaste o te llegaron, y las comidas a las que te sumaron.
  const [invitaciones, setInvitaciones] = useState([]);
  const [comidasInvitadas, setComidasInvitadas] = useState({});
  const cargarInvitaciones = useCallback(async () => {
    const { data, error } = await supabase.from("invitaciones_comida").select("*").order("creado_en", { ascending: false }).limit(200);
    if (error) return;
    setInvitaciones(data);
    const ids = [...new Set(data.filter((i) => i.estado === "pendiente" && i.para_usuario === usuario.id).map((i) => i.comida_id))];
    if (!ids.length) return setComidasInvitadas({});
    const { data: lista } = await supabase.from("comidas").select("*").in("id", ids);
    await firmarFotos(lista || []);
    setComidasInvitadas(Object.fromEntries((lista || []).map((c) => [c.id, c])));
  }, [usuario.id, firmarFotos]);

  // El chat en vivo va por un canal directo entre teléfonos (broadcast): llega al instante.
  // Los cambios de la base siguen llegando por su lado como respaldo.
  const chatRef = useRef(null);
  const emitirChat = useCallback((evento, datos) => {
    chatRef.current?.send({ type: "broadcast", event: evento, payload: datos })?.catch?.(() => {});
  }, []);

  const ponerReaccion = useCallback(({ mensaje_id, usuario_id, emoji, activa }) => {
    const clave = (r) => r.mensaje_id === mensaje_id && r.usuario_id === usuario_id && r.emoji === emoji;
    setReaccionesMensajes((prev) => {
      const tiene = prev.some(clave);
      if (activa === tiene) return prev;
      return activa ? [...prev, { mensaje_id, usuario_id, emoji }] : prev.filter((r) => !clave(r));
    });
  }, []);

  const reaccionesRef = useRef(reaccionesMensajes);
  reaccionesRef.current = reaccionesMensajes;
  const alternarReaccionMensaje = useCallback(async (mensajeId, emoji) => {
    const fila = { mensaje_id: mensajeId, usuario_id: usuario.id, emoji };
    const tenia = reaccionesRef.current.some((r) => r.mensaje_id === mensajeId && r.usuario_id === usuario.id && r.emoji === emoji);
    ponerReaccion({ ...fila, activa: !tenia });
    emitirChat("reaccion", { ...fila, activa: !tenia });
    const consulta = supabase.from("reacciones_mensajes");
    const { error } = await (tenia
      ? consulta.delete().eq("mensaje_id", mensajeId).eq("usuario_id", usuario.id).eq("emoji", emoji)
      : consulta.insert(fila));
    if (error) cargarSocial().catch(() => {});
  }, [usuario.id, cargarSocial, ponerReaccion, emitirChat]);

  const ponerLectura = useCallback(({ usuario_id, hasta }) => {
    setLecturas((prev) => {
      const actual = prev.find((l) => l.usuario_id === usuario_id);
      if (actual && actual.hasta >= hasta) return prev;
      return [...prev.filter((l) => l.usuario_id !== usuario_id), { usuario_id, hasta }];
    });
  }, []);

  const marcarLeido = useCallback(async (hasta) => {
    ponerLectura({ usuario_id: usuario.id, hasta });
    emitirChat("leido", { usuario_id: usuario.id, hasta });
    await supabase.from("lecturas").upsert({ usuario_id: usuario.id, hasta }, { onConflict: "usuario_id" });
  }, [usuario.id, ponerLectura, emitirChat]);

  // Si ya estaba (por ejemplo, el mensaje que se mostró antes de que lo confirme la base), se reemplaza.
  const agregarMensaje = useCallback((nuevo) => {
    setMensajes((prev) => {
      const i = prev.findIndex((m) => m.id === nuevo.id);
      if (i < 0) return [...prev, nuevo].sort((a, b) => (a.creado_en < b.creado_en ? -1 : a.creado_en > b.creado_en ? 1 : 0));
      if (!prev[i].pendiente) return prev;
      const copia = [...prev];
      copia[i] = { ...nuevo, pendiente: false };
      return copia;
    });
  }, []);

  const quitarMensaje = useCallback((id) => setMensajes((prev) => prev.filter((m) => m.id !== id)), []);

  // Escribiendo, grabando o mandando una foto: se avisa al cambiar y cada tanto mientras dura.
  const actividadPropia = useRef({ que: null, cuando: 0 });
  const avisarActividad = useCallback((que) => {
    const ahora = Date.now();
    const previa = actividadPropia.current;
    if (previa.que === que && (!que || ahora - previa.cuando < 2500)) return;
    actividadPropia.current = { que, cuando: ahora };
    emitirChat("actividad", { usuario_id: usuario.id, que });
  }, [usuario.id, emitirChat]);

  const cargarDia = useCallback(async (fecha) => {
    const { data, error } = await supabase.from("comidas").select("*").eq("fecha", fecha).limit(200);
    if (error) throw error;
    await firmarFotos(data);
    return data;
  }, [firmarFotos]);

  const cargarComida = useCallback(async (id) => {
    const { data, error } = await supabase.from("comidas").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (data) await firmarFotos([data]);
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
    const [desafios, favoritas, agua, medallas, recetas, multas, bochaEvo, ajustes, admin] = await Promise.all([
      supabase.from("desafios").select("*").gte("fin", haceDias(VENTANA_DIAS)).order("inicio", { ascending: false }),
      supabase.from("favoritas").select("*").eq("usuario_id", usuario.id).order("creado_en", { ascending: false }),
      supabase.from("agua").select("*").gte("fecha", desde),
      supabase.from("medallas").select("*"),
      // Las propias y las que el resto del grupo compartió.
      supabase.from("recetas_propias").select("*").order("nombre"),
      supabase.from("multas").select("*").gte("fecha", haceDias(14)),
      supabase.from("bocha_evo").select("*").gte("semana", haceDias(14)),
      supabase.from("ajustes_grupo").select("*"),
      supabase.from("administradores").select("usuario_id").eq("usuario_id", usuario.id).maybeSingle(),
    ]);
    if (desafios.error) return; // Las tablas todavía no existen.
    setExtras({
      disponible: true,
      desafios: desafios.data,
      favoritas: favoritas.data || [],
      agua: agua.data || [],
      medallas: medallas.data || [],
      // Si la tabla todavía no existe, no hay recetas.
      recetas: recetas.error ? [] : (recetas.data || []).filter((r) => r.usuario_id === usuario.id),
      recetasGrupo: recetas.error ? [] : (recetas.data || []).filter((r) => r.usuario_id !== usuario.id),
      // La caca: si las tablas todavía no existen, no aparece nada.
      multasActivas: !multas.error && !bochaEvo.error,
      multas: multas.error ? [] : multas.data || [],
      bochaEvo: bochaEvo.error ? [] : bochaEvo.data || [],
      imagenesBocha: { dia: valorDe(ajustes, "bocha"), evo: valorDe(ajustes, "bocha_evo") },
      admin: !admin.error && Boolean(admin.data),
    });
    firmarRutas([valorDe(ajustes, "bocha"), valorDe(ajustes, "bocha_evo")]).catch(() => {});
  }, [usuario.id, firmarRutas]);

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
    cargarLogros().catch(() => {});
  }, [cargarSalud, cargarReacciones, cargarExtras, cargarLogros]);

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

    return () => {
      activo = false;
    };
  }, [usuario.id, cargarPerfiles, cargarComidas]); // El objeto usuario cambia en cada renovación de sesión.

  // Trae lo que pudo haber pasado mientras no se escuchaba.
  const ultimoRefresco = useRef(0);
  const refrescar = useCallback(async (forzar = false) => {
    if (!forzar && Date.now() - ultimoRefresco.current < 2000) return;
    ultimoRefresco.current = Date.now();
    await Promise.allSettled([cargarPerfiles(), cargarComidas(), cargarMensajes(), cargarReacciones(), cargarExtras(), cargarSocial(), cargarInvitaciones()]);
  }, [cargarPerfiles, cargarComidas, cargarMensajes, cargarReacciones, cargarExtras, cargarSocial, cargarInvitaciones]);

  const canalRef = useRef(null);
  const estadoCanal = useRef("");
  const reintento = useRef(null);
  const yaConecto = useRef(false);
  const tiempos = useRef({});

  const conectar = useCallback(() => {
    clearTimeout(reintento.current);
    const anterior = canalRef.current;
    canalRef.current = null;
    if (anterior) supabase.removeChannel(anterior);

    const tandas = tiempos.current;
    const enTanda = (clave, tarea) => {
      clearTimeout(tandas[clave]);
      tandas[clave] = setTimeout(() => tarea().catch(() => {}), 250);
    };
    const tabla = (canal, nombre, alCambiar) => canal.on("postgres_changes", { event: "*", schema: "public", table: nombre }, alCambiar);

    let canal = supabase.channel(`grupo-${Date.now()}`);
    canal = tabla(canal, "comidas", () => enTanda("comidas", cargarComidas));
    canal = tabla(canal, "reacciones", () => enTanda("reacciones", cargarReacciones));
    canal = tabla(canal, "perfiles", () => enTanda("perfiles", cargarPerfiles));
    for (const nombre of ["medallas", "desafios", "agua", "multas", "bocha_evo", "ajustes_grupo"]) canal = tabla(canal, nombre, () => enTanda("extras", cargarExtras));
    for (const nombre of ["reacciones_mensajes", "lecturas"]) canal = tabla(canal, nombre, () => enTanda("social", cargarSocial));
    canal = tabla(canal, "invitaciones_comida", () => enTanda("invitaciones", cargarInvitaciones));
    canal = tabla(canal, "mensajes", ({ eventType, new: nuevo }) => {
      if (eventType !== "INSERT") return enTanda("mensajes", cargarMensajes);
      if (nuevo.adjunto_path) firmarRutas([nuevo.adjunto_path]).catch(() => {});
      agregarMensaje(nuevo);
      if (nuevo.usuario_id && !perfilesRef.current[nuevo.usuario_id]) cargarPerfiles().catch(() => {});
    });

    // Canal directo del chat: mensajes, reacciones, vistos y quién está escribiendo.
    const chatAnterior = chatRef.current;
    chatRef.current = null;
    if (chatAnterior) supabase.removeChannel(chatAnterior);
    const chat = supabase.channel(`chat-vivo-${grupo.id || "lomada"}`, { config: { broadcast: { self: false, ack: false } } });
    chat.on("broadcast", { event: "mensaje" }, ({ payload }) => {
      if (!payload?.id) return;
      marcarActividad(payload.usuario_id, null);
      if (payload.adjunto_path) firmarRutas([payload.adjunto_path]).catch(() => {});
      agregarMensaje(payload);
    });
    chat.on("broadcast", { event: "reaccion" }, ({ payload }) => payload && ponerReaccion(payload));
    chat.on("broadcast", { event: "leido" }, ({ payload }) => payload && ponerLectura(payload));
    chat.on("broadcast", { event: "actividad" }, ({ payload }) => payload?.usuario_id && marcarActividad(payload.usuario_id, payload.que));
    chat.subscribe();
    chatRef.current = chat;

    canalRef.current = canal;
    canal.subscribe((estado) => {
      if (canalRef.current !== canal) return;
      estadoCanal.current = estado;
      if (estado === "SUBSCRIBED") {
        // Lo que pasó mientras se conectaba no llegó por el canal.
        if (yaConecto.current) refrescar(true);
        yaConecto.current = true;
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(estado)) {
        clearTimeout(reintento.current);
        reintento.current = setTimeout(conectar, REINTENTO_MS);
      }
    });
  }, [agregarMensaje, cargarComidas, cargarExtras, cargarInvitaciones, cargarMensajes, cargarPerfiles, cargarReacciones, cargarSocial, firmarRutas, refrescar, ponerReaccion, ponerLectura, grupo.id]);

  useEffect(() => {
    cargarMensajes().catch(() => setMensajesListos(true));
    cargarSocial().catch(() => {});
    cargarInvitaciones().catch(() => {});
    conectar();

    let ocultaDesde = document.visibilityState === "hidden" ? Date.now() : null;
    const volver = async () => {
      if (document.visibilityState !== "visible") return;
      const ausencia = ocultaDesde ? Date.now() - ocultaDesde : 0;
      ocultaDesde = null;
      // Renueva la sesión antes de pedir nada: puede haber vencido en segundo plano.
      await supabase.auth.getSession().catch(() => {});
      refrescar();
      if (ausencia > AUSENCIA_MS || estadoCanal.current !== "SUBSCRIBED") conectar();
    };
    const alCambiar = () => {
      if (document.visibilityState === "hidden") ocultaDesde = Date.now();
      else volver();
    };
    document.addEventListener("visibilitychange", alCambiar);
    window.addEventListener("focus", volver);
    window.addEventListener("pageshow", volver);
    window.addEventListener("online", volver);

    const sinCanal = setInterval(() => {
      if (document.visibilityState === "visible" && estadoCanal.current !== "SUBSCRIBED") refrescar();
    }, SIN_CONEXION_MS);
    const respaldo = setInterval(() => {
      if (document.visibilityState === "visible") refrescar();
    }, RESPALDO_MS);

    const tandas = tiempos.current;
    return () => {
      document.removeEventListener("visibilitychange", alCambiar);
      window.removeEventListener("focus", volver);
      window.removeEventListener("pageshow", volver);
      window.removeEventListener("online", volver);
      clearInterval(sinCanal);
      clearInterval(respaldo);
      clearTimeout(reintento.current);
      Object.values(tandas).forEach(clearTimeout);
      const canal = canalRef.current;
      canalRef.current = null;
      if (canal) supabase.removeChannel(canal);
      const chat = chatRef.current;
      chatRef.current = null;
      if (chat) supabase.removeChannel(chat);
    };
  }, [cargarMensajes, cargarSocial, conectar, refrescar]);

  // Quién está escribiendo o publicando ahora. No se guarda en la base: vive solo mientras la app está abierta.
  const [presentes, setPresentes] = useState({});
  const presencia = useRef(null);
  const estadoPropio = useRef({ escribiendo: false, publicando: false });
  useEffect(() => {
    const canal = supabase.channel(`presencia-${grupo.id || "grupo"}`, { config: { presence: { key: usuario.id } } });
    canal.on("presence", { event: "sync" }, () => {
      const mapa = {};
      for (const [id, lista] of Object.entries(canal.presenceState())) {
        if (id === usuario.id || !lista.length) continue;
        const ultimo = lista[lista.length - 1];
        mapa[id] = { escribiendo: Boolean(ultimo.escribiendo), publicando: Boolean(ultimo.publicando) };
      }
      setPresentes(mapa);
    });
    canal.subscribe((estado) => {
      if (estado === "SUBSCRIBED") canal.track(estadoPropio.current);
    });
    presencia.current = canal;
    return () => {
      presencia.current = null;
      supabase.removeChannel(canal);
    };
  }, [usuario.id, grupo.id]);

  const avisarEstado = useCallback((parcial) => {
    const nuevo = { ...estadoPropio.current, ...parcial };
    if (nuevo.escribiendo === estadoPropio.current.escribiendo && nuevo.publicando === estadoPropio.current.publicando) return;
    estadoPropio.current = nuevo;
    presencia.current?.track(nuevo)?.catch?.(() => {});
  }, []);

  // Lo reciente manda: incluye lo que se acaba de cargar, editar o borrar.
  const comidasLogros = useMemo(() => {
    if (!historial) return null;
    const recientes = new Set(comidas.map((c) => c.id));
    return [...comidas, ...historial.comidas.filter((c) => !recientes.has(c.id) && c.fecha < haceDias(VENTANA_DIAS))];
  }, [comidas, historial]);

  const aguaLogros = useMemo(() => {
    if (!historial) return [];
    const recientes = extras.agua.filter((a) => a.usuario_id === usuario.id);
    return [...recientes, ...historial.agua.filter((a) => !recientes.some((r) => r.fecha === a.fecha))];
  }, [extras.agua, historial, usuario.id]);

  const progreso = useMemo(() => {
    if (!comidasLogros) return null;
    const victorias = extras.medallas.filter((m) => m.usuario_id === usuario.id && m.codigo.startsWith("victoria:")).length;
    return cantidades({ usuarioId: usuario.id, comidas: comidasLogros, agua: aguaLogros, reacciones, perfiles, salud: salud || null, pesos, victorias });
  }, [aguaLogros, comidasLogros, extras.medallas, perfiles, pesos, reacciones, salud, usuario.id]);

  // La caca de cada uno se ve al lado del nombre en toda la app.
  // Cada perfil lleva su nivel general (el avatar se pone más lindo al subir) y, si le toca, la caca.
  const perfilesConCaca = useMemo(() => {
    const medallas = extras.medallas || [];
    return Object.fromEntries(Object.entries(perfiles).map(([id, p]) => [id, {
      ...p,
      nivel: nivelGeneral(nivelesGuardados(medallas.filter((m) => m.usuario_id === id).map((m) => m.codigo))).nivel,
      ...(extras.multasActivas ? { caca: marcaDeCaca({ usuarioId: id, multas: extras.multas, bochaEvo: extras.bochaEvo }) } : {}),
    }]));
  }, [perfiles, extras]);
  const castigo = useMemo(() => {
    const base = extras.multasActivas ? castigoDe({ usuarioId: usuario.id, multas: extras.multas, bochaEvo: extras.bochaEvo, comidas }) : { marca: null, evo: false, diario: false, activo: false };
    if (grupo.conBocha) return { ...base, soloTexto: base.diario };
    // Sin Bocha es tipo BeReal: las fotos de los demás borrosas y sin reaccionar hasta subir la tuya. El chat sigue igual.
    return { ...base, marca: base.marca && "dia", evo: false, activo: base.diario, soloTexto: false };
  }, [extras, comidas, usuario.id, grupo.conBocha]);

  const valor = useMemo(
    () => ({
      usuario,
      grupo,
      misGrupos,
      cambiarGrupo,
      recargarGrupos,
      yo: perfilesConCaca[usuario.id] || { ...AVATAR_BASE, id: usuario.id, nombre: "" },
      perfiles: perfilesConCaca,
      castigo,
      imagenesBocha: extras.imagenesBocha || {},
      comidas,
      fotos,
      estado,
      cargarComidas,
      cargarHistorial,
      cargarComida,
      respuesta,
      responder,
      mensajes,
      mensajesListos,
      presentes,
      avisarEstado,
      reaccionesMensajes,
      alternarReaccionMensaje,
      lecturas,
      marcarLeido,
      invitaciones,
      comidasInvitadas,
      cargarInvitaciones,
      firmarRutas,
      agregarMensaje,
      quitarMensaje,
      emitirChat,
      avisarActividad,
      comidasLogros,
      aguaLogros,
      progreso,
      cargarDia,
      perfilId,
      abrirPerfil,
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
    [usuario, grupo, misGrupos, cambiarGrupo, recargarGrupos, perfilesConCaca, castigo, comidas, fotos, estado, cargarComidas, cargarHistorial, cargarComida, respuesta, cargarDia, perfilId, mensajes, mensajesListos, presentes, avisarEstado, reaccionesMensajes, alternarReaccionMensaje, lecturas, marcarLeido, invitaciones, comidasInvitadas, cargarInvitaciones, firmarRutas, agregarMensaje, quitarMensaje, emitirChat, avisarActividad, comidasLogros, aguaLogros, progreso, cargarPerfiles, whoop, cargarWhoop, salud, pesos, cargarSalud, reacciones, alternarReaccion, extras, cargarExtras, cambiarAgua],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
