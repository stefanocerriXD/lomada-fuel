import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Award, Bell, Bot, ChefHat, Clock3, Copy, ImagePlus, MessageCircle, Reply, SendHorizontal, Smile, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { activarAvisos, avisosActivos, estadoAvisos } from "../lib/avisos.js";
import { useDatos } from "../lib/datos.jsx";
import { useActividad } from "../lib/vivo.js";
import { fechaLocal, hora, nombreDia } from "../lib/fechas.js";
import { comprimirImagen } from "../lib/imagen.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar, Hoja, Vacio, vibrar } from "../componentes/Base.jsx";
import Grabador, { extensionAudio } from "../componentes/Grabador.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import VerReceta, { useReceta } from "../componentes/VerReceta.jsx";
import { totalesDeReceta } from "../lib/recetasPropias.js";
import { nombreDeCodigo } from "../lib/medallas.js";

const MAXIMO_EN_PANTALLA = 250;
const CLAVE_AVISO = "lomada-aviso-cerrado";
const TOQUE_LARGO_MS = 380;
const DESLIZAR_PARA_RESPONDER = 60;
const GIF_MAXIMO = 8 * 1024 * 1024;
const REACCIONES = ["❤️", "😂", "🔥", "👏", "🤤", "🐷"];
const STICKERS = ["🔥", "💪", "🥩", "🍖", "🍝", "🍕", "🍔", "🌮", "🥗", "⚽", "🏆", "😂", "🤤", "🐷", "👀", "💀"];

// Los resúmenes del bot traen emojis guardados en la base.
const sinEmojis = (texto) => texto.replace(/\p{Extended_Pictographic}️?\s*/gu, "");
const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const esAudio = (ruta) => /\.(m4a|mp4|webm|ogg|aac)$/i.test(ruta || "");
const resumenDe = (m) => m.texto || (m.sticker ? `Sticker ${m.sticker}` : esAudio(m.adjunto_path) ? "Audio" : m.adjunto_path ? "Foto" : "");
const ESCRIBIENDO_MS = 4000;

// Cada integrante con un color fijo y distinto en el chat; siempre el mismo para la misma persona.
const COLORES_NOMBRES = 8;
const colorDeNombre = (perfiles, id) => `var(--nombre-${(Object.keys(perfiles).sort().indexOf(id) % COLORES_NOMBRES) + 1})`;

const listaDeNombres = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0]);

// "Nacho está escribiendo…" o "Juli está publicando su comida…", en vivo.
export function EnVivo({ que }) {
  const { presentes, perfiles } = useDatos();
  const nombres = Object.entries(presentes).filter(([, e]) => e[que]).map(([id]) => perfiles[id]?.nombre).filter(Boolean);
  if (!nombres.length) return null;
  const verbo = que === "escribiendo" ? "escribiendo" : "publicando su comida";
  return (
    <p className="en-vivo" role="status">
      <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
      {listaDeNombres(nombres)} {nombres.length > 1 ? "están" : "está"} {verbo}…
    </p>
  );
}

function ConMenciones({ texto }) {
  const { perfiles, yo } = useDatos();
  const nombres = Object.values(perfiles).map((p) => p.nombre).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!texto.includes("@") || !nombres.length) return texto;
  const partes = texto.split(new RegExp(`(@(?:${nombres.map(escapar).join("|")}))`, "gi"));
  return partes.map((parte, i) => (i % 2
    ? <b key={i} className={normal(parte) === normal(`@${yo.nombre}`) ? "mencion mia" : "mencion"}>{parte}</b>
    : parte));
}

function AvisoNotificaciones({ avisar }) {
  const { usuario } = useDatos();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cerrado = false;
    try {
      cerrado = localStorage.getItem(CLAVE_AVISO) === "si";
    } catch {
      // Sin almacenamiento se vuelve a ofrecer.
    }
    if (cerrado || estadoAvisos() !== "disponible") return;
    avisosActivos().then((activos) => setVisible(!activos), () => {});
  }, []);

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE_AVISO, "si");
    } catch {
      // Sin almacenamiento se vuelve a ofrecer.
    }
  }

  async function activar() {
    try {
      await activarAvisos(usuario.id);
      avisar("Notificaciones activadas");
      setVisible(false);
    } catch {
      avisar("No se pudieron activar");
    }
  }

  if (!visible) return null;
  return (
    <div className="aviso-chat">
      <Bell size={18} />
      <span>Enterate cuando alguien sube una foto o escribe.</span>
      <button className="boton-chico activo" onClick={activar}>Activar</button>
      <button className="boton-icono chico" onClick={cerrar} aria-label="Cerrar aviso"><X size={16} /></button>
    </div>
  );
}

