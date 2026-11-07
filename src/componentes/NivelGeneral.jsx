import { motion } from "motion/react";
import { nivelGeneral } from "../lib/medallas.js";

// Resume todos los logros de una persona en un solo nivel.
export default function NivelGeneral({ niveles }) {
  const { nivel, rango, puntos, siguiente, avance } = nivelGeneral(niveles);
  return (
    <div className="nivel-general">
      <div className="nivel-general-titulo">
        <strong>Nivel {nivel}</strong>
        <span>{rango}</span>
      </div>
      {siguiente && (
        <>
          <span className="pista-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)} aria-label={`Avance a ${siguiente.nombre}`}>
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.7 }} />
          </span>
          <small>{puntos} de {siguiente.puntos} niveles de logros para {siguiente.nombre}</small>
        </>
      )}
    </div>
  );
}
