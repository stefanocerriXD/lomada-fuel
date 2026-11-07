import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Lock, SendHorizontal, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar, vibrar } from "./Base.jsx";
import DetalleAlimentos, { alimentosVisibles } from "./DetalleAlimentos.jsx";
import { Reacciones } from "./TarjetaComida.jsx";

// Foto a pantalla completa, con sus datos y una respuesta que cae en el chat del grupo.
export default function Visor({ lista, inicio = 0, onCerrar }) {
  const { usuario, perfiles, fotos, abrirPerfil } = useDatos();
  const [indice, setIndice] = useState(inicio);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState("");
  const comida = lista[indice];

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, lista.length - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [lista.length, onCerrar]);

  useEffect(() => {
    setTexto("");
    setEstado("");
  }, [indice]);

  if (!comida) return null;
  const perfil = perfiles[comida.usuario_id];
  const tipo = tipoInfo(comida.tipo);
  const titulo = comida.descripcion || tipo.texto;
  const soloFoto = comida.alimentos?.[0]?.fuente === "foto" && !comida.calorias;

  async function responder(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setEnviando(true);
    setEstado("");
    const { data, error } = await supabase
      .from("mensajes")
      .insert({ usuario_id: usuario.id, texto: limpio, respuesta_comida: comida.id })
      .select()
      .single();
    setEnviando(false);
    if (error) return setEstado("No se pudo enviar");
    setTexto("");
    setEstado("Enviado al chat");
    vibrar(10);
    avisarGrupo("mensaje", data.id);
  }

  function verPerfil() {
    abrirPerfil(comida.usuario_id);
    onCerrar();
  }

  return createPortal(
    <motion.div className="visor-foto" role="dialog" aria-modal="true" aria-label={`Foto: ${titulo}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="visor-cabecera">
        <button className="visor-autor" onClick={verPerfil} aria-label={`Ver perfil de ${perfil?.nombre || "Amigo"}`}>
          <Avatar perfil={perfil} tam={38} />
          <span>
            <strong>{perfil?.nombre || "Amigo"}</strong>
            <small>{tipo.texto} · {haceCuanto(comida.creado_en)}{comida.privada && <> · <Lock size={12} /> Solo vos</>}</small>
          </span>
        </button>
        <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar foto"><X size={22} /></button>
      </header>

      <div className="visor-imagen">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img key={comida.id} src={fotos[comida.foto_path]} alt={titulo} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
        </AnimatePresence>
        {indice > 0 && <button className="visor-flecha izquierda" onMouseDown={(e) => e.preventDefault()} onClick={() => setIndice(indice - 1)} aria-label="Foto anterior"><ChevronLeft size={24} /></button>}
        {indice < lista.length - 1 && <button className="visor-flecha derecha" onMouseDown={(e) => e.preventDefault()} onClick={() => setIndice(indice + 1)} aria-label="Foto siguiente"><ChevronRight size={24} /></button>}
      </div>

      <footer className="visor-pie">
        <p className="visor-texto">{titulo}</p>
        <p className="visor-datos">
          {soloFoto ? "Contada en el total del día" : `${(comida.calorias || 0).toLocaleString("es-AR")} kcal · P ${Math.round(comida.proteinas || 0)} · C ${Math.round(comida.carbohidratos || 0)} · G ${Math.round(comida.grasas || 0)}`}
        </p>
        {alimentosVisibles(comida.alimentos).length > 0 && (
          <details className="visor-alimentos">
            <summary>Ver alimentos</summary>
            <DetalleAlimentos alimentos={comida.alimentos} />
          </details>
        )}
        {!comida.privada && <Reacciones comidaId={comida.id} />}
        {!comida.privada && (
          <form className="visor-responder" onSubmit={responder}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={comida.usuario_id === usuario.id ? "Escribí algo en el chat…" : `Responder a ${perfil?.nombre || "tu amigo"}…`} aria-label="Responder por el chat" maxLength={1000} />
            <button className="boton-enviar" type="submit" disabled={enviando || !texto.trim()} onMouseDown={(e) => e.preventDefault()} aria-label="Enviar al chat"><SendHorizontal size={19} /></button>
          </form>
        )}
        {estado && <p className="visor-estado" role="status">{estado}</p>}
      </footer>
    </motion.div>,
    document.body,
  );
}
