import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImagePlus, LoaderCircle, Minus, PenLine, Plus, ScanBarcode, Search, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo, buscarAlimentos, buscarCodigo } from "../lib/api.js";
import { comprimirImagen } from "../lib/imagen.js";
import { fechaLocal, tipoSegunHora } from "../lib/fechas.js";
import { macrosDeItem, sumarItems, TIPOS } from "../lib/macros.js";
import { buscarTipicos } from "../data/alimentos-ar.js";
import { BarraMacros, Hoja, Numero } from "../componentes/Base.jsx";
import Escaner from "./Escaner.jsx";

const FUENTES = {
  tipico: "Típico",
  argentina: "Argentina",
  mundo: "Mundial",
  usda: "USDA",
  manual: "A mano",
};

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
  const [modo, setModo] = useState(null);
  const [ajuste, setAjuste] = useState(
    original?.macros_editados
      ? { kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas }
      : null,
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
      if (vistos.size >= 6) break;
    }
    return [...vistos.values()].slice(0, 6);
  }, [comidas, usuario.id]);

  useEffect(() => () => { if (vistaFoto?.startsWith("blob:")) URL.revokeObjectURL(vistaFoto); }, [vistaFoto]);

  function agregar(alimento) {
    const gramos = alimento.gramos || alimento.porcion?.g || 100;
    setItems((prev) => [...prev, { ...alimento, id: crypto.randomUUID(), gramos }]);
    setModo(null);
    setError("");
  }

  function usarFavorita(favorita) {
    setItems((prev) => [...prev, ...favorita.alimentos.map((a) => ({ ...a, id: crypto.randomUUID() }))]);
    setDescripcion((d) => d || favorita.nombre);
    setError("");
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
    <div className="formulario">
      <div className="tipos" role="radiogroup" aria-label="Tipo de comida">
        {TIPOS.map((t) => (
          <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => setTipo(t.id)}>
            <span aria-hidden="true">{t.emoji}</span> {t.texto}
          </button>
        ))}
      </div>

      <label className={vistaFoto ? "zona-foto con-foto" : "zona-foto"}>
        <input type="file" accept="image/*" onChange={elegirFoto} aria-label="Foto de la comida" />
        {vistaFoto ? (
          <>
            <img src={vistaFoto} alt="Foto de la comida" />
            <span className="cambiar-foto"><Camera size={15} /> Cambiar</span>
          </>
        ) : (
          <span className="zona-foto-vacia">
            <ImagePlus size={30} />
            <strong>Sacá o elegí una foto</strong>
            <small>Es lo que van a ver tus amigos en el muro</small>
          </span>
        )}
      </label>

      <label className="campo">
        <span>Qué comiste</span>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej.: Milanesa con puré" maxLength={200} />
      </label>

      <section className="alimentos">
        <div className="alimentos-titulo">
          <h3>Alimentos</h3>
          <div>
            <button className={modo === "codigo" ? "boton-chico activo" : "boton-chico"} onClick={() => setModo(modo === "codigo" ? null : "codigo")}>
              <ScanBarcode size={16} /> Código
            </button>
            <button className={modo === "manual" ? "boton-chico activo" : "boton-chico"} onClick={() => setModo(modo === "manual" ? null : "manual")}>
              <PenLine size={16} /> A mano
            </button>
          </div>
        </div>

        {modo === "codigo" && <Escaner onAlimento={agregar} buscar={buscarCodigo} />}
        {modo === "manual" && <CargaManual onAgregar={agregar} />}
        {extras.favoritas.length > 0 && (
          <div className="recientes">
            {extras.favoritas.slice(0, 8).map((f) => (
              <button key={f.id} className="boton-chico favorita-chip" onClick={() => usarFavorita(f)}>
                <Star size={13} fill="currentColor" /> {f.nombre}
              </button>
            ))}
          </div>
        )}
        <Buscador onElegir={agregar} recientes={recientes} />

        <AnimatePresence initial={false}>
          {items.map((i) => (
            <FilaItem key={i.id} item={i} onGramos={(g) => cambiarGramos(i.id, g)} onQuitar={() => setItems((prev) => prev.filter((x) => x.id !== i.id))} />
          ))}
        </AnimatePresence>
      </section>

      <section className="tarjeta total">
        <div className="total-cabecera">
          <div>
            <span>Total</span>
            <strong><Numero valor={Math.round(total.kcal)} /> kcal</strong>
          </div>
          <button className={ajuste ? "boton-chico activo" : "boton-chico"} onClick={() => setAjuste(ajuste ? null : { kcal: Math.round(calculado.kcal), p: Math.round(calculado.p), c: Math.round(calculado.c), g: Math.round(calculado.g) })}>
            <SlidersHorizontal size={15} /> {ajuste ? "Volver al cálculo" : "Ajustar"}
          </button>
        </div>
        <BarraMacros total={total} />
        {ajuste && (
          <div className="ajuste-macros">
            {[["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]].map(([k, texto]) => (
              <label key={k}>
                <span>{texto}</span>
                <input type="number" min="0" inputMode="decimal" value={ajuste[k]} onChange={(e) => setAjuste({ ...ajuste, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        )}
      </section>

      {extras.disponible && (
        <label className="interruptor">
          <input type="checkbox" checked={privada} onChange={(e) => setPrivada(e.target.checked)} />
          <span>Solo para mí, no la ve el grupo</span>
        </label>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton boton-grande" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando…" : original ? "Guardar cambios" : "Publicar comida"}
      </button>
    </div>
  );
}

function FilaItem({ item, onGramos, onQuitar }) {
  const m = macrosDeItem(item);
  return (
    <motion.div className="fila-item" layout initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }}>
      <div className="fila-datos">
        <strong>{item.nombre}</strong>
        <span>{[item.marca, `${Math.round(m.kcal)} kcal`, `P ${Math.round(m.p)} · C ${Math.round(m.c)} · G ${Math.round(m.g)}`].filter(Boolean).join(" · ")}</span>
      </div>
      {item.por100 && (
        <div className="gramos">
          <button onClick={() => onGramos((Number(item.gramos) || 0) - 10)} aria-label="Restar 10 gramos"><Minus size={14} /></button>
          <label>
            <input type="number" min="0" inputMode="numeric" value={item.gramos} onChange={(e) => onGramos(Number(e.target.value))} aria-label={`Gramos de ${item.nombre}`} />
            <span>g</span>
          </label>
          <button onClick={() => onGramos((Number(item.gramos) || 0) + 10)} aria-label="Sumar 10 gramos"><Plus size={14} /></button>
        </div>
      )}
      <button className="boton-icono chico" onClick={onQuitar} aria-label={`Quitar ${item.nombre}`}><Trash2 size={16} /></button>
    </motion.div>
  );
}

function Buscador({ onElegir, recientes }) {
  const [texto, setTexto] = useState("");
  const [remotos, setRemotos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [falla, setFalla] = useState("");
  const pedido = useRef(null);

  const tipicos = useMemo(() => buscarTipicos(texto), [texto]);

  useEffect(() => {
    const limpio = texto.trim();
    pedido.current?.abort();
    setRemotos([]);
    setFalla("");
    if (limpio.length < 2) return setBuscando(false);

    const control = new AbortController();
    pedido.current = control;
    setBuscando(true);
    const espera = setTimeout(async () => {
      try {
        const { resultados, parcial } = await buscarAlimentos(limpio, control.signal);
        setRemotos(resultados);
        if (parcial) setFalla("Una de las bases no respondió: puede que falten resultados.");
      } catch (err) {
        if (err.name !== "AbortError") setFalla("No pudimos consultar las bases de productos. Probá de nuevo.");
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, 350);

    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  const resultados = [...tipicos, ...remotos];
  const elegir = (a) => {
    onElegir(a);
    setTexto("");
  };

  return (
    <div className="buscador">
      <div className="buscador-campo">
        <Search size={18} />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscá: milanesa, Oreo, yerba, Coto…"
          aria-label="Buscar alimento o producto"
        />
        {buscando && (
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}>
            <LoaderCircle size={18} />
          </motion.span>
        )}
      </div>

      {!texto && recientes.length > 0 && (
        <div className="recientes">
          {recientes.map((a) => (
            <button key={a.nombre} className="boton-chico" onClick={() => elegir(a)}>
              <Plus size={13} /> {a.nombre}
            </button>
          ))}
        </div>
      )}

      {falla && <p className="nota">{falla}</p>}

      {resultados.length > 0 && (
        <ul className="resultados">
          {resultados.map((a) => (
            <li key={a.id}>
              <button onClick={() => elegir(a)}>
                <span className="resultado-datos">
                  <strong>{a.nombre}</strong>
                  <span>{a.marca ? `${a.marca} · ` : ""}{a.por100.kcal} kcal cada 100 g · P {Math.round(a.por100.p)} · C {Math.round(a.por100.c)} · G {Math.round(a.por100.g)}</span>
                </span>
                <span className={`fuente f-${a.fuente}`}>{FUENTES[a.fuente]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {texto.trim().length >= 2 && !buscando && resultados.length === 0 && !falla && (
        <p className="nota">No encontramos «{texto.trim()}». Cargalo a mano o probá con otro nombre.</p>
      )}
    </div>
  );
}

function CargaManual({ onAgregar }) {
  const [v, setV] = useState({ nombre: "", kcal: "", p: "", c: "", g: "" });

  function agregar(e) {
    e.preventDefault();
    onAgregar({
      nombre: v.nombre.trim(),
      fuente: "manual",
      kcal: Number(v.kcal) || 0,
      p: Number(v.p) || 0,
      c: Number(v.c) || 0,
      g: Number(v.g) || 0,
    });
  }

  return (
    <motion.form className="tarjeta-interna" onSubmit={agregar} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
      <label className="campo">
        <span>Nombre</span>
        <input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} required />
      </label>
      <div className="ajuste-macros">
        {[["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]].map(([k, texto]) => (
          <label key={k}>
            <span>{texto}</span>
            <input type="number" min="0" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={k === "kcal"} />
          </label>
        ))}
      </div>
      <button className="boton" type="submit">Agregar</button>
    </motion.form>
  );
}
