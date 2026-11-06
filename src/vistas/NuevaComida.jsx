import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, LoaderCircle, Minus, PenLine, Plus, ScanBarcode, Search, Star, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo, buscarAlimentos, buscarCodigo } from "../lib/api.js";
import { comprimirImagen } from "../lib/imagen.js";
import { fechaLocal, tipoSegunHora } from "../lib/fechas.js";
import { macrosDeItem, sumarItems, TIPOS } from "../lib/macros.js";
import { conCantidad, conUnidad, prepararItem, restar, sumar, textoMedida, unidadesDe } from "../lib/unidades.js";
import { buscarTipicos } from "../data/alimentos-ar.js";
import { Hoja, Numero, vibrar } from "../componentes/Base.jsx";
import Escaner from "./Escaner.jsx";

const CAMPOS = [["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]];
const ORDEN_FUENTE = { argentina: 0, mundo: 1, usda: 2 };

export default function NuevaComida({ carga, onCerrar, onGuardar }) {
  const editando = carga?.comida;
  return (
    <Hoja abierta={!!carga} onCerrar={onCerrar} titulo={editando ? "Editar comida" : "Subir comida"} ancha>
      {carga && <Formulario key={editando?.id || "nueva"} carga={carga} onGuardar={onGuardar} />}
    </Hoja>
  );
}

function Formulario({ carga, onGuardar }) {
  const { usuario, yo, comidas, fotos, cargarComidas, extras } = useDatos();
  const original = carga.comida;

  const [tipo, setTipo] = useState(original?.tipo || carga.tipo || tipoSegunHora());
  const [descripcion, setDescripcion] = useState(original?.descripcion || carga.receta?.descripcion || "");
  const [items, setItems] = useState(() => {
    if (!original) return (carga.receta?.items || []).map((i) => ({ ...prepararItem(i), id: crypto.randomUUID() }));
    if (original.alimentos?.length) return original.alimentos.map((a) => ({ ...(a.por100 ? prepararItem(a) : a), id: a.id || crypto.randomUUID() }));
    return [{ id: "base", nombre: original.descripcion || "Comida", fuente: "manual", kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas }];
  });
  const [foto, setFoto] = useState(null);
  const [vistaFoto, setVistaFoto] = useState(original ? fotos[original.foto_path] : null);
  const [texto, setTexto] = useState("");
  const [panel, setPanel] = useState(null);
  const [ajuste, setAjuste] = useState(
    original?.macros_editados ? { kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas } : null,
  );
  const [privada, setPrivada] = useState(original?.privada ?? yo.comidas_privadas ?? false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const campo = useRef(null);

  const calculado = useMemo(() => sumarItems(items), [items]);
  const total = ajuste ? { kcal: Number(ajuste.kcal) || 0, p: Number(ajuste.p) || 0, c: Number(ajuste.c) || 0, g: Number(ajuste.g) || 0 } : calculado;

  const recientes = useMemo(() => {
    const vistos = new Map();
    for (const c of comidas) {
      if (c.usuario_id !== usuario.id) continue;
      for (const a of c.alimentos || []) if (a.por100 && !vistos.has(a.nombre)) vistos.set(a.nombre, a);
      if (vistos.size >= 5) break;
    }
    return [...vistos.values()].slice(0, 5);
  }, [comidas, usuario.id]);

  useEffect(() => () => { if (vistaFoto?.startsWith("blob:")) URL.revokeObjectURL(vistaFoto); }, [vistaFoto]);

  function agregar(alimento) {
    setItems((prev) => [...prev, { ...prepararItem(alimento), id: crypto.randomUUID() }]);
    setTexto("");
    setPanel(null);
    setError("");
    campo.current?.blur(); // Baja el teclado para ver lo agregado y elegir la medida.
    vibrar(8);
  }

  function usarFavorita(favorita) {
    setItems((prev) => [...prev, ...favorita.alimentos.map((a) => ({ ...(a.por100 ? prepararItem(a) : a), id: crypto.randomUUID() }))]);
    setDescripcion((d) => d || favorita.nombre);
    setError("");
    vibrar(8);
  }

  const cambiarItem = (id, nuevo) => setItems((prev) => prev.map((i) => (i.id === id ? nuevo : i)));

  async function elegirFoto(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    try {
      const blob = await comprimirImagen(archivo);
      setFoto(blob);
      setVistaFoto(URL.createObjectURL(blob));
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardar() {
    if (!items.length && !ajuste) return setError("Agregá al menos un alimento.");
    setError("");
    setGuardando(true);
    let rutaNueva = null;
    try {
      const id = original?.id || crypto.randomUUID();
      if (foto) {
        rutaNueva = `${usuario.id}/${id}-${Date.now()}.jpg`;
        const { error: errFoto } = await supabase.storage.from("fotos").upload(rutaNueva, foto, { contentType: "image/jpeg" });
        if (errFoto) throw errFoto;
      }
      const fila = {
        tipo,
        foto_path: rutaNueva || original?.foto_path || null,
        descripcion: descripcion.trim() || items.map((i) => i.nombre).join(", ").slice(0, 200) || null,
        calorias: Math.round(total.kcal),
        proteinas: Math.round(total.p * 10) / 10,
        carbohidratos: Math.round(total.c * 10) / 10,
        grasas: Math.round(total.g * 10) / 10,
        macros_editados: !!ajuste,
        ...(extras.disponible ? { privada } : {}),
        alimentos: items.map(({ indice, ...i }) => ({ ...i, ...(i.por100 ? macrosDeItem(i) : {}) })),
      };
      const { error: errFila } = original
        ? await supabase.from("comidas").update(fila).eq("id", id)
        : await supabase.from("comidas").insert({ ...fila, id, usuario_id: usuario.id, fecha: carga.fecha || fechaLocal() });
      if (errFila) throw errFila;
      if (rutaNueva && original?.foto_path) await supabase.storage.from("fotos").remove([original.foto_path]);
      await cargarComidas();
      if (!original && !privada) avisarGrupo("comida", id);
      onGuardar(!original);
    } catch (err) {
      if (rutaNueva) await supabase.storage.from("fotos").remove([rutaNueva]);
      setError(err.message || "No se pudo guardar");
      setGuardando(false);
    }
  }

  const buscando = texto.trim().length > 0;

  return (
    <div className="carga">
      {!buscando && (
        <div className="tipos" role="radiogroup" aria-label="Tipo de comida">
          {TIPOS.map((t) => (
            <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => setTipo(t.id)}>
              <span aria-hidden="true">{t.emoji}</span> {t.texto}
            </button>
          ))}
        </div>
      )}

      <div className="fila-busqueda">
        <div className="buscador-campo">
          <Search size={19} />
          <input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Qué comiste?" aria-label="Buscar alimento o producto" enterKeyHint="search" autoComplete="off" />
          {texto && <button className="limpiar" onClick={() => setTexto("")} aria-label="Borrar búsqueda"><X size={17} /></button>}
        </div>
        {!buscando && (
          <>
            <button className={panel === "codigo" ? "boton-icono activo" : "boton-icono"} onClick={() => setPanel(panel === "codigo" ? null : "codigo")} aria-label="Escanear código" aria-pressed={panel === "codigo"}><ScanBarcode size={20} /></button>
            <button className={panel === "mano" ? "boton-icono activo" : "boton-icono"} onClick={() => setPanel(panel === "mano" ? null : "mano")} aria-label="Cargar a mano" aria-pressed={panel === "mano"}><PenLine size={19} /></button>
          </>
        )}
      </div>

      {buscando ? (
        <Resultados texto={texto} onElegir={agregar} />
      ) : (
        <>
          {panel === "codigo" && <Escaner onAlimento={agregar} buscar={buscarCodigo} />}
          {panel === "mano" && <CargaManual onAgregar={agregar} />}

          <AnimatePresence initial={false}>
            {items.map((i) => (
              <FilaItem key={i.id} item={i} onCambiar={(n) => cambiarItem(i.id, n)} onQuitar={() => setItems((prev) => prev.filter((x) => x.id !== i.id))} />
            ))}
          </AnimatePresence>

          {!items.length && !panel && (extras.favoritas.length > 0 || recientes.length > 0) && (
            <ul className="resultados">
              {extras.favoritas.slice(0, 4).map((f) => (
                <li key={f.id}>
                  <button className="favorita-chip" onClick={() => usarFavorita(f)}>
                    <Star size={15} fill="currentColor" />
                    <span className="resultado-datos"><strong>{f.nombre}</strong></span>
                    <span className="resultado-mas" aria-hidden="true"><Plus size={18} /></span>
                  </button>
                </li>
              ))}
              {recientes.map((a) => <FilaResultado key={a.nombre} alimento={a} onElegir={agregar} />)}
            </ul>
          )}

          <div className="foto-y-nota">
            <label className={vistaFoto ? "miniatura con-foto" : "miniatura"}>
              <input type="file" accept="image/*" onChange={elegirFoto} aria-label="Foto de la comida" />
              {vistaFoto ? <img src={vistaFoto} alt="Foto de la comida" /> : <Camera size={24} />}
            </label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Agregá una foto o una nota" aria-label="Nota de la comida" maxLength={200} />
          </div>

          <details className="mas-opciones">
            <summary>Más opciones</summary>
            <div className="mas-opciones-cuerpo">
              <button className={ajuste ? "boton-chico activo" : "boton-chico"} onClick={() => setAjuste(ajuste ? null : { kcal: Math.round(calculado.kcal), p: Math.round(calculado.p), c: Math.round(calculado.c), g: Math.round(calculado.g) })}>
                {ajuste ? "Volver al cálculo" : "Ajustar totales"}
              </button>
              {ajuste && (
                <div className="ajuste-macros">
                  {CAMPOS.map(([k, nombre]) => (
                    <label key={k}>
                      <span>{nombre}</span>
                      <input type="number" min="0" inputMode="decimal" value={ajuste[k]} onChange={(e) => setAjuste({ ...ajuste, [k]: e.target.value })} />
                    </label>
                  ))}
                </div>
              )}
              {extras.disponible && (
                <label className="interruptor">
                  <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} />
                  <span>Solo para mí, no la ve el grupo</span>
                </label>
              )}
            </div>
          </details>

          <div className="pie-publicar">
            {error && <p className="error" role="alert">{error}</p>}
            <div className="pie-fila">
              <div className="pie-total">
                <strong><Numero valor={Math.round(total.kcal)} /> kcal</strong>
                <span>P {Math.round(total.p)} · C {Math.round(total.c)} · G {Math.round(total.g)}</span>
              </div>
              <button className="boton" onClick={guardar} disabled={guardando} aria-label={original ? "Guardar cambios" : "Publicar comida"}>
                {guardando ? "Guardando…" : original ? "Guardar" : "Publicar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilaItem({ item, onCambiar, onQuitar }) {
  const m = macrosDeItem(item);
  return (
    <motion.div className="fila-item" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
      <div className="fila-datos">
        <strong>{item.nombre}</strong>
        <span>{Math.round(m.kcal)} kcal · P {Math.round(m.p)} · C {Math.round(m.c)} · G {Math.round(m.g)}</span>
      </div>
      <button className="boton-icono chico" onClick={onQuitar} aria-label={`Quitar ${item.nombre}`}><Trash2 size={16} /></button>
      {item.por100 && (
        <div className="medida">
          <div className="gramos">
            <button onClick={() => onCambiar(conCantidad(item, restar(item)))} aria-label="Restar"><Minus size={17} /></button>
            <input type="number" min="0" step="any" inputMode="decimal" value={item.cantidad} onChange={(e) => onCambiar(conCantidad(item, Number(e.target.value)))} aria-label={`Cantidad de ${item.nombre}`} />
            <button onClick={() => onCambiar(conCantidad(item, sumar(item)))} aria-label="Sumar"><Plus size={17} /></button>
          </div>
          <select value={item.unidad.nombre} onChange={(e) => onCambiar(conUnidad(item, unidadesDe(item).find((u) => u.nombre === e.target.value)))} aria-label={`Medida de ${item.nombre}`}>
            {unidadesDe(item).map((u) => <option key={u.nombre} value={u.nombre}>{textoMedida(u)}</option>)}
          </select>
        </div>
      )}
    </motion.div>
  );
}

function FilaResultado({ alimento, onElegir }) {
  const inicial = prepararItem(alimento);
  const kcal = Math.round((alimento.por100.kcal * inicial.gramos) / 100);
  const medida = inicial.unidad.g === 1 ? `${inicial.cantidad} g` : `${inicial.cantidad} ${inicial.unidad.nombre}`;
  return (
    <li>
      <button onClick={() => onElegir(alimento)}>
        <span className="resultado-datos">
          <strong>{alimento.nombre}</strong>
          <span>{alimento.marca ? `${alimento.marca} · ` : ""}{medida} · {kcal} kcal</span>
        </span>
        <span className="resultado-mas" aria-hidden="true"><Plus size={18} /></span>
      </button>
    </li>
  );
}

function Resultados({ texto, onElegir }) {
  const locales = useMemo(() => buscarTipicos(texto), [texto]);
  const [productos, setProductos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [pedidos, setPedidos] = useState(false);
  const [falla, setFalla] = useState(false);
  const limpio = texto.trim();
  const automatico = locales.length === 0 && limpio.length >= 2;
  const conMarcas = pedidos || automatico;

  useEffect(() => {
    setProductos([]);
    setFalla(false);
    setPedidos(false);
  }, [limpio]);

  useEffect(() => {
    if (!conMarcas || limpio.length < 2) return setBuscando(false);
    const control = new AbortController();
    setBuscando(true);
    const espera = setTimeout(async () => {
      try {
        const { resultados } = await buscarAlimentos(limpio, control.signal);
        setProductos([...(resultados || [])].sort((a, b) => (ORDEN_FUENTE[a.fuente] ?? 3) - (ORDEN_FUENTE[b.fuente] ?? 3)).slice(0, 12));
      } catch (err) {
        if (err.name !== "AbortError") setFalla(true);
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, 400);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [conMarcas, limpio]);

  return (
    <div className="buscador">
      {locales.length > 0 && (
        <ul className="resultados">
          {locales.map((a) => <FilaResultado key={a.id} alimento={a} onElegir={onElegir} />)}
        </ul>
      )}

      {locales.length > 0 && !pedidos && limpio.length >= 2 && (
        <button className="boton boton-secundario" onClick={() => setPedidos(true)}>Buscar en productos de supermercado</button>
      )}

      {buscando && (
        <p className="buscando">
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}><LoaderCircle size={17} /></motion.span>
          Buscando productos…
        </p>
      )}

      {productos.length > 0 && (
        <ul className="resultados">
          {productos.map((a) => <FilaResultado key={a.id} alimento={a} onElegir={onElegir} />)}
        </ul>
      )}

      {falla && <p className="nota">No pudimos buscar productos. Probá de nuevo.</p>}
      {conMarcas && !buscando && !falla && !productos.length && locales.length === 0 && limpio.length >= 2 && (
        <p className="nota">Sin resultados. Probá con otra palabra o cargalo a mano.</p>
      )}
    </div>
  );
}

function CargaManual({ onAgregar }) {
  const [v, setV] = useState({ nombre: "", kcal: "", p: "", c: "", g: "" });

  function agregar(e) {
    e.preventDefault();
    onAgregar({
      nombre: v.nombre.trim() || "Comida",
      fuente: "manual",
      kcal: Number(v.kcal) || 0,
      p: Number(v.p) || 0,
      c: Number(v.c) || 0,
      g: Number(v.g) || 0,
    });
  }

  return (
    <form className="tarjeta-interna" onSubmit={agregar}>
      <input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} placeholder="Nombre (opcional)" aria-label="Nombre" />
      <div className="ajuste-macros">
        {CAMPOS.map(([k, nombre]) => (
          <label key={k}>
            <span>{nombre}</span>
            <input type="number" min="0" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={k === "kcal"} />
          </label>
        ))}
      </div>
      <button className="boton" type="submit">Agregar</button>
    </form>
  );
}
