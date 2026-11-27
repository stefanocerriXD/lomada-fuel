import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { vibrar } from "./Base.jsx";

// Guía de novedades: la primera vez que se entra después de una actualización, ilumina cada cosa nueva
// con un cartelito. "OK" pasa a la siguiente y la cruz la cierra. Sale una sola vez por teléfono.
// Cada paso: { donde: selector o función que devuelve el elemento, titulo, texto }. Sin "donde", va al centro.
const BLOQUEAN = ".nuevo-logro, .subida-nivel, #splash, [role='dialog'][aria-modal='true'], .capa, .hdia-visor";
const MARGEN = 6;

const claveDe = (id) => `lomada-guia-${id}`;
function yaVista(id) {
  try {
    return localStorage.getItem(claveDe(id)) === "vista";
  } catch {
    return true; // Sin almacenamiento se mostraría cada vez: mejor no mostrarla.
  }
}

function buscar(donde) {
  if (!donde) return null;
  const el = typeof donde === "function" ? donde() : document.querySelector(donde);
  return el && el.getClientRects().length ? el : null;
}

export default function GuiaNovedades({ id, pasos, lista = true }) {
  const [paso, setPaso] = useState(-1);
  const [caja, setCaja] = useState(null);

  // Arranca cuando la pantalla está libre (sin festejos, hojas abiertas ni la pantalla de carga).
  useEffect(() => {
    if (!lista || paso >= 0 || yaVista(id)) return undefined;
    const t = setInterval(() => {
      if (document.querySelector(BLOQUEAN) || !buscar(pasos[0].donde)) return;
      clearInterval(t);
      setPaso(0);
    }, 900);
    return () => clearInterval(t);
  }, [id, pasos, lista, paso]);

  const cerrar = useCallback(() => {
    try {
      localStorage.setItem(claveDe(id), "vista");
    } catch {
      // Sin almacenamiento, igual se cierra.
    }
    setPaso(-2);
  }, [id]);

  const actual = paso >= 0 ? pasos[paso] : null;

  // Ubica el foco sobre lo que se explica (y lo sigue si se mueve la pantalla).
  useLayoutEffect(() => {
    if (!actual) return undefined;
    const el = buscar(actual.donde);
    if (!el) { setCaja(null); return undefined; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const medir = () => {
      const r = el.getBoundingClientRect();
      setCaja({ top: r.top - MARGEN, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 });
    };
    medir();
    const t = setInterval(medir, 120);
    const fin = setTimeout(() => clearInterval(t), 900);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      clearInterval(t);
      clearTimeout(fin);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [actual]);

  useEffect(() => {
    if (!actual) return undefined;
    const tecla = (e) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [actual, cerrar]);

  function ok() {
    vibrar(6);
    if (paso >= pasos.length - 1) return cerrar();
    setPaso(paso + 1);
  }

  if (!actual) return null;
  // El cartel va abajo de lo iluminado si hay lugar; si no, arriba. Sin nada que iluminar, al centro.
  const alto = window.innerHeight;
  const abajo = caja && caja.top + caja.height + 210 < alto;
  const estiloCartel = !caja
    ? { top: 0, bottom: 0, height: "fit-content", marginTop: "auto", marginBottom: "auto" }
    : abajo
      ? { top: caja.top + caja.height + 12 }
      : { bottom: alto - caja.top + 12 };
  const ultimo = paso === pasos.length - 1;

  return createPortal(
    <div className="guia" role="dialog" aria-modal="true" aria-label={`Novedades: ${actual.titulo}`}>
      {caja ? (
        <motion.div className="guia-foco" initial={false} animate={caja} transition={{ type: "spring", stiffness: 300, damping: 32 }} aria-hidden="true" />
      ) : (
        <div className="guia-velo" aria-hidden="true" />
      )}
      <AnimatePresence mode="wait">
        <motion.section
          key={paso}
          className="guia-cartel"
          style={estiloCartel}
          initial={{ opacity: 0, y: abajo ? -8 : 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18 }}
        >
          <button type="button" className="guia-cerrar" onClick={cerrar} aria-label="Cerrar la guía"><X size={18} /></button>
          <small className="guia-paso">{paso + 1} de {pasos.length}</small>
          <strong>{actual.titulo}</strong>
          <p>{actual.texto}</p>
          <div className="guia-pie">
            <span className="guia-puntos" aria-hidden="true">{pasos.map((_, n) => <i key={n} className={n === paso ? "activo" : undefined} />)}</span>
            <button type="button" className="boton guia-ok" onClick={ok}>{ultimo ? "¡Listo!" : "OK"}</button>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
