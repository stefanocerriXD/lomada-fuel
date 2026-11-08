import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { Bell, Bot, Copy, ImagePlus, MessageCircle, Reply, SendHorizontal, Smile, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { activarAvisos, avisosActivos, estadoAvisos } from "../lib/avisos.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, hora, nombreDia } from "../lib/fechas.js";
import { comprimirImagen } from "../lib/imagen.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar, Hoja, Vacio, vibrar } from "../componentes/Base.jsx";
import IconoComida from "../componentes/IconoComida.jsx";

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
const resumenDe = (m) => m.texto || (m.sticker ? `Sticker ${m.sticker}` : m.adjunto_path ? "Foto" : "");

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

function Reacciones({ mensajeId }) {
  const { usuario, reaccionesMensajes, alternarReaccionMensaje } = useDatos();
  const propias = reaccionesMensajes.filter((r) => r.mensaje_id === mensajeId);
  if (!propias.length) return null;
  const grupos = [...new Set(propias.map((r) => r.emoji))];
  return (
    <div className="reacciones-mensaje">
      {grupos.map((e) => {
        const cantidad = propias.filter((r) => r.emoji === e).length;
        const mia = propias.some((r) => r.emoji === e && r.usuario_id === usuario.id);
        return (
          <button key={e} className={mia ? "mia" : ""} onClick={() => alternarReaccionMensaje(mensajeId, e)} aria-pressed={mia} aria-label={`${e} ${cantidad}`}>
            {e}{cantidad > 1 && <small>{cantidad}</small>}
          </button>
        );
      })}
    </div>
  );
}

function Mensaje({ m, propio, inicio, fin, separador, visto, onAcciones, onResponder, onZoom }) {
  const { perfiles, fotos, abrirPerfil } = useDatos();
  const { marcado, eventos } = useToqueLargo(() => onAcciones(m));
  // Deslizar a la derecha responde, como en WhatsApp.
  const x = useMotionValue(0);
  const flecha = useTransform(x, [0, DESLIZAR_PARA_RESPONDER], [0, 1]);
  const avisado = useRef(false);
  const perfil = perfiles[m.usuario_id];
  const foto = m.adjunto_path && fotos[m.adjunto_path];
  const soloSticker = m.sticker && !m.texto && !m.respuesta_mensaje && !m.respuesta_comida;

  return (
    <div className="chat-grupo">
      {separador}
      <motion.div
        id={`m-${m.id}`}
        className={propio ? "chat-fila propia" : "chat-fila"}
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {!propio && (fin ? <button className="chat-avatar" onClick={() => abrirPerfil(m.usuario_id)} aria-label={`Ver perfil de ${perfil?.nombre || "Amigo"}`}><Avatar perfil={perfil} tam={30} /></button> : <span className="chat-hueco" />)}
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
            {!propio && inicio && <strong>{perfil?.nombre || "Amigo"}</strong>}
            {m.respuesta_mensaje && <CitaMensaje id={m.respuesta_mensaje} />}
            {m.respuesta_comida && <CitaFoto id={m.respuesta_comida} autorId={m.usuario_id} onZoom={onZoom} />}
            {m.adjunto_path && (
              <button type="button" className="adjunto" onClick={() => foto && onZoom({ src: foto, alt: "Foto del chat" })} aria-label="Ver foto">
                {foto ? <img src={foto} alt="Foto del chat" /> : <span className="adjunto-cargando" />}
              </button>
            )}
            {m.sticker && <span className="sticker" role="img" aria-label="Sticker">{m.sticker}</span>}
            {m.texto && <p><ConMenciones texto={m.texto} /></p>}
            <time dateTime={m.creado_en}>{hora(m.creado_en)}</time>
          </motion.div>
          <Reacciones mensajeId={m.id} />
          {visto && <p className="visto">{visto}</p>}
        </div>
      </motion.div>
    </div>
  );
}

function AccionesMensaje({ mensaje, onCerrar, onResponder, avisar }) {
  const { usuario, reaccionesMensajes, alternarReaccionMensaje } = useDatos();
  if (!mensaje) return <Hoja abierta={false} onCerrar={onCerrar} titulo="Opciones" />;
  const mias = new Set(reaccionesMensajes.filter((r) => r.mensaje_id === mensaje.id && r.usuario_id === usuario.id).map((r) => r.emoji));

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
      </div>
    </Hoja>
  );
}

