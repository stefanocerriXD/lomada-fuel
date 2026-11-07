import { useEffect, useMemo, useRef } from "react";
import { aFecha, diaCorto, nombreDia, ultimosDias } from "../lib/fechas.js";
import { vibrar } from "./Base.jsx";

export default function TiraDias({ fecha, onElegir, conComidas }) {
  const dias = useMemo(() => ultimosDias(21), []);
  const tira = useRef(null);

  useEffect(() => {
    tira.current?.scrollTo({ left: tira.current.scrollWidth });
  }, []);

  return (
    <div className="tira-dias" ref={tira} role="group" aria-label="Elegir día">
      {dias.map((d) => {
        const marcada = aFecha(d);
        return (
          <button
            key={d}
            className={d === fecha ? "dia activo" : "dia"}
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
