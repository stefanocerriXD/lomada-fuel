import { useEffect, useState } from "react";
import { ChefHat, ChevronRight, Plus } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { pesoDeReceta, totalesDeReceta } from "../lib/recetasPropias.js";
import { Avatar, Vacio } from "./Base.jsx";
import EditorReceta from "./EditorReceta.jsx";
import VerReceta from "./VerReceta.jsx";

const redondo = (n) => Math.round(n).toLocaleString("es-AR");

export default function MisRecetas({ avisar, abrir }) {
  const { extras, perfiles, fotos } = useDatos();
  const [editando, setEditando] = useState(null);
  const [viendo, setViendo] = useState(null);
  const recetas = extras.recetas || [];
  const delGrupo = (extras.recetasGrupo || []).filter((r) => perfiles[r.usuario_id]);
  // Desde "Ver receta" en una comida: se abre esa receta. Si ya no está, se avisa.
  const [abierta, setAbierta] = useState(null);
  useEffect(() => {
    if (!abrir || abierta === abrir.vez || !extras.disponible) return;
    setAbierta(abrir.vez);
    const propia = recetas.find((r) => r.id === abrir.receta);
    const ajena = (extras.recetasGrupo || []).find((r) => r.id === abrir.receta);
    if (propia) setEditando(propia);
    else if (ajena) setViendo(ajena);
    else avisar?.("Esa receta ya no está compartida");
  }, [abrir, abierta, extras.disponible, extras.recetasGrupo, recetas, avisar]);

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
                  {r.fotos?.[0] && fotos[r.fotos[0]] && <img className="receta-miniatura" src={fotos[r.fotos[0]]} alt="" loading="lazy" />}
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
      <h3 className="perfil-subtitulo recetas-grupo-titulo">Recetas del grupo</h3>
      {delGrupo.length ? (
        <ul className="resultados lista-recetas">
          {delGrupo.map((r) => {
            const total = totalesDeReceta(r.ingredientes);
            const porciones = Math.max(1, r.porciones);
            return (
              <li key={r.id}>
                <button onClick={() => setViendo(r)}>
                  {r.fotos?.[0] && fotos[r.fotos[0]] ? <img className="receta-miniatura" src={fotos[r.fotos[0]]} alt="" loading="lazy" /> : <Avatar perfil={perfiles[r.usuario_id]} tam={30} />}
                  <span className="resultado-datos">
                    <strong>{r.nombre}</strong>
                    <span>De {perfiles[r.usuario_id].nombre} · {redondo(total.kcal / porciones)} kcal {porciones > 1 ? "la porción" : ""}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ajuste-texto">Cuando alguien del grupo guarde una receta, la vas a ver acá.</p>
      )}
      <EditorReceta receta={editando} onCerrar={() => setEditando(null)} avisar={avisar} />
      <VerReceta receta={viendo} onCerrar={() => setViendo(null)} avisar={avisar} />
    </section>
  );
}