export default function Chat({ avisar }) {
  const {
    usuario, perfiles, fotos, mensajes, mensajesListos: cargado, agregarMensaje, respuesta, responder,
    lecturas, marcarLeido, firmarRutas,
  } = useDatos();
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
  }, [linea.length, cargado]);

  // Lo que está en pantalla queda visto.
  const miLectura = lecturas.find((l) => l.usuario_id === usuario.id)?.hasta;
  useEffect(() => {
    if (!ultimo || document.visibilityState !== "visible") return;
    if (!miLectura || miLectura < ultimo.creado_en) marcarLeido(ultimo.creado_en);
  }, [ultimo, miLectura, marcarLeido]);

  // Debajo de tu último mensaje, quién llegó a verlo.
  const ultimoPropio = [...linea].reverse().find((m) => m.usuario_id === usuario.id);
  const otros = Object.values(perfiles).filter((p) => p.id !== usuario.id);
  const vieron = ultimoPropio ? otros.filter((p) => (lecturas.find((l) => l.usuario_id === p.id)?.hasta || "") >= ultimoPropio.creado_en) : [];
  const textoVisto = !vieron.length ? "" : vieron.length === otros.length && otros.length > 1 ? "Visto por todos" : `Visto por ${vieron.map((p) => p.nombre).join(", ")}`;

  // "@" seguido de letras abre la lista de personas para mencionar.
  function alEscribir(e) {
    const valor = e.target.value;
    setTexto(valor);
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

  function responderMensaje(m) {
    responder(null);
    setCitado(m);
    campo.current?.focus();
  }

  async function mandar(extra, textoEnviado = "") {
    setError("");
    const fila = {
      usuario_id: usuario.id,
      texto: textoEnviado,
      ...extra,
      ...(respuesta ? { respuesta_comida: respuesta.id } : {}),
      ...(citado ? { respuesta_mensaje: citado.id } : {}),
    };
    const { data, error: err } = await supabase.from("mensajes").insert(fila).select().single();
    if (err) {
      setError("No se pudo enviar. Probá de nuevo.");
      return false;
    }
    // Se suma enseguida aunque el tiempo real tarde o esté caído.
    responder(null);
    setCitado(null);
    if (data.adjunto_path) await firmarRutas([data.adjunto_path]);
    agregarMensaje(data);
    avisarGrupo("mensaje", data.id);
    return true;
  }

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    setMencion(null);
    if (!(await mandar({}, limpio))) setTexto(limpio);
  }

  async function enviarSticker(sticker) {
    setStickers(false);
    vibrar(10);
    await mandar({ sticker });
  }

  // Los GIF se suben tal cual para que sigan animados; las fotos se achican.
  async function enviarFoto(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    const esGif = archivo.type === "image/gif";
    if (esGif && archivo.size > GIF_MAXIMO) return setError("El GIF es muy pesado. Probá con uno más chico.");
    setSubiendo(true);
    setError("");
    try {
      const contenido = esGif ? archivo : await comprimirImagen(archivo);
      const ruta = `${usuario.id}/chat/${crypto.randomUUID()}.${esGif ? "gif" : "jpg"}`;
      const { error: errFoto } = await supabase.storage.from("fotos").upload(ruta, contenido, { contentType: esGif ? "image/gif" : "image/jpeg" });
      if (errFoto) throw errFoto;
      const titulo = texto.trim();
      if (await mandar({ adjunto_path: ruta }, titulo)) setTexto("");
      else await supabase.storage.from("fotos").remove([ruta]);
    } catch {
      setError("No se pudo mandar la foto.");
    } finally {
      setSubiendo(false);
    }
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

          if (!m.usuario_id) {
            return (
              <div key={m.id} className="chat-grupo">
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
          return (
            <Mensaje
              key={m.id}
              m={m}
              propio={m.usuario_id === usuario.id}
              inicio={nuevoDia || !mismoAutor(previo)}
              fin={!mismoAutor(siguiente)}
              separador={separador}
              visto={m.id === ultimoPropio?.id ? textoVisto : ""}
              onAcciones={setAcciones}
              onResponder={responderMensaje}
              onZoom={setZoom}
            />
          );
        })}
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
      <form className="chat-enviar" onSubmit={enviar}>
        <label className={subiendo ? "boton-icono ocupado" : "boton-icono"} aria-label="Mandar foto o GIF">
          <ImagePlus size={20} />
          <input className="oculto" type="file" accept="image/*" onChange={enviarFoto} disabled={subiendo} aria-label="Elegir foto o GIF" />
        </label>
        <button type="button" className={stickers ? "boton-icono activo" : "boton-icono"} onClick={() => setStickers(!stickers)} aria-pressed={stickers} aria-label="Stickers"><Smile size={20} /></button>
        <input ref={campo} value={texto} onChange={alEscribir} placeholder={respuesta || citado ? "Escribí tu respuesta…" : "Escribí algo…"} aria-label="Mensaje" maxLength={1000} />
        <motion.button className="boton-enviar" type="submit" disabled={!texto.trim()} whileTap={{ scale: 0.86 }} onMouseDown={(e) => e.preventDefault()} aria-label="Enviar">
          <SendHorizontal size={20} />
        </motion.button>
      </form>

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
