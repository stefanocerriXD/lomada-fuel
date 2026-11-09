import { useState } from "react";
import { ChefHat, ChevronRight, Plus } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { pesoDeReceta, totalesDeReceta } from "../lib/recetasPropias.js";
import { Vacio } from "./Base.jsx";
import EditorReceta from "./EditorReceta.jsx";

const redondo = (n) => Math.round(n).toLocaleString("es-AR");

export default function MisRecetas({ avisar }) {
  const { extras } = useDatos();
  const [editando, setEditando] = useState(null);
  const recetas = extras.recetas || [];

  return (
    <section className="tarjeta ajuste">
      <p className="ajuste-texto">Guardá lo que cocinás seguido con sus ingredientes y en cuántas porciones lo dividís. Después lo buscás por el nombre al cargar una comida y elegís cuántas porciones comiste.</p>
      <button className="boton" onClick={() => setEditando({})}><Plus size={18} /> Nueva receta</button>
      {recetas.length ? (
        <ul className="resultados lista-recetas">
          {recetas.map((r) => {
            const total = totalesDeReceta(r.ingredientes);
            const porciones = Math.max(1, r.porciones);
            return (
              <li key={r.id}>
                <button onClick={() => setEditando(r)}>
                  <span className="resultado-datos">
                    <strong>{r.nombre}</strong>
                    <span>{porciones} {porciones === 1 ? "porción" : "porciones"} de {redondo(pesoDeReceta(r) / porciones)} g · {redondo(total.kcal / porciones)} kcal cada una</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Vacio icono={ChefHat} titulo="Todavía no hay recetas" texto="Probá con algo que hagas seguido, como un budín o una tarta." />
      )}
      <EditorReceta receta={editando} onCerrar={() => setEditando(null)} avisar={avisar} />
    </section>
  );
}
