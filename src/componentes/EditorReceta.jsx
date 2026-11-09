import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { prepararItem } from "../lib/unidades.js";
import { macrosDeItem } from "../lib/macros.js";
import { pesoDeReceta, totalesDeReceta } from "../lib/recetasPropias.js";
import { FilaItem, Resultados } from "../vistas/NuevaComida.jsx";
import { Hoja, vibrar } from "./Base.jsx";

const redondo = (n) => Math.round(n).toLocaleString("es-AR");

// Armar o editar una receta: ingredientes con sus cantidades, en cuántas porciones se divide y cuánto pesa terminada.
export default function EditorReceta({ receta, onCerrar, avisar }) {
  return (
    <Hoja abierta={!!receta} onCerrar={onCerrar} titulo={receta?.id ? "Editar receta" : "Nueva receta"} ancha>
      {receta && <Formulario key={receta.id || "nueva"} receta={receta} onListo={onCerrar} avisar={avisar} />}
    </Hoja>
  );
}

function Formulario({ receta, onListo, avisar }) {
  const { usuario, cargarExtras } = useDatos();
  const [nombre, setNombre] = useState(receta.nombre || "");
  const [porciones, setPorciones] = useState(receta.porciones || 8);
  const [pesoFinal, setPesoFinal] = useState(receta.peso_final ? String(receta.peso_final) : "");
  const [items, setItems] = useState(() => (receta.ingredientes || []).map((i) => ({ ...(i.por100 ? prepararItem(i) : i), id: crypto.randomUUID() })));
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => totalesDeReceta(items), [items]);
  const peso = pesoDeReceta({ ingredientes: items, porciones, peso_final: Number(pesoFinal) || null });
  const porcion = (k) => total[k] / Math.max(1, porciones);

  function agregar(alimento) {
    setItems((prev) => [...prev, { ...(alimento.por100 ? prepararItem(alimento) : alimento), id: crypto.randomUUID() }]);
    setTexto("");
    vibrar(8);
  }

  async function guardar() {
    if (!nombre.trim()) return setError("Ponele un nombre a la receta.");
    if (!items.length) return setError("Agregá al menos un ingrediente.");
    setGuardando(true);
    setError("");
    const fila = {
      nombre: nombre.trim().slice(0, 80),
      porciones: Math.min(100, Math.max(1, Math.round(porciones))),
      peso_final: Number(pesoFinal) > 0 ? Number(pesoFinal) : null,
      ingredientes: items.map(({ id, indice, medidas, ...i }) => ({ ...i, ...(i.por100 ? macrosDeItem(i) : {}) })),
      actualizado_en: new Date().toISOString(),
    };
    const consulta = supabase.from("recetas_propias");
    const { error: err } = await (receta.id ? consulta.update(fila).eq("id", receta.id) : consulta.insert({ ...fila, usuario_id: usuario.id }));
    setGuardando(false);
    if (err) return setError("No se pudo guardar la receta.");
    await cargarExtras();
    vibrar(20);
    avisar(receta.id ? "Receta actualizada" : "Receta guardada. Buscala al cargar una comida.");
    onListo();
  }

  async function borrar() {
    if (!confirmarBorrado) return setConfirmarBorrado(true);
    const { error: err } = await supabase.from("recetas_propias").delete().eq("id", receta.id);
    if (err) return setError("No se pudo borrar.");
    await cargarExtras();
    avisar("Receta borrada");
    onListo();
  }

  return (
    <div className="carga editor-receta">
      <label className="campo">
        <span>Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Budín de banana" maxLength={80} aria-label="Nombre de la receta" />
      </label>

      <div className="campos-dobles">
        <div className="campo">
          <span id="etiqueta-porciones">Porciones que rinde</span>
          <div className="gramos" role="group" aria-labelledby="etiqueta-porciones">
            <button onClick={() => setPorciones((n) => Math.max(1, n - 1))} aria-label="Una porción menos"><Minus size={17} /></button>
            <input type="number" min="1" max="100" inputMode="numeric" value={porciones} onChange={(e) => setPorciones(Math.max(1, Number(e.target.value) || 1))} aria-label="Porciones" />
            <button onClick={() => setPorciones((n) => Math.min(100, n + 1))} aria-label="Una porción más"><Plus size={17} /></button>
          </div>
        </div>
        <label className="campo">
          <span>Peso terminada (g, opcional)</span>
          <input type="number" min="0" inputMode="numeric" value={pesoFinal} onChange={(e) => setPesoFinal(e.target.value)} placeholder={total.gramos ? String(Math.round(total.gramos)) : "Ej: 800"} aria-label="Peso de la receta terminada" />
        </label>
      </div>

      <h3 className="titulo-lista">Ingredientes</h3>
      <div className="buscador-campo">
        <Search size={19} />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Agregar ingrediente" aria-label="Buscar ingrediente" autoComplete="off" />
        {texto && <button className="limpiar" onClick={() => setTexto("")} aria-label="Borrar búsqueda"><X size={17} /></button>}
      </div>
      {texto.trim() && <Resultados texto={texto} onElegir={agregar} propios={[]} />}

      <AnimatePresence initial={false}>
        {items.map((i) => (
          <FilaItem key={i.id} item={i} onCambiar={(n) => setItems((prev) => prev.map((x) => (x.id === i.id ? { ...n, id: i.id } : x)))} onQuitar={() => setItems((prev) => prev.filter((x) => x.id !== i.id))} />
        ))}
      </AnimatePresence>

      {items.length > 0 && (
        <div className="resumen-receta">
          <p><strong>Receta entera:</strong> {redondo(total.kcal)} kcal · {redondo(peso)} g</p>
          <p>
            <strong>Cada porción ({redondo(peso / Math.max(1, porciones))} g):</strong> {redondo(porcion("kcal"))} kcal · P {redondo(porcion("p"))} · C {redondo(porcion("c"))} · G {redondo(porcion("g"))}
          </p>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <div className="asistente-botones">
        {receta.id && (
          <button className={confirmarBorrado ? "boton boton-secundario peligro" : "boton boton-secundario"} onClick={borrar} onBlur={() => setConfirmarBorrado(false)} aria-label="Borrar receta">
            <Trash2 size={17} /> {confirmarBorrado ? "¿Seguro?" : ""}
          </button>
        )}
        <button className="boton boton-grande" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar receta"}</button>
      </div>
    </div>
  );
}
