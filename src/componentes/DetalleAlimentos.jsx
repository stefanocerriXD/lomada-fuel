import { ChefHat, ChevronRight } from "lucide-react";
import { macrosDeItem } from "../lib/macros.js";
import { useDatos } from "../lib/datos.jsx";
import { irARecetas } from "../lib/navegar.js";

const OCULTOS = /^(importado|foto)$/i;

export function alimentosVisibles(alimentos = []) {
  return alimentos.filter((a) => a.fuente !== "foto" && !OCULTOS.test(a.nombre || ""));
}

function medidaDe(a) {
  if (a.unidad && a.unidad.g !== 1) return `${a.cantidad} ${a.unidad.nombre} (${Math.round(a.gramos)} g)`;
  if (a.gramos) return `${Math.round(a.gramos)} g`;
  return a.medida || "";
}

// De quién es la receta: la guardada manda; si ya no está, lo que quedó escrito al cargarla.
function autorDeReceta(a, recetas, perfiles, yoId, autorComida) {
  const receta = recetas.find((r) => r.id === a.receta_id);
  const id = receta?.usuario_id || (a.marca === "Tu receta" ? autorComida : null);
  if (id) return id === yoId ? "vos" : perfiles[id]?.nombre || null;
  return a.marca?.startsWith("Receta de ") ? a.marca.slice(10) : null;
}

export default function DetalleAlimentos({ alimentos, autorComida }) {
  const { usuario, perfiles, extras } = useDatos();
  const recetas = [...(extras.recetas || []), ...(extras.recetasGrupo || [])];
  return (
    <ul className="detalle-alimentos">
      {alimentosVisibles(alimentos).map((a, i) => {
        const m = macrosDeItem(a);
        const medida = medidaDe(a);
        return (
          <li key={`${a.nombre}-${i}`}>
            <span className="detalle-nombre">
              <strong>{a.nombre}</strong>
              {a.receta_id && (() => {
                const autor = autorDeReceta(a, recetas, perfiles, usuario?.id, autorComida);
                return (
                  <span className="detalle-receta">
                    <ChefHat size={12} aria-hidden="true" /> Receta{autor ? ` · de ${autor}` : ""}
                    <button type="button" className="detalle-receta-link" onClick={(e) => { e.stopPropagation(); irARecetas(a.receta_id); }}>
                      Ver receta <ChevronRight size={12} aria-hidden="true" />
                    </button>
                  </span>
                );
              })()}
              {medida && <small>{medida}</small>}
            </span>
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