function CitaFoto({ id, autorId, onZoom }) {
  const { usuario, comidas, perfiles, fotos, cargarComida } = useDatos();
  const reciente = comidas.find((c) => c.id === id);
  const [anterior, setAnterior] = useState(null);
  const comida = reciente || anterior;

  // Se puede responder una foto vieja, que no está entre las comidas recientes.
  useEffect(() => {
    if (reciente) return;
    let activo = true;
    cargarComida(id).then((c) => activo && setAnterior(c), () => {});
    return () => { activo = false; };
  }, [cargarComida, id, reciente]);

  if (!comida) return <span className="burbuja-cita sin-datos">Respondió a una foto</span>;
  const src = fotos[comida.foto_path];
  const titulo = comida.descripcion || tipoInfo(comida.tipo).texto;
  const nombre = perfiles[comida.usuario_id]?.nombre || "Amigo";
  const soyAutor = autorId === usuario.id;
  const esMia = comida.usuario_id === usuario.id;
  let quien = `${soyAutor ? "Respondiste" : "Respondió"} a ${nombre}`;
  if (esMia) quien = soyAutor ? "Respondiste a tu comida" : "Respondió a tu comida";
  else if (comida.usuario_id === autorId) quien = "Respondió a su comida";

  return (
    <button className="burbuja-cita" type="button" onClick={() => src && onZoom({ src, alt: titulo })} aria-label={`Ver foto: ${titulo}`}>
      <span><strong>{quien}</strong><small>{titulo}</small></span>
      {src ? <img src={src} alt="" /> : <IconoComida tipo={comida.tipo} />}
    </button>
  );
}

function CitaMensaje({ id }) {
  const { usuario, mensajes, perfiles, fotos } = useDatos();
  const citado = mensajes.find((m) => m.id === id);
  if (!citado) return <span className="burbuja-cita sin-datos">Mensaje anterior</span>;
  const nombre = citado.usuario_id === usuario.id ? "Vos" : perfiles[citado.usuario_id]?.nombre || "Bot del grupo";
  const foto = citado.adjunto_path && fotos[citado.adjunto_path];

  function irAlMensaje() {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("resaltado");
    setTimeout(() => el.classList.remove("resaltado"), 1200);
  }

  return (
    <button className="burbuja-cita" type="button" onClick={irAlMensaje} aria-label={`Ir al mensaje de ${nombre}`}>
      <span><strong>{nombre}</strong><small>{resumenDe(citado) || "Mensaje"}</small></span>
      {foto && <img src={foto} alt="" />}
    </button>
  );
}

// Mantener apretado marca el mensaje; al soltar se abren las opciones. Así no se selecciona nada sin querer.
function useToqueLargo(alAbrir) {
  const reloj = useRef(null);
  const inicio = useRef(null);
  const [marcado, setMarcado] = useState(false);
  const cancelar = () => {
    clearTimeout(reloj.current);
    inicio.current = null;
    setMarcado(false);
  };
  return {
    marcado,
    eventos: {
      onPointerDown(e) {
        inicio.current = { x: e.clientX, y: e.clientY };
        reloj.current = setTimeout(() => {
          setMarcado(true);
          vibrar(15);
        }, TOQUE_LARGO_MS);
      },
      onPointerMove(e) {
        if (inicio.current && Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > 10) cancelar();
      },
      onPointerUp() {
        const abrir = marcado;
        cancelar();
        if (abrir) alAbrir();
      },
      onPointerCancel: cancelar,
      onContextMenu(e) {
        e.preventDefault();
        cancelar();
        alAbrir();
      },
    },
  };
}

const SIN_REACCIONES = [];
const nombreDeQuien = (perfiles, yoId, id) => (id === yoId ? "vos" : perfiles[id]?.nombre || "Amigo");

