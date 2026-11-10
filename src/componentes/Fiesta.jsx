import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, Minus, Plus, Search, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, haceDias, nombreDia } from "../lib/fechas.js";
import { BEBIDAS_BASE, buscarTragos, TAMANOS, TRAGOS_BASE, valoresDeMezcla, vasoDe } from "../data/tragos.js";
import { Resultados } from "../vistas/NuevaComida.jsx";
import { Hoja, vibrar } from "./Base.jsx";

// La noche sigue siendo la misma hasta las 6 de la mañana.
export function fechaDeLaNoche(d = new Date()) {
  return d.getHours() < 6 ? haceDias(1, d) : fechaLocal(d);
}
export const esDeNoche = (d = new Date()) => d.getHours() >= 20 || d.getHours() < 6;

const numero = (n) => Math.round(n).toLocaleString("es-AR");
const sumarVasos = (lista) => lista.reduce((t, v) => ({ kcal: t.kcal + v.kcal, p: t.p + v.p, c: t.c + v.c, g: t.g + v.g, alcohol: t.alcohol + (v.alcohol || 0) }), { kcal: 0, p: 0, c: 0, g: 0, alcohol: 0 });

export default function Fiesta({ abierta, onCerrar, avisar }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Modo fiesta" ancha>
      {abierta && <Contador avisar={avisar} />}
    </Hoja>
  );
}

