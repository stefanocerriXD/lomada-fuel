import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, LoaderCircle, Minus, Plus, Search, Star, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo, buscarAlimentos, buscarCodigo } from "../lib/api.js";
import { comprimirImagen } from "../lib/imagen.js";
import { fechaLocal, tipoSegunHora } from "../lib/fechas.js";
import { macrosDeItem, sumarItems, TIPOS } from "../lib/macros.js";
import { buscarTipicos } from "../data/alimentos-ar.js";
import { Hoja, Numero, vibrar } from "../componentes/Base.jsx";
import Escaner from "./Escaner.jsx";

const RESULTADOS_INICIALES = 6;
const PESTANAS = [["buscar", "Buscar"], ["mano", "A mano"], ["codigo", "Código"]];
const CAMPOS = [["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]];

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
    if (!original) return (carga.receta?.items || []).map((i) => ({ ...i, id: crypto.randomUUID() }));
    if (original.alimentos?.length) return original.alimentos.map((a) => ({ ...a, id: a.id || crypto.randomUUID() }));
    return [{ id: "base", nombre: original.descripcion || "Comida", fuente: "manual", kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas }];
  });
  const [foto, setFoto] = useState(null);
  const [vistaFoto, setVistaFoto] = useState(original ? fotos[original.foto_path] : null);
  const [pestana, setPestana] = useState("buscar");
  const [ajuste, setAjuste] = useState(
    original?.macros_editados ? { kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas } : null,
  );
  const [privada, setPrivada] = useState(original?.privada ?? yo.comidas_privadas ?? false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

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
    const gramos = alimento.gramos || alimento.porcion?.g || 100;
    setItems((prev) => [...prev, { ...alimento, id: crypto.randomUUID(), gramos }]);
    setError("");
    vibrar(8);
  }

  function usarFavorita(favorita) {
    setItems((prev) => [...prev, ...favorita.alimentos.map((a) => ({ ...a, id: crypto.randomUUID() }))]);
    setDescripcion((d) => d || favorita.nombre);
    setError("");
    vibrar(8);
  }

  function cambiarGramos(id, gramos) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, gramos: Math.max(0, gramos) } : i)));
  }

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

  return (
    <div className="carga">
      <div className="tipos" role="radiogroup" aria-label="Tipo de comida">
        {TIPOS.map((t) => (
          <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => setTipo(t.id)}>
            <span aria-hidden="true">{t.emoji}</span> {t.texto}
          </button>
        ))}
      </div>

      <div className="foto-y-nota">
        <label className={vistaFoto ? "miniatura con-foto" : "miniatura"}>
          <input type="file" accept="image/*" onChange={elegirFoto} aria-label="Foto de la comida" />
          {vistaFoto ? <img src={vistaFoto} alt="Foto de la comida" /> : <Camera size={24} />}
        </label>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Qué comiste (opcional)" aria-label="Qué comiste" maxLength={200} />
      </div>

      <AnimatePresence initial={false}>
        {items.map((i) => (
          <FilaItem key={i.id} item={i} onGramos={(g) => cambiarGramos(i.id, g)} onQuitar={() => setItems((prev) => prev.filter((x) => x.id !== i.id))} />
        ))}
      </AnimatePresence>

      <div className="selector tres" role="tablist" aria-label="Cómo agregar">
        {PESTANAS.map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={pestana === id} className={pestana === id ? "activo" : ""} onClick={() => setPestana(id)}>
            {pestana === id && <motion.span className="selector-fondo" layoutId="selector-carga" />}
            <span>{texto}</span>
          </button>
        ))}
      </div>

      {pestana === "buscar" && <Buscador onElegir={agregar} favoritas={extras.favoritas} usarFavorita={usarFavorita} recientes={recientes} />}
      {pestana === "mano" && <CargaManual onAgregar={agregar} />}
      {pestana === "codigo" && <Escaner onAlimento={(a) => { agregar(a); setPestana("buscar"); }} buscar={buscarCodigo} />}

      <details className="mas-opciones">
        <summary>Más opciones</summary>
        <div className="mas-opciones-cuerpo">
          <button className={ajuste ? "boton-chico activo" : "boton-chico"} onClick={() => setAjuste(ajuste ? null : { kcal: Math.round(calculado.kcal), p: Math.round(calculado.p), c: Math.round(calculado.c), g: Math.round(calculado.g) })}>
            {ajuste ? "Volver al cálculo" : "Ajustar totales"}
          </button>
          {ajuste && (
            <div className="ajuste-macros">
              {CAMPOS.map(([k, texto]) => (
                <label key={k}>
                  <span>{texto}</span>
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
    </div>
  );
}

function FilaItem({ item, onGramos, onQuitar }) {
  const m = macrosDeItem(item);
  const paso = item.porcion?.g || 25;
  return (
    <motion.div className="fila-item" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
      <div className="fila-datos">
        <strong>{item.nombre}</strong>
        <span>{Math.round(m.kcal)} kcal · P {Math.round(m.p)} · C {Math.round(m.c)} · G {Math.round(m.g)}</span>
      </div>
      <button className="boton-icono chico" onClick={onQuitar} aria-label={`Quitar ${item.nombre}`}><Trash2 size={16} /></button>
      {item.por100 && (
        <div className="gramos">
          <button onClick={() => onGramos((Number(item.gramos) || 0) - paso)} aria-label="Restar porción"><Minus size={16} /></button>
          <label>
            <input type="number" min="0" inputMode="numeric" value={item.gramos} onChange={(e) => onGramos(Number(e.target.value))} aria-label={`Gramos de ${item.nombre}`} />
            <span>g</span>
          </label>
          <button onClick={() => onGramos((Number(item.gramos) || 0) + paso)} aria-label="Sumar porción"><Plus size={16} /></button>
        </div>
      )}
    </motion.div>
  );
}

function FilaResultado({ alimento, onElegir }) {
  const gramos = alimento.gramos || alimento.porcion?.g || 100;
  const kcal = Math.round((alimento.por100.kcal * gramos) / 100);
  const porcion = alimento.porcion?.nombre || `${gramos} g`;
  return (
    <li>
      <button onClick={() => onElegir(alimento)}>
        <span className="resultado-datos">
          <strong>{alimento.nombre}{alimento.marca ? ` · ${alimento.marca}` : ""}</strong>
          <span>{kcal} kcal · {porcion}</span>
        </span>
        <span className="resultado-mas" aria-hidden="true"><Plus size={18} /></span>
      </button>
    </li>
  );
}

function Buscador({ onElegir, favoritas, usarFavorita, recientes }) {
  const [texto, setTexto] = useState("");
  const [remotos, setRemotos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [falla, setFalla] = useState("");
  const [todos, setTodos] = useState(false);
  const campo = useRef(null);

  const tipicos = useMemo(() => buscarTipicos(texto), [texto]);

  useEffect(() => {
    const limpio = texto.trim();
    setRemotos([]);
    setFalla("");
    setTodos(false);
    if (limpio.length < 2) return setBuscando(false);

    const control = new AbortController();
    setBuscando(true);
    const espera = setTimeout(async () => {
      try {
        const { resultados } = await buscarAlimentos(limpio, control.signal);
        setRemotos(resultados || []);
      } catch (err) {
        if (err.name !== "AbortError") setFalla("No pudimos buscar productos. Probá de nuevo.");
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, 400);

    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  const resultados = [...tipicos, ...remotos];
  const visibles = todos ? resultados : resultados.slice(0, RESULTADOS_INICIALES);
  const elegir = (a) => {
    onElegir(a);
    setTexto("");
    campo.current?.focus();
  };

  return (
    <div className="buscador">
      <div className="buscador-campo">
        <Search size={18} />
        <input ref={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Milanesa, yogur, Oreo…" aria-label="Buscar alimento o producto" enterKeyHint="search" />
        {buscando && (
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}>
            <LoaderCircle size={18} />
          </motion.span>
        )}
        {texto && !buscando && (
          <button className="limpiar" onClick={() => setTexto("")} aria-label="Borrar búsqueda"><X size={16} /></button>
        )}
      </div>

      {!texto && (favoritas.length > 0 || recientes.length > 0) && (
        <ul className="resultados">
          {favoritas.slice(0, 4).map((f) => (
            <li key={f.id}>
              <button className="favorita-chip" onClick={() => usarFavorita(f)}>
                <Star size={15} fill="currentColor" />
                <span className="resultado-datos"><strong>{f.nombre}</strong></span>
                <span className="resultado-mas" aria-hidden="true"><Plus size={18} /></span>
              </button>
            </li>
          ))}
          {recientes.map((a) => <FilaResultado key={a.nombre} alimento={a} onElegir={elegir} />)}
        </ul>
      )}

      {falla && <p className="nota">{falla}</p>}

      {visibles.length > 0 && (
        <ul className="resultados">
          {visibles.map((a) => <FilaResultado key={a.id} alimento={a} onElegir={elegir} />)}
        </ul>
      )}
      {!todos && resultados.length > RESULTADOS_INICIALES && (
        <button className="boton-texto centrado" onClick={() => setTodos(true)}>Ver {resultados.length - RESULTADOS_INICIALES} más</button>
      )}

      {texto.trim().length >= 2 && !buscando && resultados.length === 0 && !falla && (
        <p className="nota">Sin resultados. Probá en "A mano" o por código.</p>
      )}
    </div>
  );
}

function CargaManual({ onAgregar }) {
  const VACIO = { nombre: "", kcal: "", p: "", c: "", g: "" };
  const [v, setV] = useState(VACIO);

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
    setV(VACIO);
  }

  return (
    <form className="tarjeta-interna" onSubmit={agregar}>
      <input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} placeholder="Nombre (opcional)" aria-label="Nombre" />
      <div className="ajuste-macros">
        {CAMPOS.map(([k, texto]) => (
          <label key={k}>
            <span>{texto}</span>
            <input type="number" min="0" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={k === "kcal"} />
          </label>
        ))}
      </div>
      <button className="boton" type="submit">Agregar</button>
    </form>
  );
}
