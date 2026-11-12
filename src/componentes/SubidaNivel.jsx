import { useEffect, useState } from "react";
import { animate, AnimatePresence, motion } from "motion/react";
import { useDatos } from "../lib/datos.jsx";
import { Avatar, datosMarco, LogoLegendario, marcoDe, resorte, vibrar } from "./Base.jsx";

const leer = (clave) => {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};
const guardar = (clave, nivel) => {
  try {
    localStorage.setItem(clave, String(nivel));
  } catch {
    // Sin almacenamiento, no se festeja de nuevo hasta que vuelva a subir.
  }
};

// Al subir de nivel general: el número sube, el avatar estrena marco y, al final de todo, LOMADA LEGENDARY.
// Espera a que termine el cartel de un logro nuevo para no taparlo.
export default function SubidaNivel({ ocupado }) {
  const { usuario, yo, extras } = useDatos();
  const [festejo, setFestejo] = useState(null);
  const [numero, setNumero] = useState(0);
  const clave = `lomada-nivel-${usuario.id}`;

  useEffect(() => {
    if (!extras.disponible || !yo.nivel || ocupado || festejo) return;
    const visto = leer(clave);
    // La primera vez solo se anota: no se festeja todo lo que ya tenía.
    if (visto === null || yo.nivel < visto) return guardar(clave, yo.nivel);
    if (yo.nivel === visto) return;
    guardar(clave, yo.nivel);
    const antes = marcoDe(visto);
    const ahora = marcoDe(yo.nivel);
    setFestejo({ desde: visto, hasta: yo.nivel, marco: ahora !== antes ? datosMarco(ahora) : null, legendario: ahora === "lomada" && antes !== "lomada" });
    vibrar([20, 60, 30]);
  }, [extras.disponible, yo.nivel, ocupado, festejo, clave]);

  useEffect(() => {
    if (!festejo) return undefined;
    setNumero(festejo.desde);
    const cuenta = animate(festejo.desde, festejo.hasta, { duration: 0.9, delay: 0.35, ease: "easeOut", onUpdate: (v) => setNumero(Math.round(v)) });
    const fin = setTimeout(() => setFestejo(null), festejo.legendario ? 7000 : festejo.marco ? 4200 : 3000);
    return () => {
      cuenta.stop();
      clearTimeout(fin);
    };
  }, [festejo]);

  return (
    <AnimatePresence>
      {festejo && (
        <motion.div className={festejo.legendario ? "subida-nivel legendaria" : "subida-nivel"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFestejo(null)} role="status" aria-live="polite">
          <motion.div className="subida-tarjeta" initial={{ scale: 0.55, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0 }} transition={resorte}>
            <span className="subida-rayos" aria-hidden="true" />
            <motion.span className="subida-figura" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}>
              {festejo.legendario ? <LogoLegendario tam={150} /> : <Avatar perfil={{ ...yo, nivel: festejo.hasta, caca: null }} tam={104} />}
            </motion.span>
            <small className="subida-sobre">{festejo.legendario ? "Llegaste al final" : "¡Subiste de nivel!"}</small>
            {festejo.legendario ? (
              <strong className="titulo-legendario">LOMADA LEGENDARY</strong>
            ) : (
              <strong className="subida-numero">Nivel {numero}</strong>
            )}
            {festejo.marco && !festejo.legendario && (
              <motion.p className="subida-marco" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}>
                Nuevo marco: <strong>{festejo.marco[2]} {festejo.marco[3]}</strong>
              </motion.p>
            )}
            {festejo.legendario && <p className="subida-marco">Todos los logros al máximo. Nivel {festejo.hasta}.</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
