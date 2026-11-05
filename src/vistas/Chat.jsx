import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { SendHorizontal } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, hora, nombreDia } from "../lib/fechas.js";
import { Avatar, Vacio } from "../componentes/Base.jsx";

export default function Chat() {
  const { usuario, perfiles, cargarPerfiles } = useDatos();
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [cargado, setCargado] = useState(false);
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

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes]);

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    setError("");
    const { data, error: err } = await supabase
      .from("mensajes")
      .insert({ usuario_id: usuario.id, texto: limpio })
      .select()
      .single();
    if (err) {
      setTexto(limpio);
      setError(err.message);
      return;
    }
    // Se suma enseguida aunque el tiempo real tarde o esté caído.
    setMensajes((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    avisarGrupo("mensaje", data.id);
  }

  return (
    <section className="chat">
      <header className="titulo-vista chat-titulo">
        <div>
          <p className="sobretitulo">{Object.keys(perfiles).length} en el grupo</p>
          <h1>Chat</h1>
        </div>
      </header>

      <div className="chat-mensajes" role="log" aria-live="polite">
        {cargado && mensajes.length === 0 && (
          <Vacio emoji="💬" titulo="Nadie dijo nada todavía" texto="Rompé el hielo: contá qué vas a cenar." />
        )}
        {mensajes.map((m, i) => {
          const previo = mensajes[i - 1];
          const siguiente = mensajes[i + 1];
          const dia = fechaLocal(new Date(m.creado_en));
          const nuevoDia = !previo || fechaLocal(new Date(previo.creado_en)) !== dia;
          const propio = m.usuario_id === usuario.id;
          const inicio = nuevoDia || previo.usuario_id !== m.usuario_id;
          const fin = !siguiente || siguiente.usuario_id !== m.usuario_id;
          const perfil = perfiles[m.usuario_id];

          if (!m.usuario_id) {
            return (
              <div key={m.id} className="chat-grupo">
                {nuevoDia && <p className="chat-dia"><span>{nombreDia(dia)}</span></p>}
                <motion.article className="burbuja-bot" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                  <header><span aria-hidden="true">🤖</span> <strong>Bot del grupo</strong></header>
                  {m.texto.split("\n").filter(Boolean).map((linea) => <p key={linea}>{linea}</p>)}
                </motion.article>
              </div>
            );
          }

          return (
            <div key={m.id} className="chat-grupo">
              {nuevoDia && <p className="chat-dia"><span>{nombreDia(dia)}</span></p>}
              <motion.div
                className={propio ? "chat-fila propia" : "chat-fila"}
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {!propio && (fin ? <Avatar perfil={perfil} tam={30} /> : <span className="chat-hueco" />)}
                <div className="burbuja">
                  {!propio && inicio && <strong>{perfil?.nombre || "Amigo"}</strong>}
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
      <form className="chat-enviar" onSubmit={enviar}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí algo…"
          aria-label="Mensaje"
          maxLength={1000}
        />
        <motion.button className="boton-enviar" type="submit" disabled={!texto.trim()} whileTap={{ scale: 0.86 }} aria-label="Enviar">
          <SendHorizontal size={20} />
        </motion.button>
      </form>
    </section>
  );
}