// Cada reacción muestra quién la puso: el emoji y las caritas de los que reaccionaron.
function Reacciones({ mensajeId, lista, perfiles, yoId, onReaccion }) {
  if (!lista.length) return null;
  const grupos = [...new Set(lista.map((r) => r.emoji))];
  return (
    <div className="reacciones-mensaje">
      {grupos.map((e) => {
        const quienes = lista.filter((r) => r.emoji === e).map((r) => r.usuario_id);
        const mia = quienes.includes(yoId);
        const nombres = listaDeNombres(quienes.map((id) => nombreDeQuien(perfiles, yoId, id)));
        return (
          <button key={e} className={mia ? "mia" : ""} onClick={() => onReaccion(mensajeId, e)} aria-pressed={mia} aria-label={`${e} de ${nombres}`} title={nombres}>
            <span className="reaccion-emoji">{e}</span>
            <span className="reaccion-quienes" aria-hidden="true">
              {quienes.slice(0, 3).map((id) => <Avatar key={id} perfil={perfiles[id]} tam={16} />)}
              {quienes.length > 3 && <small>+{quienes.length - 3}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Quién está escribiendo, grabando o mandando una foto, como una burbuja al final del chat.
const TEXTO_ACTIVIDAD = { escribiendo: "está escribiendo", grabando: "está grabando un audio", foto: "está mandando una foto" };
function ActividadEnChat({ perfiles, yoId, alCambiar }) {
  const actividad = useActividad();
  const activos = Object.entries(actividad).filter(([id, que]) => id !== yoId && perfiles[id] && TEXTO_ACTIVIDAD[que]);
  useEffect(() => { alCambiar(); }, [activos.length, alCambiar]);
  return (
    <AnimatePresence initial={false}>
      {activos.map(([id, que]) => (
        <motion.div key={id} className="chat-fila escribiendo-fila" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18 }} role="status">
          <span className="chat-avatar"><Avatar perfil={perfiles[id]} tam={30} /></span>
          <div className="burbuja burbuja-escribiendo">
            <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
            <small><strong style={{ color: colorDeNombre(perfiles, id) }}>{perfiles[id].nombre}</strong> {TEXTO_ACTIVIDAD[que]}</small>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

// Una receta compartida: se toca para verla y guardarla.
function RecetaEnChat({ id, onVer }) {
  const receta = useReceta(id);
  if (receta === undefined) return <span className="receta-chat cargando" aria-hidden="true" />;
  if (!receta) return <span className="receta-chat sin-datos">La receta ya no está disponible</span>;
  const porciones = Math.max(1, Number(receta.porciones) || 1);
  const kcal = Math.round(totalesDeReceta(receta.ingredientes || []).kcal / porciones);
  return (
    <button type="button" className="receta-chat" onClick={() => onVer(receta)} onPointerDown={(e) => e.stopPropagation()} aria-label={`Ver receta: ${receta.nombre}`}>
      <span className="receta-chat-icono"><ChefHat size={20} aria-hidden="true" /></span>
      <span><strong>{receta.nombre}</strong><small>{kcal.toLocaleString("es-AR")} kcal {porciones > 1 ? `la porción · ${porciones} porciones` : ""} · Ver receta</small></span>
    </button>
  );
}

// Los logros desde el nivel 2 aparecen en el chat como una línea chica. Solo los ganados desde que existe esto.
const LOGROS_EN_CHAT_DESDE = "2026-11-11";
function LineaLogro({ logro, perfil, onPerfil }) {
  const nivel = logro.codigo.split(":")[1];
  return (
    <motion.button type="button" className="chat-logro" onClick={() => onPerfil(logro.usuario_id)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Award size={14} aria-hidden="true" />
      <span><b>{perfil.nombre}</b> llegó a <em>{nombreDeCodigo(logro.codigo)}</em> · nivel {nivel}</span>
    </motion.button>
  );
}

// Memorizado: escribir o recibir algo no redibuja todos los mensajes, solo los que cambian.
const Mensaje = memo(function Mensaje({ m, propio, inicio, fin, dia, visto, perfil, perfiles, foto, yoId, reacciones, onReaccion, onPerfil, onAcciones, onResponder, onZoom, onVerReceta }) {
  const { marcado, eventos } = useToqueLargo(() => onAcciones(m));
  // Deslizar a la derecha responde, como en WhatsApp.
  const x = useMotionValue(0);
  const flecha = useTransform(x, [0, DESLIZAR_PARA_RESPONDER], [0, 1]);
  const avisado = useRef(false);
  const soloSticker = m.sticker && !m.texto && !m.respuesta_mensaje && !m.respuesta_comida;

  return (
    <div className="chat-grupo">
      {dia && <p className="chat-dia"><span>{nombreDia(dia)}</span></p>}
      <motion.div
        id={`m-${m.id}`}
        className={`${propio ? "chat-fila propia" : "chat-fila"}${m.pendiente ? " pendiente" : ""}`}
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16 }}
      >
        {!propio && (fin ? <button className="chat-avatar" onClick={() => onPerfil(m.usuario_id)} aria-label={`Ver perfil de ${perfil?.nombre || "Amigo"}`}><Avatar perfil={perfil} tam={30} /></button> : <span className="chat-hueco" />)}
        <div className="chat-columna">
          <motion.span className="deslizar-responder" style={{ opacity: flecha, scale: flecha }} aria-hidden="true"><Reply size={18} /></motion.span>
          <motion.div
            className={`${soloSticker ? "burbuja burbuja-sticker" : "burbuja"}${marcado ? " marcada" : ""}`}
            {...eventos}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.55 }}
            dragSnapToOrigin
            style={{ x }}
            onDrag={(_, gesto) => {
              if (gesto.offset.x > DESLIZAR_PARA_RESPONDER && !avisado.current) {
                avisado.current = true;
                vibrar(10);
              }
            }}
            onDragEnd={(_, gesto) => {
              avisado.current = false;
              if (gesto.offset.x > DESLIZAR_PARA_RESPONDER) onResponder(m);
            }}
          >
            {!propio && inicio && <strong className="autor" style={{ color: colorDeNombre(perfiles, m.usuario_id) }}>{perfil?.nombre || "Amigo"}{perfil?.caca && " 💩"}</strong>}
            {m.respuesta_mensaje && <CitaMensaje id={m.respuesta_mensaje} />}
            {m.respuesta_comida && <CitaFoto id={m.respuesta_comida} autorId={m.usuario_id} onZoom={onZoom} />}
            {m.adjunto_path && esAudio(m.adjunto_path) && (
              <audio className="audio" controls preload="metadata" src={foto || undefined} onPointerDown={(e) => e.stopPropagation()} aria-label="Audio" />
            )}
            {m.adjunto_path && !esAudio(m.adjunto_path) && (
              <button type="button" className="adjunto" onClick={() => foto && onZoom({ src: foto, alt: "Foto del chat" })} aria-label="Ver foto">
                {foto ? <img src={foto} alt="Foto del chat" /> : <span className="adjunto-cargando" />}
              </button>
            )}
            {m.sticker && <span className="sticker" role="img" aria-label="Sticker">{m.sticker}</span>}
            {m.receta_id ? <RecetaEnChat id={m.receta_id} onVer={onVerReceta} /> : m.texto && <p><ConMenciones texto={m.texto} /></p>}
            <time dateTime={m.creado_en}>{m.pendiente ? <Clock3 size={11} aria-label="Enviando" /> : hora(m.creado_en)}</time>
          </motion.div>
          <Reacciones mensajeId={m.id} lista={reacciones} perfiles={perfiles} yoId={yoId} onReaccion={onReaccion} />
          {visto && <p className="visto">{visto}</p>}
        </div>
      </motion.div>
    </div>
  );
});

function AccionesMensaje({ mensaje, onCerrar, onResponder, avisar }) {
  const { usuario, perfiles, reaccionesMensajes, alternarReaccionMensaje } = useDatos();
  if (!mensaje) return <Hoja abierta={false} onCerrar={onCerrar} titulo="Opciones" />;
  const delMensaje = reaccionesMensajes.filter((r) => r.mensaje_id === mensaje.id);
  const mias = new Set(delMensaje.filter((r) => r.usuario_id === usuario.id).map((r) => r.emoji));

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje.texto);
      avisar("Mensaje copiado");
    } catch {
      avisar("No se pudo copiar");
    }
    onCerrar();
  }

  return (
    <Hoja abierta onCerrar={onCerrar} titulo="Opciones">
      <div className="acciones-mensaje">
        <div className="reaccionar" role="group" aria-label="Reaccionar">
          {REACCIONES.map((e) => (
            <button key={e} className={mias.has(e) ? "mia" : ""} aria-pressed={mias.has(e)} aria-label={`Reaccionar con ${e}`} onClick={() => { alternarReaccionMensaje(mensaje.id, e); vibrar(8); onCerrar(); }}>{e}</button>
          ))}
        </div>
        <button className="accion-mensaje" onClick={() => { onResponder(mensaje); onCerrar(); }}><Reply size={19} /> Responder</button>
        {mensaje.texto && <button className="accion-mensaje" onClick={copiar}><Copy size={18} /> Copiar texto</button>}
        {delMensaje.length > 0 && (
          <ul className="quienes-reaccionaron" aria-label="Quién reaccionó">
            {delMensaje.map((r) => (
              <li key={`${r.usuario_id}${r.emoji}`}>
                <Avatar perfil={perfiles[r.usuario_id]} tam={28} />
                <span>{r.usuario_id === usuario.id ? "Vos" : perfiles[r.usuario_id]?.nombre || "Amigo"}</span>
                <span className="reaccion-grande">{r.emoji}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  );
}

export default function Chat({ avisar }) {
  const {
    castigo, usuario, perfiles, fotos, mensajes, mensajesListos: cargado, agregarMensaje, quitarMensaje, emitirChat, respuesta, responder,
    lecturas, marcarLeido, firmarRutas, avisarActividad, reaccionesMensajes, alternarReaccionMensaje, abrirPerfil, extras,
  } = useDatos();
  const logrosChat = useMemo(
    () => (extras.medallas || [])
      .filter((m) => m.ganada_en && m.ganada_en >= LOGROS_EN_CHAT_DESDE && Number(String(m.codigo).split(":")[1]) >= 2 && perfiles[m.usuario_id] && nombreDeCodigo(m.codigo))
      .sort((a, b) => (a.ganada_en < b.ganada_en ? -1 : 1)),
    [extras.medallas, perfiles],
  );
  const reaccionesPorMensaje = useMemo(() => {
    const mapa = {};
    for (const r of reaccionesMensajes) (mapa[r.mensaje_id] ||= []).push(r);
    return mapa;
  }, [reaccionesMensajes]);
  const reposo = useRef(null);
  const campo = useRef(null);
  const lista = useRef(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(null);
  const [mencion, setMencion] = useState(null);
  const [acciones, setAcciones] = useState(null);
  const [citado, setCitado] = useState(null);
  const [stickers, setStickers] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [verReceta, setVerReceta] = useState(null);

  const linea = mensajes.slice(-MAXIMO_EN_PANTALLA);
  const ultimo = linea[linea.length - 1];

  useEffect(() => {
    if (respuesta) {
      setCitado(null);
      campo.current?.focus();
    }
  }, [respuesta]);

  useEffect(() => {
    // Solo se mueve la lista: en el iPhone, mover la página desacomoda el teclado.
    const el = lista.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: cargado ? "smooth" : "auto" });
  }, [linea.length, logrosChat.length, cargado]);

  // Si alguien empieza a escribir y estás abajo de todo, se muestra sin que tengas que bajar.
  const bajarSiEstaAbajo = useCallback(() => {
    const el = lista.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, []);

  // Mientras se sube una foto o un audio, los demás lo ven.
  useEffect(() => {
    if (subiendo) avisarActividad("foto");
    else avisarActividad(null);
  }, [subiendo, avisarActividad]);

  // Lo que está en pantalla queda visto.
  const miLectura = lecturas.find((l) => l.usuario_id === usuario.id)?.hasta;
  useEffect(() => {
    if (!ultimo || document.visibilityState !== "visible") return;
    if (!miLectura || miLectura < ultimo.creado_en) marcarLeido(ultimo.creado_en);
  }, [ultimo, miLectura, marcarLeido]);

  // Cada uno aparece debajo del último mensaje que vio, en todos los mensajes y para todos.
  const otros = Object.values(perfiles).filter((p) => p.id !== usuario.id);
  const hastaDe = (id) => lecturas.find((l) => l.usuario_id === id)?.hasta || "";
  function vistoDe(m, siguiente) {
    const autores = Object.values(perfiles).filter((p) => p.id !== m.usuario_id);
    const vieron = autores.filter((p) => {
      const hasta = hastaDe(p.id);
      return hasta >= m.creado_en && (!siguiente || hasta < siguiente.creado_en);
    });
    if (!vieron.length) return "";
    const nombres = vieron.map((p) => (p.id === usuario.id ? "vos" : p.nombre));
    const todosLeyeron = autores.every((p) => hastaDe(p.id) >= m.creado_en);
    return todosLeyeron && autores.length > 1 && !siguiente ? "Visto por todos" : `Visto por ${listaDeNombres(nombres)}`;
  }

  // "@" seguido de letras abre la lista de personas para mencionar.
  function alEscribir(e) {
    const valor = e.target.value;
    setTexto(valor);
    // Los demás ven "escribiendo…" mientras haya texto y se siga tecleando.
    avisarActividad(valor.trim() ? "escribiendo" : null);
    clearTimeout(reposo.current);
    reposo.current = setTimeout(() => avisarActividad(null), ESCRIBIENDO_MS);
    const antes = valor.slice(0, e.target.selectionStart ?? valor.length);
    const hallado = antes.match(/(?:^|\s)@([\p{L}\d_.]*)$/u);
    setMencion(hallado ? normal(hallado[1]) : null);
  }

  function mencionar(perfil) {
    const el = campo.current;
    const posicion = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, posicion).replace(/@([\p{L}\d_.]*)$/u, `@${perfil.nombre} `);
    setTexto(antes + texto.slice(posicion));
    setMencion(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(antes.length, antes.length);
    });
  }

  const sugeridos = mencion === null ? [] : otros.filter((p) => normal(p.nombre).startsWith(mencion)).slice(0, 5);

  const responderMensaje = useCallback((m) => {
    responder(null);
    setCitado(m);
    campo.current?.focus();
  }, [responder]);

  // El mensaje aparece al instante (con un relojito) y se confirma cuando lo guarda la base.
  async function mandar(extra, textoEnviado = "") {
    setError("");
    const id = crypto.randomUUID();
    const fila = {
      id,
      usuario_id: usuario.id,
      texto: textoEnviado,
      ...extra,
      ...(respuesta ? { respuesta_comida: respuesta.id } : {}),
      ...(citado ? { respuesta_mensaje: citado.id } : {}),
    };
    responder(null);
    setCitado(null);
    if (fila.adjunto_path) await firmarRutas([fila.adjunto_path]).catch(() => {});
    agregarMensaje({ ...fila, creado_en: new Date().toISOString(), pendiente: true });
    const { data, error: err } = await supabase.from("mensajes").insert(fila).select().single();
    if (err) {
      quitarMensaje(id);
      setError("No se pudo enviar. Probá de nuevo.");
      return false;
    }
    agregarMensaje(data);
    emitirChat("mensaje", data);
    avisarGrupo("mensaje", data.id);
    return true;
  }

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    setMencion(null);
    clearTimeout(reposo.current);
    avisarActividad(null);
    if (!(await mandar({}, limpio))) setTexto(limpio);
  }

  useEffect(() => () => {
    clearTimeout(reposo.current);
    avisarActividad(null);
  }, [avisarActividad]);

  async function enviarAudio(blob) {
    setSubiendo(true);
    setError("");
    try {
      const ruta = `${usuario.id}/chat/${crypto.randomUUID()}.${extensionAudio(blob.type)}`;
      const { error: errAudio } = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: blob.type || "audio/webm" });
      if (errAudio) throw errAudio;
      if (!(await mandar({ adjunto_path: ruta }))) await supabase.storage.from("fotos").remove([ruta]);
    } catch {
      setError("No se pudo mandar el audio.");
    } finally {
      setSubiendo(false);
    }
  }

  async function enviarSticker(sticker) {
    setStickers(false);
    vibrar(10);
    await mandar({ sticker });
  }

  // Los GIF se suben tal cual para que sigan animados; las fotos se achican. Se pueden elegir varias juntas.
  async function enviarFoto(e) {
    const archivos = [...e.target.files];
    e.target.value = "";
    if (!archivos.length) return;
    setSubiendo(true);
    setError("");
    let titulo = texto.trim();
    for (const archivo of archivos) {
      const esGif = archivo.type === "image/gif";
      if (esGif && archivo.size > GIF_MAXIMO) {
        setError("Un GIF era muy pesado y no se mandó.");
        continue;
      }
      try {
        const contenido = esGif ? archivo : await comprimirImagen(archivo);
        const ruta = `${usuario.id}/chat/${crypto.randomUUID()}.${esGif ? "gif" : "jpg"}`;
        const { error: errFoto } = await supabase.storage.from("fotos").upload(ruta, contenido, { contentType: esGif ? "image/gif" : "image/jpeg" });
        if (errFoto) throw errFoto;
        if (await mandar({ adjunto_path: ruta }, titulo)) {
          // El texto escrito acompaña solo a la primera foto.
          if (titulo) setTexto("");
          titulo = "";
        } else {
          await supabase.storage.from("fotos").remove([ruta]);
        }
      } catch {
        setError("No se pudo mandar una de las fotos.");
      }
    }
    setSubiendo(false);
  }

  const autorCitado = citado && (citado.usuario_id === usuario.id ? "vos" : perfiles[citado.usuario_id]?.nombre || "el bot");

  return (
    <section className="chat">
      <AvisoNotificaciones avisar={avisar} />

      <div className="chat-mensajes" role="log" aria-live="polite" ref={lista}>
        {cargado && linea.length === 0 && (
          <Vacio icono={MessageCircle} titulo="Todavía no hay mensajes" texto="Mandá el primero." />
        )}
        {linea.map((m, i) => {
          const previo = linea[i - 1];
          const siguiente = linea[i + 1];
          const dia = fechaLocal(new Date(m.creado_en));
          const nuevoDia = !previo || fechaLocal(new Date(previo.creado_en)) !== dia;
          const separador = nuevoDia && <p className="chat-dia"><span>{nombreDia(dia)}</span></p>;
          const fotoDe = m.adjunto_path ? fotos[m.adjunto_path] : undefined;
          // Los logros que se ganaron entre este mensaje y el siguiente.
          const logros = logrosChat.filter((l) => l.ganada_en >= m.creado_en && (!siguiente || l.ganada_en < siguiente.creado_en));
          const conLogros = (elemento) => (
            <Fragment key={m.id}>
              {elemento}
              {logros.map((l) => <LineaLogro key={`${l.usuario_id}-${l.codigo}`} logro={l} perfil={perfiles[l.usuario_id]} onPerfil={abrirPerfil} />)}
            </Fragment>
          );

          if (!m.usuario_id) {
            return conLogros(
              <div className="chat-grupo">
                {separador}
                <motion.article id={`m-${m.id}`} className="burbuja-bot" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                  <header><Bot size={17} aria-hidden="true" /> <strong>Bot del grupo</strong></header>
                  {sinEmojis(m.texto).split("\n").filter(Boolean).map((l, n) => {
                    const podio = l.match(/^([123])\. (.*)$/);
                    if (podio) return <p key={n} className="bot-podio"><b className={`puesto-${podio[1]}`}>{podio[1]}</b> {podio[2]}</p>;
                    return <p key={n} className={n > 1 && !l.includes(":") ? "bot-seccion" : undefined}>{l}</p>;
                  })}
                </motion.article>
              </div>
            );
          }

          const mismoAutor = (x) => x && x.usuario_id === m.usuario_id;
          return conLogros(
            <Mensaje
              m={m}
              propio={m.usuario_id === usuario.id}
              inicio={nuevoDia || !mismoAutor(previo)}
              fin={!mismoAutor(siguiente)}
              dia={nuevoDia ? dia : null}
              visto={m.pendiente ? "" : vistoDe(m, siguiente)}
              perfil={perfiles[m.usuario_id]}
              perfiles={perfiles}
              foto={fotoDe}
              yoId={usuario.id}
              reacciones={reaccionesPorMensaje[m.id] || SIN_REACCIONES}
              onReaccion={alternarReaccionMensaje}
              onPerfil={abrirPerfil}
              onAcciones={setAcciones}
              onResponder={responderMensaje}
              onZoom={setZoom}
              onVerReceta={setVerReceta}
            />
          );
        })}
        <ActividadEnChat perfiles={perfiles} yoId={usuario.id} alCambiar={bajarSiEstaAbajo} />
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {respuesta && (
        <div className="chat-respondiendo">
          {fotos[respuesta.foto_path] ? <img src={fotos[respuesta.foto_path]} alt="" /> : <IconoComida tipo={respuesta.tipo} />}
          <span>Respondiendo a <strong>{respuesta.usuario_id === usuario.id ? "tu foto" : perfiles[respuesta.usuario_id]?.nombre || "Amigo"}</strong></span>
          <button className="boton-icono chico" onClick={() => responder(null)} aria-label="Cancelar respuesta"><X size={16} /></button>
        </div>
      )}
      {citado && (
        <div className="chat-respondiendo">
          <Reply size={18} aria-hidden="true" />
          <span>Respondiendo a <strong>{autorCitado}</strong>: {resumenDe(citado).slice(0, 60)}</span>
          <button className="boton-icono chico" onClick={() => setCitado(null)} aria-label="Cancelar respuesta"><X size={16} /></button>
        </div>
      )}
      {sugeridos.length > 0 && (
        <ul className="chat-menciones" role="listbox" aria-label="Mencionar a">
          {sugeridos.map((p) => (
            <li key={p.id}>
              <button type="button" role="option" aria-selected="false" onMouseDown={(e) => e.preventDefault()} onClick={() => mencionar(p)}>
                <Avatar perfil={p} tam={28} /> {p.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>
        {stickers && (
          <motion.div className="panel-stickers" role="group" aria-label="Stickers" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {STICKERS.map((s) => <button key={s} type="button" onClick={() => enviarSticker(s)} aria-label={`Mandar sticker ${s}`}>{s}</button>)}
          </motion.div>
        )}
      </AnimatePresence>
      {castigo.evo ? (
        <div className="teclado-caca" role="status">
          <span aria-hidden="true">💩💩💩</span>
          <strong>El Bocha Evo te tapó el teclado de caca</strong>
          <small>Volvés a escribir el lunes.</small>
        </div>
      ) : (
      <form className="chat-enviar" onSubmit={enviar}>
        {castigo.soloTexto ? null : (
          <>
            <label className={subiendo ? "boton-icono ocupado" : "boton-icono"} aria-label="Mandar foto o GIF">
              <ImagePlus size={20} />
              <input className="oculto" type="file" accept="image/*" multiple onChange={enviarFoto} disabled={subiendo} aria-label="Elegir foto o GIF" />
            </label>
            <button type="button" className={stickers ? "boton-icono activo" : "boton-icono"} onClick={() => setStickers(!stickers)} aria-pressed={stickers} aria-label="Stickers"><Smile size={20} /></button>
          </>
        )}
        <input ref={campo} value={texto} onChange={alEscribir} placeholder={respuesta || citado ? "Escribí tu respuesta…" : "Escribí algo…"} aria-label="Mensaje" maxLength={1000} />
        {texto.trim() || castigo.soloTexto ? (
          <motion.button className="boton-enviar" type="submit" whileTap={{ scale: 0.86 }} onMouseDown={(e) => e.preventDefault()} disabled={!texto.trim()} aria-label="Enviar">
            <SendHorizontal size={20} />
          </motion.button>
        ) : (
          <Grabador onListo={enviarAudio} onError={setError} deshabilitado={subiendo} onGrabando={(si) => avisarActividad(si ? "grabando" : null)} />
        )}
      </form>
      )}
      {castigo.soloTexto && !castigo.evo && <p className="castigo-nota chat">Castigado por el Bocha: solo texto hasta que subas tu foto de hoy.</p>}

      <VerReceta receta={verReceta} onCerrar={() => setVerReceta(null)} avisar={avisar} />
      <AccionesMensaje mensaje={acciones} onCerrar={() => setAcciones(null)} onResponder={responderMensaje} avisar={avisar} />

      <AnimatePresence>
        {zoom && (
          <motion.div className="lupa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)}>
            <button className="boton-icono" aria-label="Cerrar foto"><X size={22} /></button>
            <motion.img src={zoom.src} alt={zoom.alt} initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
