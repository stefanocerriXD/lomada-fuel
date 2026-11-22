// El cartel del informe semanal arriba del Resumen. La presentación completa (InformeSemanal) se baja recién al abrirla.
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { calcularPlan } from "../lib/cuerpo.js";
import { armarInforme, semanaDelInforme } from "../lib/informe.js";
import { fechaLocal } from "../lib/fechas.js";
import { vibrar } from "./Base.jsx";
import Logo from "./Logo.jsx";

export const EVENTO_INFORME = "lomada:informe";
// Se puede usar directo como onClick: lo que no sea "lista" abre la presentación.
export const abrirInforme = (modo) => window.dispatchEvent(new CustomEvent(EVENTO_INFORME, { detail: { modo: modo === "lista" ? "lista" : "historia" } }));

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const miles = (n) => Math.round(n).toLocaleString("es-AR");
export const fechaCorta = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
const fechaLarga = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const diaSemana = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" }).replace(",", "");
const horaTexto = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const SEGUNDOS_POR_PANTALLA = 6.5;
const CLAVE_CERRADO = "lomada-informe-cerrado";

// El cartel y la presentación: el domingo y el lunes.
export function informeListo(ahora = new Date()) {
  return ahora.getDay() === 0 || ahora.getDay() === 1;
}

const leerCerrado = () => { try { return localStorage.getItem(CLAVE_CERRADO); } catch { return null; } };

export function useInforme(activo) {
  const { usuario, yo, comidas, perfiles, salud, extras } = useDatos();
  return useMemo(() => {
    if (!activo) return null;
    const plan = salud ? calcularPlan(salud) : null;
    const metasMacros = plan ? { p: plan.proteinas, c: plan.carbohidratos, g: plan.grasas } : null;
    return armarInforme({ comidas, usuarioId: usuario.id, meta: yo.meta_calorias, metaProteina: plan?.proteinas || null, metasMacros, agua: extras.agua, perfiles });
  }, [activo, comidas, usuario.id, yo.meta_calorias, salud, extras.agua, perfiles]);
}

// ---------- El cartel anclado arriba del resumen ----------
export function CartelInforme() {
  const { hasta } = semanaDelInforme(fechaLocal());
  const [cerrado, setCerrado] = useState(() => leerCerrado() === hasta);
  const visible = informeListo() && !cerrado;
  const informe = useInforme(visible);

  function cerrar(e) {
    e.stopPropagation();
    vibrar(8);
    setCerrado(true);
    try { localStorage.setItem(CLAVE_CERRADO, hasta); } catch { /* opcional */ }
  }

  return (
    <AnimatePresence initial>
      {visible && informe && (
        <motion.div
          className="cartel-informe-marco"
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <motion.button className="cartel-informe" onClick={() => { vibrar(10); abrirInforme(); }} whileTap={{ scale: 0.97 }} aria-label="Ver tu informe semanal">
            <span className="cartel-brillo" aria-hidden="true" />
            <span className="cartel-chispas" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ "--i": i }} />)}</span>
            <span className="cartel-logo" aria-hidden="true">
              <span className="cartel-pulso" />
              <Logo tam={44} />
            </span>
            <span className="cartel-texto">
              <small>Informe semanal</small>
              <strong>Tu semana está lista</strong>
              <span>
                {fechaCorta(informe.desde)} al {fechaCorta(informe.hasta)}
                {informe.actual.dias ? ` · ${miles(informe.actual.kcal)} kcal de promedio` : " · tocá para verla"}
              </span>
            </span>
            <span className="cartel-flecha" aria-hidden="true"><ChevronRight size={20} /></span>
          </motion.button>
          <button className="cartel-cerrar" onClick={cerrar} aria-label="Cerrar el cartel del informe"><X size={16} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
