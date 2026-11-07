import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LOGROS, nombreDeCodigo } from "../lib/medallas.js";

// Festejo de pantalla completa que no frena nada: se va solo y deja tocar lo de atrás.
export default function NuevoLogro({ codigo, onTerminar }) {
  useEffect(() => {
    if (!codigo) return;
    const reloj = setTimeout(onTerminar, 2600);
    return () => clearTimeout(reloj);
  }, [codigo, onTerminar]);

  const logro = codigo && LOGROS.find((l) => l.codigo === codigo.split(":")[0]);
  const Icono = logro?.icono;

  return (
    <AnimatePresence>
      {logro && (
        <motion.div className="nuevo-logro" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="nuevo-logro-icono">
            {[0, 1, 2].map((i) => (
              <motion.i key={i} initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 1.5, delay: i * 0.25, repeat: Infinity, ease: "easeOut" }} />
            ))}
            <motion.span initial={{ scale: 0, rotate: -160 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <Icono size={46} />
            </motion.span>
          </div>
          <motion.small initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>Nuevo logro</motion.small>
          <motion.strong initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>{nombreDeCodigo(codigo)}</motion.strong>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
