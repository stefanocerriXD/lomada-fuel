import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Bot, Camera, MessageCircle, SendHorizontal, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { activarAvisos, avisosActivos, estadoAvisos } from "../lib/avisos.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, hora, nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar, Vacio } from "../componentes/Base.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import TarjetaComida from "../componentes/TarjetaComida.jsx";
import Volver from "../componentes/Volver.jsx";

const MAXIMO_EN_PANTALLA = 250;
const CLAVE_AVISO = "lomada-aviso-cerrado";

// Los resúmenes del bot traen emojis guardados en la base.
const sinEmojis = (texto) => texto.replace(/\p{Extended_Pictographic}\uFE0F?\s*/gu, "");

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

function CitaFoto({ id, onZoom }) {
  const { comidas, perfiles, fotos } = useDatos();
  const comida = comidas.find((c) => c.id === id);
  if (!comida) return <span className="burbuja-cita sin-datos">Respondió una foto</span>;
  const src = fotos[comida.foto_path];
  const titulo = comida.descripcion || tipoInfo(comida.tipo).texto;
  return (
    <button className="burbuja-cita" type="button" onClick={() => src && onZoom({ src, alt: titulo })} aria-label={`Ver foto: ${titulo}`}>
      {src ? <img src={src} alt="" /> : <IconoComida tipo={comida.tipo} />}
      <span><strong>{perfiles[comida.usuario_id]?.nombre || "Amigo"}</strong><small>{titulo}</small></span>
    </button>
  );
}

