import { motion } from "motion/react";
import { ChevronRight, Pencil, Plane } from "lucide-react";
import { aFecha, fechaLocal } from "../lib/fechas.js";
import { useDatos } from "../lib/datos.jsx";
import { useMotivacion } from "../lib/motivacion.js";
import { irAAjustes } from "../lib/navegar.js";

// El viaje de cada uno (Ajustes > Viaje y Match Day): cuenta regresiva y los cuadraditos para la playa.
// Si la base todavía no tiene la tabla (SQL 052), la Lomada sigue viendo Floripa como antes.
const VIAJE_LOMADA = { destino: "Floripa", fecha: "2026-12-26", desde: "2026-10-01" };
const CUADRADITOS = 6;
const DIA_MS = 24 * 60 * 60 * 1000;
const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / DIA_MS);

function textoFalta(dias) {
  if (dias === 1) return "Mañana te vas";
  if (dias <= 7) return "Ya está, última semana";
  if (dias <= 21) return "Falta re poco";
  return "Falta poco";
}

const fechaLarga = (f) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(new Date(`${f}T12:00:00`));

export default function Viaje({ hoy = fechaLocal() }) {
  const { usuario, grupo } = useDatos();
  const { datos, sinTabla } = useMotivacion(usuario.id);
  if (datos === undefined) return null;
  const propio = datos?.viaje_destino && datos?.viaje_fecha
    ? { destino: datos.viaje_destino, fecha: datos.viaje_fecha, desde: datos.viaje_desde || datos.viaje_fecha }
    : null;
  const VIAJE = sinTabla ? (grupo.conBocha ? VIAJE_LOMADA : null) : propio;
  if (!VIAJE) {
    return sinTabla ? null : (
      <button type="button" className="viaje-invitar" onClick={() => irAAjustes("motivacion")}>
        <Plane size={20} aria-hidden="true" />
        <span>¿Tenés un viaje?<small>Poné una cuenta regresiva para motivarte</small></span>
        <ChevronRight size={18} aria-hidden="true" style={{ marginLeft: "auto" }} />
      </button>
    );
  }
  const faltan = diasEntre(hoy, VIAJE.fecha);
  // Durante el viaje sigue el cartel; una semana después desaparece.
  if (faltan < -7) return null;
  const total = Math.max(1, diasEntre(VIAJE.desde, VIAJE.fecha));
  const avance = Math.min(Math.max((total - faltan) / total, 0), 1);
  const llenos = faltan <= 0 ? CUADRADITOS : Math.min(CUADRADITOS - 1, Math.floor(avance * CUADRADITOS));
  const semanas = Math.floor(faltan / 7);
  const resto = faltan % 7;

  return (
    <motion.section className="tarjeta viaje" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} aria-label={`Viaje a ${VIAJE.destino}`}>
      <div className="viaje-cabecera">
        <p className="viaje-sobretitulo"><Plane size={15} aria-hidden="true" /> Viaje a {VIAJE.destino} · {fechaLarga(VIAJE.fecha)}</p>
        {!sinTabla && (
          <button type="button" className="viaje-editar" onClick={() => irAAjustes("motivacion")} aria-label="Cambiar el viaje"><Pencil size={16} /></button>
        )}
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
