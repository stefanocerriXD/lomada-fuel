import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Lock, Reply, X } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar } from "./Base.jsx";
import DetalleAlimentos, { alimentosVisibles } from "./DetalleAlimentos.jsx";
import { Reacciones } from "./TarjetaComida.jsx";

// Foto a pantalla completa, con sus datos y una respuesta que cae en el chat del grupo.
export default function Visor({ lista, inicio = 0, inicioFoto = 0, onCerrar }) {
  const { perfiles, fotos, abrirPerfil, responder, castigo, usuario } = useDatos();
  const [indice, setIndice] = useState(inicio);
  const [paso, setPaso] = useState(0);
  const [cual, setCual] = useState(inicioFoto);
  const comida = lista[indice];
  // Al pasar a otra comida vuelve a su primera foto (al abrir, la que tocaste).
  const anterior = useRef(indice);
  useEffect(() => {
    if (anterior.current === indice) return;
    anterior.current = indice;
    setCual(0);
  }, [indice]);

  function mover(sentido) {
    const proxima = indice + sentido;
    if (proxima < 0 || proxima >= lista.length) return;
    setPaso(sentido);
    setIndice(proxima);
  }

  // De costado cambia de foto; hacia abajo cierra.
  function alSoltar(_, gesto) {
    if (Math.abs(gesto.offset.x) > 70) mover(gesto.offset.x < 0 ? 1 : -1);
    else if (gesto.offset.y > 110) onCerrar();
  }

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, lista.length - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [lista.length, onCerrar]);

  if (!comida) return null;
  const perfil = perfiles[comida.usuario_id];
  const tipo = tipoInfo(comida.tipo);
  const titulo = comida.descripcion || tipo.texto;
  const soloFoto = comida.alimentos?.[0]?.fuente === "foto" && !comida.calorias;
  const rutas = [comida.foto_path, ...(comida.fotos_extra || []), comida.postre_foto].filter(Boolean);
  const ruta = rutas[Math.min(cual, rutas.length - 1)];
  const esPostre = Boolean(comida.postre_foto) && ruta === comida.postre_foto;
  // Con el castigo, las fotos de los demás no se destapan ampliándolas.
  const ajena = comida.usuario_id !== usuario.id;
  const oculta = ajena && castigo.calavera;
  const tapada = ajena && castigo.diario;

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

      <div className={oculta ? "visor-imagen oculta" : tapada ? "visor-imagen tapada" : "visor-imagen"}>
        {esPostre && <span className="visor-postre">🍮 Postre{comida.postre_nombre ? ` · ${comida.postre_nombre}` : ""}</span>}
        {(oculta || tapada) && <span className="foto-castigo-texto">{oculta ? "💀 Dos semanas sin subir fotos. Subí la tuya para volver a verlas." : "Subí tu foto de hoy para ver las del grupo"}</span>}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={`${comida.id}-${cual}`}
            src={fotos[ruta]}
            alt={titulo}
            drag
            dragDirectionLock
            dragSnapToOrigin
            dragElastic={0.7}
            onDragEnd={alSoltar}
            initial={{ opacity: 0, x: paso * 70 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
          />
        </AnimatePresence>
        {indice > 0 && <button className="visor-flecha izquierda" onClick={() => mover(-1)} aria-label="Foto anterior"><ChevronLeft size={24} /></button>}
        {indice < lista.length - 1 && <button className="visor-flecha derecha" onClick={() => mover(1)} aria-label="Foto siguiente"><ChevronRight size={24} /></button>}
      </div>

      {rutas.length > 1 && (
        <div className="visor-miniaturas" role="group" aria-label="Fotos de esta comida">
          {rutas.map((r, n) => (
            <button key={r} className={n === cual ? "activa" : undefined} onClick={() => setCual(n)} aria-label={r === comida.postre_foto ? "Foto del postre" : `Foto ${n + 1} de ${rutas.length}`} aria-pressed={n === cual}>
              {fotos[r] && <img src={fotos[r]} alt="" />}
              {r === comida.postre_foto && <span className="miniatura-postre" aria-hidden="true">🍮</span>}
            </button>
          ))}
        </div>
      )}

      <footer className="visor-pie">
        <p className="visor-texto">{titulo}</p>
        {(comida.postre_nombre || comida.postre_foto) && <p className="visor-datos">🍮 Postre{comida.postre_nombre ? `: ${comida.postre_nombre}` : ""}</p>}
        <p className="visor-datos">
          {soloFoto ? "Contada en el total del día" : `${(comida.calorias || 0).toLocaleString("es-AR")} kcal · P ${Math.round(comida.proteinas || 0)} · C ${Math.round(comida.carbohidratos || 0)} · G ${Math.round(comida.grasas || 0)}`}
        </p>
        {alimentosVisibles(comida.alimentos).length > 0 && (
          <details className="visor-alimentos">
            <summary>Ver alimentos</summary>
            <DetalleAlimentos alimentos={comida.alimentos} autorComida={comida.usuario_id} />
          </details>
        )}
        {!comida.privada && <Reacciones comidaId={comida.id} />}
        {!comida.privada && (
          <button className="boton visor-responder" onClick={() => { responder(comida); onCerrar(); }}>
            <Reply size={18} /> Responder en el chat
          </button>
        )}
      </footer>
    </motion.div>,
    document.body,
  );
}
