import { useEffect, useMemo, useRef } from "react";
import { aFecha, diaCorto, fechaLocal, nombreDia, proximosDias, ultimosDias } from "../lib/fechas.js";
import { vibrar } from "./Base.jsx";

export default function TiraDias({ fecha, onElegir, conComidas }) {
  // Tres semanas para atrás y una para adelante (para dejar cargadas las comidas que vienen).
  const hoy = fechaLocal();
  const dias = useMemo(() => [...ultimosDias(21), ...proximosDias(7)], []);
  const tira = useRef(null);

  // Arranca mostrando hoy (con un par de días que vienen a la derecha).
  useEffect(() => {
    const el = tira.current;
    const boton = el?.querySelector(`[data-dia="${hoy}"]`);
    if (el && boton) el.scrollLeft = boton.offsetLeft + boton.offsetWidth * 3 - el.clientWidth + 16;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tira-dias" ref={tira} role="group" aria-label="Elegir día">
      {dias.map((d) => {
        const marcada = aFecha(d);
        return (
          <button
            key={d}
            data-dia={d}
            className={`dia${d === fecha ? " activo" : ""}${d > hoy ? " futuro" : ""}`}
            onClick={() => { onElegir(d); vibrar(5); }}
            aria-pressed={d === fecha}
            aria-label={nombreDia(d)}
          >
            {d === fecha && <span className="dia-fondo" />}
            <small>{diaCorto(d).slice(0, 3)}</small>
            <strong>{marcada.getDate()}</strong>
            <i className={conComidas.has(d) ? "con-comida" : ""} />
          </button>
        );
      })}
    </div>
  );
}
