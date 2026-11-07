import { macrosDeItem } from "../lib/macros.js";

const OCULTOS = /^(importado|foto)$/i;

export function alimentosVisibles(alimentos = []) {
  return alimentos.filter((a) => a.fuente !== "foto" && !OCULTOS.test(a.nombre || ""));
}

function medidaDe(a) {
  if (a.unidad && a.unidad.g !== 1) return `${a.cantidad} ${a.unidad.nombre} (${Math.round(a.gramos)} g)`;
  if (a.gramos) return `${Math.round(a.gramos)} g`;
  return a.medida || "";
}

export default function DetalleAlimentos({ alimentos }) {
  return (
    <ul className="detalle-alimentos">
      {alimentosVisibles(alimentos).map((a, i) => {
        const m = macrosDeItem(a);
        const medida = medidaDe(a);
        return (
          <li key={`${a.nombre}-${i}`}>
            <span className="detalle-nombre"><strong>{a.nombre}</strong>{medida && <small>{medida}</small>}</span>
            <span className="detalle-macros">
              <strong>{Math.round(m.kcal).toLocaleString("es-AR")} kcal</strong>
              <small>P {Math.round(m.p)} · C {Math.round(m.c)} · G {Math.round(m.g)}{a.estimado ? " · estimado" : ""}</small>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