function Contador({ avisar }) {
  const { usuario, comidas, cargarComidas } = useDatos();
  const fecha = useMemo(() => fechaDeLaNoche(), []);
  const existente = comidas.find((c) => c.usuario_id === usuario.id && c.tipo === "fiesta" && c.fecha === fecha);
  const [vasos, setVasos] = useState(() => existente?.alimentos || []);
  const [trago, setTrago] = useState(TRAGOS_BASE[1]);
  const [ml, setMl] = useState(TRAGOS_BASE[1].ml);
  const [texto, setTexto] = useState("");
  const [mezclando, setMezclando] = useState(false);
  const [mezcla, setMezcla] = useState([["Fernet", 30], ["Pomelo light", 70]]);
  const id = useRef(existente?.id || null);
  const cola = useRef(Promise.resolve());
  const totales = sumarVasos(vasos);
  const vaso = vasoDe(trago, ml);

  // Se guarda solo, de a un cambio por vez: la noche es una sola carga que se va actualizando.
  function guardar(lista) {
    cola.current = cola.current.then(async () => {
      const t = sumarVasos(lista);
      const fila = {
        descripcion: `Fiesta: ${lista.length} ${lista.length === 1 ? "vaso" : "vasos"}`,
        calorias: Math.round(t.kcal),
        proteinas: Math.round(t.p * 10) / 10,
        carbohidratos: Math.round(t.c * 10) / 10,
        grasas: Math.round(t.g * 10) / 10,
        alimentos: lista,
        macros_editados: false,
      };
      let error;
      if (id.current && !lista.length) {
        ({ error } = await supabase.from("comidas").delete().eq("id", id.current));
        if (!error) id.current = null;
      } else if (id.current) {
        ({ error } = await supabase.from("comidas").update(fila).eq("id", id.current));
      } else if (lista.length) {
        const nuevo = crypto.randomUUID();
        ({ error } = await supabase.from("comidas").insert({ ...fila, id: nuevo, usuario_id: usuario.id, tipo: "fiesta", fecha, privada: false }));
        if (!error) id.current = nuevo;
      }
      if (error) avisar("No se pudo guardar el vaso. Probá de nuevo.");
      await cargarComidas().catch(() => {});
    });
  }

  function sumar() {
    const lista = [...vasos, { ...vaso, id: crypto.randomUUID(), hora: new Date().toISOString() }];
    setVasos(lista);
    guardar(lista);
    vibrar(18);
  }

  function quitar(nombre, cuanto) {
    const i = vasos.map((v, n) => [v, n]).reverse().find(([v]) => v.nombre === nombre && v.ml === cuanto)?.[1];
    if (i === undefined) return;
    const lista = vasos.filter((_, n) => n !== i);
    setVasos(lista);
    guardar(lista);
    vibrar(8);
  }

  function elegir(nuevo) {
    setTrago(nuevo);
    setMl(nuevo.ml || 300);
    setTexto("");
    setMezclando(false);
  }

  // Cualquier bebida de la base de alimentos: los valores cada 100 g se toman como cada 100 ml.
  function elegirProducto(alimento) {
    if (!alimento.por100) return;
    elegir({ nombre: alimento.marca ? `${alimento.nombre} (${alimento.marca})` : alimento.nombre, mezcla: null, ml: 300, por100: { ...alimento.por100, alcohol: 0 } });
  }

  function usarMezcla() {
    const partes = mezcla.filter(([, parte]) => parte > 0);
    if (!partes.length) return;
    const nombre = partes.map(([b]) => b).join(" con ");
    elegir({ nombre, mezcla: partes, ml: 300, por100: valoresDeMezcla(partes) });
  }

  const grupos = Object.values(
    vasos.reduce((t, v) => {
      const clave = `${v.nombre}|${v.ml}`;
      t[clave] = t[clave] ? { ...t[clave], cuantos: t[clave].cuantos + 1, kcal: t[clave].kcal + v.kcal } : { nombre: v.nombre, ml: v.ml, cuantos: 1, kcal: v.kcal };
      return t;
    }, {}),
  );
  const encontrados = buscarTragos(texto);

  return (
    <div className="carga fiesta">
      <div className="fiesta-noche">
        <span>{fecha === fechaLocal() ? "Esta noche" : fecha === haceDias(1) ? "Anoche" : `Noche del ${nombreDia(fecha).toLowerCase()}`}</span>
        <strong>{vasos.length} {vasos.length === 1 ? "vaso" : "vasos"}</strong>
        <small>{numero(totales.kcal)} kcal · C {numero(totales.c)} g · {numero(totales.alcohol)} g de alcohol</small>
      </div>

      <motion.button className="boton boton-grande sumar-vaso" whileTap={{ scale: 0.95 }} onClick={sumar}>
        <Plus size={20} /> 1 {trago.nombre}
        <small>{ml} ml · {numero(vaso.kcal)} kcal{vaso.alcohol ? ` · ${numero(vaso.alcohol)} g de alcohol` : ""}</small>
      </motion.button>

      <div className="campo">
        <span id="etiqueta-tamano">Tamaño</span>
        <div className="tamanos" role="radiogroup" aria-labelledby="etiqueta-tamano">
          {TAMANOS.map(([nombre, cuanto]) => (
            <button key={nombre} role="radio" aria-checked={ml === cuanto} className={ml === cuanto ? "activo" : ""} onClick={() => setMl(cuanto)}>
              {nombre}<small>{cuanto} ml</small>
            </button>
          ))}
          <label className="tamano-libre">
            <input type="number" min="1" max="2000" inputMode="numeric" value={ml} onChange={(e) => setMl(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))} aria-label="Mililitros" />
            ml
          </label>
        </div>
      </div>


      <h3 className="titulo-lista">Cambiar de trago</h3>
      <div className="buscador-campo">
        <Search size={19} />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscá un trago o una bebida" aria-label="Buscar trago" autoComplete="off" />
        {texto && <button className="limpiar" onClick={() => setTexto("")} aria-label="Borrar búsqueda"><X size={17} /></button>}
      </div>

      {texto.trim() ? (
        <>
          {encontrados.length > 0 && (
            <ul className="resultados">
              {encontrados.map((t) => (
                <li key={t.id}>
                  <button onClick={() => elegir(t)}>
                    <span className="resultado-datos">
                      <strong>{t.nombre}</strong>
                      <span>{t.ml} ml · {numero(vasoDe(t, t.ml).kcal)} kcal</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="titulo-lista">Otras bebidas</h3>
          <Resultados texto={texto} onElegir={elegirProducto} propios={[]} />
        </>
      ) : (
        <div className="tragos-rapidos" role="radiogroup" aria-label="Tragos">
          {TRAGOS_BASE.slice(0, 12).map((t) => (
            <button key={t.id} role="radio" aria-checked={trago.nombre === t.nombre} className={trago.nombre === t.nombre ? "activo" : ""} onClick={() => elegir(t)}>{t.nombre}</button>
          ))}
          <button className={mezclando ? "activo" : ""} onClick={() => setMezclando(!mezclando)} aria-expanded={mezclando}><FlaskConical size={14} /> Armá tu mezcla</button>
        </div>
      )}

      <AnimatePresence>
        {mezclando && !texto.trim() && (
          <motion.div className="tarjeta-interna mezcla" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {mezcla.map(([bebida, parte], i) => (
              <div key={i} className="mezcla-fila">
                <select value={bebida} onChange={(e) => setMezcla(mezcla.map((m, n) => (n === i ? [e.target.value, m[1]] : m)))} aria-label={`Bebida ${i + 1}`}>
                  {BEBIDAS_BASE.map((b) => <option key={b.nombre} value={b.nombre}>{b.nombre}</option>)}
                </select>
                <label className="mezcla-parte">
                  <input type="number" min="0" max="100" inputMode="numeric" value={parte} onChange={(e) => setMezcla(mezcla.map((m, n) => (n === i ? [m[0], Number(e.target.value) || 0] : m)))} aria-label={`Porcentaje de la bebida ${i + 1}`} />
                  %
                </label>
                {mezcla.length > 1 && <button className="boton-icono chico" onClick={() => setMezcla(mezcla.filter((_, n) => n !== i))} aria-label={`Quitar bebida ${i + 1}`}><X size={15} /></button>}
              </div>
            ))}
            <div className="mezcla-botones">
              {mezcla.length < 4 && <button className="boton-chico" onClick={() => setMezcla([...mezcla, ["Soda", 10]])}><Plus size={14} /> Otra bebida</button>}
              <button className="boton-chico activo" onClick={usarMezcla}>Usar esta mezcla</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {grupos.length > 0 && (
        <ul className="vasos-noche">
          {grupos.map((g) => (
            <li key={`${g.nombre}|${g.ml}`}>
              <span><strong>{g.cuantos} × {g.nombre}</strong><small>{g.ml} ml · {numero(g.kcal)} kcal</small></span>
              <button className="boton-icono chico" onClick={() => quitar(g.nombre, g.ml)} aria-label={`Quitar un ${g.nombre}`}><Minus size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="nota">Se guarda solo y suma al total del día. Después de medianoche cuenta para la noche que empezó.</p>
    </div>
  );
}
