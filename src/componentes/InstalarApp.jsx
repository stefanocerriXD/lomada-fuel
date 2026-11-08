import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Share, X } from "lucide-react";

const CLAVE = "lomada-instalar-cerrado";
const ESPERA_MS = 3 * 24 * 60 * 60 * 1000; // Si lo cierran, vuelve a aparecer a los 3 días.

// Ya abierta como app (desde el ícono de inicio), no hace falta nada.
const esApp = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const esCelular = () => window.matchMedia?.("(pointer: coarse)").matches;
const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function cerradoHacepoco() {
  try {
    return Date.now() - Number(localStorage.getItem(CLAVE) || 0) < ESPERA_MS;
  } catch {
    return false;
  }
}

export default function InstalarApp() {
  const [visible, setVisible] = useState(() => !esApp() && esCelular() && !cerradoHacepoco());
  const [pedido, setPedido] = useState(null);

  // Android con Chrome ofrece instalar con un toque.
  useEffect(() => {
    const guardar = (e) => {
      e.preventDefault();
      setPedido(e);
    };
    const instalada = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", guardar);
    window.addEventListener("appinstalled", instalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", guardar);
      window.removeEventListener("appinstalled", instalada);
    };
  }, []);

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      // Sin almacenamiento vuelve a aparecer la próxima vez.
    }
  }

  async function instalar() {
    pedido.prompt();
    const { outcome } = await pedido.userChoice;
    if (outcome === "accepted") setVisible(false);
    setPedido(null);
  }

  const iphone = esIphone();
  return (
    <AnimatePresence>
      {visible && (
        <motion.aside className="instalar-app" role="region" aria-label="Instalar la app" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <img src="/icono-192.png" alt="" width="40" height="40" />
          <div>
            <strong>Usala como app</strong>
            {pedido ? (
              <span>Se abre más rápido y te llegan los avisos.</span>
            ) : iphone ? (
              <span>Tocá <Share size={14} aria-label="Compartir" /> Compartir y después <b>Agregar a inicio</b>.</span>
            ) : (
              <span>Tocá el menú ⋮ del navegador y <b>Agregar a la pantalla principal</b>.</span>
            )}
          </div>
          {pedido && <button className="boton-chico activo" onClick={instalar}><Download size={15} /> Instalar</button>}
          <button className="boton-icono chico" onClick={cerrar} aria-label="Cerrar aviso"><X size={16} /></button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
