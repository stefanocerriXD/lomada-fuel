import { motion } from "motion/react";
import { Plane } from "lucide-react";
import { aFecha, fechaLocal } from "../lib/fechas.js";
import { useDatos } from "../lib/datos.jsx";

// El viaje del grupo: cuenta regresiva y los cuadraditos que hay que tener para la playa.
const VIAJE = { destino: "Floripa", fecha: "2026-12-26", desde: "2026-10-01" };
const CUADRADITOS = 6;
const DIA_MS = 24 * 60 * 60 * 1000;
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / DIA_MS);

function textoFalta(dias) {
  if (dias === 1) return "Mañana nos vamos";
  if (dias <= 7) return "Ya está, última semana";
  if (dias <= 21) return "Falta re poco";
  return "Falta poco";
}

export default function Viaje({ hoy = fechaLocal() }) {
  const { grupo } = useDatos();
  const faltan = diasEntre(hoy, VIAJE.fecha);
  // Durante el viaje sigue el cartel; una semana después desaparece.
  // El viaje es de la Lomada; los otros grupos no lo ven.
  if (faltan < -7 || !grupo.conBocha) return null;
  const total = Math.max(1, diasEntre(VIAJE.desde, VIAJE.fecha));
  const avance = Math.min(Math.max((total - faltan) / total, 0), 1);
  const llenos = faltan <= 0 ? CUADRADITOS : Math.min(CUADRADITOS - 1, Math.floor(avance * CUADRADITOS));
  const semanas = Math.floor(faltan / 7);
  const resto = faltan % 7;

  return (
    <motion.section className="tarjeta viaje" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} aria-label={`Viaje a ${VIAJE.destino}`}>
      <div className="viaje-cabecera">
        <p className="viaje-sobretitulo"><Plane size={15} aria-hidden="true" /> Viaje a {VIAJE.destino} · 26 de diciembre</p>
        {faltan > 0 ? (
          <>
            <p className="viaje-cuenta"><strong>{faltan}</strong> {faltan === 1 ? "día" : "días"}</p>
            <p className="viaje-detalle">
              {semanas > 0 ? `${semanas} ${semanas === 1 ? "semana" : "semanas"}${resto ? ` y ${resto} ${resto === 1 ? "día" : "días"}` : ""} · ` : ""}
              {textoFalta(faltan)}
            </p>
          </>
        ) : (
          <p className="viaje-cuenta"><strong>¡Llegó!</strong></p>
        )}
      </div>

      <div className="viaje-cuerpo">
        <div className="viaje-pista" role="progressbar" aria-valuenow={Math.round(avance * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="Cuánto falta para el viaje">
          <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
          <motion.i initial={{ left: "0%" }} animate={{ left: `${avance * 100}%` }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} aria-hidden="true"><Plane size={14} /></motion.i>
        </div>
        <div className="cuadraditos" role="img" aria-label={`${llenos} de ${CUADRADITOS} cuadraditos`}>
          {Array.from({ length: CUADRADITOS }, (_, i) => (
            <motion.span key={i} className={i < llenos ? "lleno" : ""} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 + i * 0.07 }} />
          ))}
        </div>
      </div>
      <p className="viaje-lema">{faltan > 0 ? "Hay que llegar al viaje con cuadraditos." : "A disfrutar esos cuadraditos."}</p>
    </motion.section>
  );
}