export default function Chat({ onCargar, avisar, onVolver }) {
  const { usuario, perfiles, comidas, fotos, cargarPerfiles, abrirPerfil } = useDatos();
  const [respuesta, setRespuesta] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [cargado, setCargado] = useState(false);
  const [zoom, setZoom] = useState(null);
  const fondo = useRef(null);
  const perfilesRef = useRef(perfiles);
  perfilesRef.current = perfiles;

  useEffect(() => {
    let activo = true;
    supabase
      .from("mensajes")
      .select("*")
      .order("creado_en", { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (!activo) return;
        if (err) setError(err.message);
        else setMensajes(data.reverse());
        setCargado(true);
      });

    // Mensajes nuevos en vivo, de cualquier amigo.
    const canal = supabase
      .channel("mensajes-grupo")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, ({ new: nuevo }) => {
        setMensajes((prev) => (prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]));
        if (nuevo.usuario_id && !perfilesRef.current[nuevo.usuario_id]) cargarPerfiles().catch(() => {});
      })
      .subscribe();

    return () => {
      activo = false;
      supabase.removeChannel(canal);
    };
  }, [cargarPerfiles]);

  // Mensajes y comidas van en una sola línea de tiempo.
  const linea = useMemo(() => {
    const todo = [
      ...mensajes.map((m) => ({ ...m, clase: "mensaje" })),
      ...comidas.filter((c) => c.tipo !== "resumen").map((c) => ({ ...c, clase: "comida" })),
    ];
    return todo.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)).slice(-MAXIMO_EN_PANTALLA);
  }, [mensajes, comidas]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: cargado ? "smooth" : "auto", block: "end" });
  }, [linea.length, cargado]);

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    setError("");
    const { data, error: err } = await supabase
      .from("mensajes")
      .insert({ usuario_id: usuario.id, texto: limpio, ...(respuesta ? { respuesta_comida: respuesta.id } : {}) })
      .select()
      .single();
    if (err) {
      setTexto(limpio);
      setError(err.message);
      return;
    }
    setRespuesta(null);
    // Se suma enseguida aunque el tiempo real tarde o esté caído.
    setMensajes((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    avisarGrupo("mensaje", data.id);
  }

  return (
    <section className="chat">
      <Volver titulo="Chat" onVolver={onVolver} />
      <AvisoNotificaciones avisar={avisar} />

      <div className="chat-mensajes" role="log" aria-live="polite">
        {cargado && linea.length === 0 && (
          <Vacio icono={MessageCircle} titulo="Todavía no hay nada" texto="Subí tu primera comida o mandá un mensaje." />
        )}
        {linea.map((m, i) => {
          const previo = linea[i - 1];
          const siguiente = linea[i + 1];
          const dia = fechaLocal(new Date(m.creado_en));
          const nuevoDia = !previo || fechaLocal(new Date(previo.creado_en)) !== dia;
          const propio = m.usuario_id === usuario.id;
          const separador = nuevoDia && <p className="chat-dia"><span>{nombreDia(dia)}</span></p>;

          if (m.clase === "comida") {
            return (
              <div key={`c-${m.id}`} className="chat-grupo">
                {separador}
                <div className={propio ? "chat-comida propia" : "chat-comida"}>
                  <TarjetaComida
                    comida={m}
                    perfil={perfiles[m.usuario_id]}
                    foto={fotos[m.foto_path]}
                    propia={propio}
                    indice={0}
                    onZoom={setZoom}
                    onEditar={() => onCargar({ comida: m })}
                    onResponder={setRespuesta}
                    avisar={avisar}
                  />
                </div>
              </div>
            );
          }

          if (!m.usuario_id) {
            return (
              <div key={m.id} className="chat-grupo">
                {separador}
                <motion.article className="burbuja-bot" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                  <header><Bot size={17} aria-hidden="true" /> <strong>Bot del grupo</strong></header>
                  {sinEmojis(m.texto).split("\n").filter(Boolean).map((l) => <p key={l}>{l}</p>)}
                </motion.article>
              </div>
            );
          }

          const mismoAutor = (x) => x && x.clase === "mensaje" && x.usuario_id === m.usuario_id;
          const inicio = nuevoDia || !mismoAutor(previo);
          const fin = !mismoAutor(siguiente);
          const perfil = perfiles[m.usuario_id];
          return (
            <div key={m.id} className="chat-grupo">
              {separador}
              <motion.div
                className={propio ? "chat-fila propia" : "chat-fila"}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {!propio && (fin ? <button className="chat-avatar" onClick={() => abrirPerfil(m.usuario_id)} aria-label={`Ver perfil de ${perfil?.nombre || "Amigo"}`}><Avatar perfil={perfil} tam={30} /></button> : <span className="chat-hueco" />)}
                <div className="burbuja">
                  {!propio && inicio && <strong>{perfil?.nombre || "Amigo"}</strong>}
                  {m.respuesta_comida && <CitaFoto id={m.respuesta_comida} onZoom={setZoom} />}
                  <p>{m.texto}</p>
                  <time dateTime={m.creado_en}>{hora(m.creado_en)}</time>
                </div>
              </motion.div>
            </div>
          );
        })}
        <div ref={fondo} />
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {respuesta && (
        <div className="chat-respondiendo">
          {fotos[respuesta.foto_path] ? <img src={fotos[respuesta.foto_path]} alt="" /> : <IconoComida tipo={respuesta.tipo} />}
          <span>Respondiendo a <strong>{perfiles[respuesta.usuario_id]?.nombre || "Amigo"}</strong></span>
          <button className="boton-icono chico" onClick={() => setRespuesta(null)} aria-label="Cancelar respuesta"><X size={16} /></button>
        </div>
      )}
      <form className="chat-enviar" onSubmit={enviar}>
        <button type="button" className="boton-icono" onClick={() => onCargar()} aria-label="Subir foto de comida"><Camera size={20} /></button>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí algo…" aria-label="Mensaje" maxLength={1000} />
        <motion.button className="boton-enviar" type="submit" disabled={!texto.trim()} whileTap={{ scale: 0.86 }} onMouseDown={(e) => e.preventDefault()} aria-label="Enviar">
          <SendHorizontal size={20} />
        </motion.button>
      </form>

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
