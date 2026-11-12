import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { Avatar, LogoLegendario, MARCOS, marcoDe } from "./Base.jsx";

// Logros → el camino de todos los niveles con marco: lo conseguido, el tuyo, el próximo con su avance y lo que falta.
export default function CaminoNiveles({ perfil, nivel = 1 }) {
  const [abierto, setAbierto] = useState(false);
  const [todos, setTodos] = useState(false);
  const actual = marcoDe(nivel);
  const iActual = MARCOS.findIndex((m) => m[1] === actual);
  const iProximo = MARCOS.findIndex(([desde]) => nivel < desde);
  const conseguidos = MARCOS.filter(([desde]) => nivel >= desde).length;
  const ultimo = MARCOS.length - 1;

  // Cerrado: el anterior, el tuyo, los próximos tres y siempre el final.
  const centro = iActual >= 0 ? iActual : 0;
  const visibles = todos
    ? MARCOS.map((_, i) => i)
    : [...new Set([...Array.from({ length: 5 }, (_, k) => centro - 1 + k).filter((i) => i >= 0 && i < ultimo), ultimo])];

  return (
    <section className="camino">
      {/* Cerrado ocupa una sola línea: el marco que tenés y cuánto falta para el próximo. */}
      <button className="camino-cabecera" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span className="camino-figura chica">
          {actual === "lomada" ? <LogoLegendario tam={34} /> : <Avatar perfil={{ ...perfil, nivel, caca: null }} tam={34} />}
        </span>
        <span className="camino-resumen">
          <strong>Camino de niveles</strong>
          <small>
            {conseguidos} de {MARCOS.length} marcos
            {iProximo >= 0 && ` · ${MARCOS[iProximo][2]} en ${MARCOS[iProximo][0] - nivel === 1 ? "1 nivel" : `${MARCOS[iProximo][0] - nivel} niveles`}`}
          </small>
        </span>
        <ChevronDown size={18} className="camino-flecha" style={{ transform: abierto ? "rotate(180deg)" : undefined }} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div className="camino-cuerpo" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
      <ol className="camino-lista">
        {visibles.map((i, pos) => {
          const [desde, clave, nombre, emoji] = MARCOS[i];
          const anterior = i > 0 ? MARCOS[i - 1][0] : 0;
          const estado = clave === actual ? "actual" : nivel >= desde ? "logrado" : i === iProximo ? "proximo" : "bloqueado";
          const salto = pos > 0 && i - visibles[pos - 1] > 1;
          const avance = Math.max(0, Math.min(1, (nivel - anterior) / (desde - anterior)));
          return (
            <li key={clave} className={`camino-paso ${estado}${salto ? " con-salto" : ""}${clave === "lomada" ? " final" : ""}`}>
              {salto && <span className="camino-puntos" aria-hidden="true">⋮</span>}
              <span className="camino-figura">
                {clave === "lomada" ? <LogoLegendario tam={50} /> : <Avatar perfil={{ ...perfil, nivel: desde, caca: null }} tam={46} />}
              </span>
              <span className="camino-texto">
                <strong className={clave === "lomada" ? "titulo-legendario chico" : undefined}>{nombre} {clave !== "lomada" && emoji}</strong>
                <small>
                  Nivel {desde}
                  {estado === "actual" && " · tu marco"}
                  {estado === "proximo" && ` · te ${desde - nivel === 1 ? "falta 1" : `faltan ${desde - nivel}`}`}
                </small>
                {estado === "proximo" && (
                  <span className="pista-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)} aria-label={`Avance a ${nombre}`}>
                    <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.7 }} />
                  </span>
                )}
              </span>
              <span className="camino-estado" aria-label={estado === "bloqueado" || estado === "proximo" ? "Todavía no" : "Conseguido"}>
                {estado === "logrado" || estado === "actual" ? <Check size={17} /> : <Lock size={15} />}
              </span>
            </li>
          );
        })}
      </ol>
      <button className="camino-mas" onClick={() => setTodos(!todos)} aria-expanded={todos}>
        {todos ? "Ver menos" : `Ver los ${MARCOS.length} niveles`} <ChevronDown size={16} style={{ transform: todos ? "rotate(180deg)" : undefined }} />
      </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
