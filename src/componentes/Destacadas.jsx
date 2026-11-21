import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, ImagePlus, Lock, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { comprimirImagen } from "../lib/imagen.js";
import { Avatar, Hoja, vibrar } from "./Base.jsx";

// Destacadas del perfil, como en Instagram: colecciones de fotos (gym, cambio físico, platos) que se ven a pantalla completa.
// Las ve el grupo, salvo las "solo yo" (SQL 063). Las de cambio físico arrancan como "solo yo".
const SUGERIDAS = ["Gym", "Cambio físico", "Mis platos", "Viajes", "Entrenos"];
const MAX_FOTOS = 30;
const SEGUNDOS = 5;
const esCambioFisico = (nombre) => /cambio|antes|despu[eé]s|f[ií]sico/i.test(nombre);

export default function Destacadas({ perfil, propio, fotosComidas, avisar }) {
  const { fotos, firmarRutas } = useDatos();
  const [lista, setLista] = useState(null);
  const [viendo, setViendo] = useState(null);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("destacadas").select("*").eq("usuario_id", perfil.id).order("orden").order("creado_en");
    // Sin el SQL 063 no hay destacadas.
    if (error) return setLista(undefined);
    const ids = data.map((d) => d.id);
    const { data: items } = ids.length ? await supabase.from("destacadas_fotos").select("*").in("destacada_id", ids).order("orden").order("creado_en") : { data: [] };
    await firmarRutas((items || []).map((f) => f.foto_path));
    setLista(data.map((d) => ({ ...d, fotos: (items || []).filter((f) => f.destacada_id === d.id) })));
  }, [perfil.id, firmarRutas]);

  useEffect(() => { cargar(); }, [cargar]);

  if (lista === undefined || lista === null) return null;
  const visibles = lista.filter((d) => d.fotos.length || propio);
  if (!visibles.length && !propio) return null;

  return (
    <>
      <ul className="destacadas" aria-label="Destacadas">
        {propio && (
          <li>
            <button className="destacada nueva" onClick={() => { vibrar(8); setEditando({}); }} aria-label="Nueva destacada">
              <span className="destacada-circulo"><Plus size={26} /></span>
              <span className="destacada-nombre">Nueva</span>
            </button>
          </li>
        )}
        {visibles.map((d) => {
          const portada = d.fotos[0] && fotos[d.fotos[0].foto_path];
          return (
            <li key={d.id}>
              <button className="destacada" onClick={() => { vibrar(6); d.fotos.length ? setViendo(d) : setEditando(d); }} aria-label={`Destacada ${d.nombre}${d.privada ? ", solo vos" : ""}`}>
                <span className="destacada-circulo">
                  {portada ? <img src={portada} alt="" loading="lazy" /> : <Camera size={22} />}
                  {d.privada && <span className="destacada-candado" aria-hidden="true"><Lock size={11} /></span>}
                </span>
                <span className="destacada-nombre">{d.nombre}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <AnimatePresence>
        {viendo && (
          <VisorDestacada
            destacada={viendo}
            perfil={perfil}
            propio={propio}
            onCerrar={() => setViendo(null)}
            onEditar={() => { setEditando(viendo); setViendo(null); }}
          />
        )}
      </AnimatePresence>
      {propio && (
        <Hoja abierta={!!editando} onCerrar={() => setEditando(null)} titulo={editando?.id ? "Editar destacada" : "Nueva destacada"}>
          {editando && (
            <EditorDestacada
              key={editando.id || "nueva"}
              destacada={editando}
              cantidad={lista.length}
              fotosComidas={fotosComidas}
              avisar={avisar}
              onListo={async (texto) => { setEditando(null); await cargar(); if (texto) avisar?.(texto); }}
            />
          )}
        </Hoja>
      )}
    </>
  );
}

// Pantalla completa, como las historias: avanza sola, tocando a la derecha o a la izquierda se pasa o se vuelve.
function VisorDestacada({ destacada, perfil, propio, onCerrar, onEditar }) {
  const { fotos } = useDatos();
  const [indice, setIndice] = useState(0);
  const [pausa, setPausa] = useState(false);
  const total = destacada.fotos.length;
  const actual = destacada.fotos[indice];

  const pasar = useCallback((sentido) => {
    setIndice((i) => {
      const n = i + sentido;
      if (n >= total) { onCerrar(); return i; }
      return Math.max(0, n);
    });
  }, [total, onCerrar]);

  useEffect(() => {
    if (pausa) return undefined;
    const t = setTimeout(() => pasar(1), SEGUNDOS * 1000);
    return () => clearTimeout(t);
  }, [indice, pausa, pasar]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") pasar(1);
      if (e.key === "ArrowLeft") pasar(-1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar, pasar]);

  return createPortal(
    <motion.div className="visor-destacada" role="dialog" aria-label={`Destacada ${destacada.nombre}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
      <div className="visor-destacada-barras" aria-hidden="true">
        {destacada.fotos.map((f, i) => (
          <span key={f.id}>
            <span className={i < indice ? "llena" : i === indice ? (pausa ? "corriendo pausada" : "corriendo") : ""} style={i === indice ? { animationDuration: `${SEGUNDOS}s` } : undefined} key={i === indice ? `a${indice}` : undefined} />
          </span>
        ))}
      </div>
      <header className="visor-destacada-cabecera">
        <Avatar perfil={perfil} tam={32} />
        <strong>{destacada.nombre}</strong>
        {destacada.privada && <span className="visor-destacada-privada"><Lock size={12} /> Solo vos</span>}
        <span className="visor-destacada-acciones">
          {propio && <button className="boton-icono" onClick={onEditar} aria-label="Editar destacada"><Pencil size={18} /></button>}
          <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><X size={22} /></button>
        </span>
      </header>
      {actual && fotos[actual.foto_path] && <img key={actual.id} className="visor-destacada-foto" src={fotos[actual.foto_path]} alt={actual.texto || destacada.nombre} />}
      {actual?.texto && <p className="visor-destacada-texto">{actual.texto}</p>}
      <button className="visor-destacada-zona anterior" onClick={() => pasar(-1)} onPointerDown={() => setPausa(true)} onPointerUp={() => setPausa(false)} onPointerLeave={() => setPausa(false)} aria-label="Foto anterior" />
      <button className="visor-destacada-zona siguiente" onClick={() => pasar(1)} onPointerDown={() => setPausa(true)} onPointerUp={() => setPausa(false)} onPointerLeave={() => setPausa(false)} aria-label="Foto siguiente" />
    </motion.div>,
    document.body,
  );
}

function EditorDestacada({ destacada, cantidad, fotosComidas, avisar, onListo }) {
  const { usuario, fotos } = useDatos();
  const nueva = !destacada.id;
  const [nombre, setNombre] = useState(destacada.nombre || "");
  const [privada, setPrivada] = useState(destacada.privada ?? false);
  const tocoPrivada = useRef(!nueva);
  // Las fotos: las que ya estaban (con id), las nuevas subidas (blob) y las tomadas de una comida (ruta).
  const [items, setItems] = useState(() => (destacada.fotos || []).map((f) => ({ clave: f.id, id: f.id, ruta: f.foto_path, vista: fotos[f.foto_path], texto: f.texto || "" })));
  const [deComidas, setDeComidas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [borrar, setBorrar] = useState(false);
  useEffect(() => () => items.forEach((x) => x.blob && URL.revokeObjectURL(x.vista)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Al elegir un nombre de cambio físico, pasa a "solo yo" (si no lo cambiaste a mano).
  function ponerNombre(n) {
    setNombre(n);
    if (!tocoPrivada.current) setPrivada(esCambioFisico(n));
  }

  async function sumarArchivos(e) {
    const archivos = [...e.target.files].slice(0, MAX_FOTOS - items.length);
    e.target.value = "";
    const nuevos = [];
    for (const a of archivos) {
      try {
        const blob = await comprimirImagen(a);
        nuevos.push({ clave: crypto.randomUUID(), blob, vista: URL.createObjectURL(blob), texto: "" });
      } catch {
        setError("No se pudo leer una de las fotos.");
      }
    }
    setItems((prev) => [...prev, ...nuevos]);
  }

  const elegidas = new Set(items.map((x) => x.ruta).filter(Boolean));
  function alternarComida(c) {
    if (elegidas.has(c.foto_path)) return setItems((prev) => prev.filter((x) => x.ruta !== c.foto_path || x.id));
    if (items.length >= MAX_FOTOS) return;
    setItems((prev) => [...prev, { clave: crypto.randomUUID(), ruta: c.foto_path, vista: fotos[c.foto_path], texto: "", deComida: true }]);
  }

  async function guardar() {
    if (!nombre.trim()) return setError("Ponele un nombre.");
    if (!items.length) return setError("Sumá al menos una foto.");
    setError("");
    setGuardando(true);
    const subidas = [];
    try {
      let id = destacada.id;
      if (nueva) {
        const { data, error: err } = await supabase.from("destacadas").insert({ usuario_id: usuario.id, nombre: nombre.trim(), privada, orden: cantidad }).select().single();
        if (err) throw err;
        id = data.id;
      } else {
        const { error: err } = await supabase.from("destacadas").update({ nombre: nombre.trim(), privada }).eq("id", id);
        if (err) throw err;
      }
      // Las que se sacaron: la fila y, si era una foto subida para la destacada, el archivo.
      const quedan = new Set(items.filter((x) => x.id).map((x) => x.id));
      const sacadas = (destacada.fotos || []).filter((f) => !quedan.has(f.id));
      if (sacadas.length) {
        await supabase.from("destacadas_fotos").delete().in("id", sacadas.map((f) => f.id));
        const archivos = sacadas.map((f) => f.foto_path).filter((r) => r.includes("/destacadas/"));
        if (archivos.length) await supabase.storage.from("fotos").remove(archivos);
      }
      const filas = [];
      for (const [orden, x] of items.entries()) {
        if (x.id) {
          const antes = destacada.fotos.find((f) => f.id === x.id);
          if (antes && (antes.orden !== orden || (antes.texto || "") !== x.texto.trim())) {
            await supabase.from("destacadas_fotos").update({ orden, texto: x.texto.trim() || null }).eq("id", x.id);
          }
          continue;
        }
        let ruta = x.ruta;
        if (x.blob) {
          ruta = `${usuario.id}/destacadas/${id}-${Date.now()}-${orden}.jpg`;
          const { error: errFoto } = await supabase.storage.from("fotos").upload(ruta, x.blob, { contentType: "image/jpeg" });
          if (errFoto) throw errFoto;
          subidas.push(ruta);
        }
        filas.push({ destacada_id: id, usuario_id: usuario.id, foto_path: ruta, texto: x.texto.trim() || null, orden });
      }
      if (filas.length) {
        const { error: err } = await supabase.from("destacadas_fotos").insert(filas);
        if (err) throw err;
      }
      vibrar(15);
      onListo(nueva ? "Destacada creada" : "Destacada guardada");
    } catch (err) {
      if (subidas.length) await supabase.storage.from("fotos").remove(subidas);
      setError(/demasiadas_destacadas/.test(err.message || "") ? "Llegaste a 20 destacadas." : /demasiadas_fotos/.test(err.message || "") ? `Hasta ${MAX_FOTOS} fotos por destacada.` : "No se pudo guardar. Probá de nuevo.");
      setGuardando(false);
    }
  }

  async function borrarDestacada() {
    if (!borrar) return setBorrar(true);
    setGuardando(true);
    const { error: err } = await supabase.from("destacadas").delete().eq("id", destacada.id);
    if (err) {
      setGuardando(false);
      return setError("No se pudo borrar.");
    }
    const archivos = (destacada.fotos || []).map((f) => f.foto_path).filter((r) => r.includes("/destacadas/"));
    if (archivos.length) await supabase.storage.from("fotos").remove(archivos);
    onListo("Destacada borrada");
  }

  return (
    <div className="editor-destacada">
      <label className="campo">
        <span>Nombre</span>
        <input value={nombre} onChange={(e) => ponerNombre(e.target.value)} maxLength={24} placeholder="Ej: Gym" aria-label="Nombre de la destacada" />
      </label>
      <div className="chips-grupos" role="group" aria-label="Nombres sugeridos">
        {SUGERIDAS.map((s) => (
          <button key={s} type="button" className={nombre === s ? "chip-grupo activo" : "chip-grupo"} onClick={() => ponerNombre(s)}>{s}</button>
        ))}
      </div>
      <label className="interruptor">
        <input type="checkbox" checked={privada} onChange={(e) => { tocoPrivada.current = true; setPrivada(e.target.checked); }} />
        <span>Solo yo<small className="interruptor-detalle">{privada ? "No la ve nadie más." : "La ve tu grupo."}</small></span>
      </label>

      <div className="editor-destacada-fotos">
        <p className="editor-destacada-titulo"><strong>Fotos</strong><small>{items.length} de {MAX_FOTOS}</small></p>
        <ul className="editor-destacada-grilla">
          {items.map((x, i) => (
            <li key={x.clave}>
              {x.vista ? <img src={x.vista} alt={`Foto ${i + 1}`} /> : <span className="sin-vista"><Camera size={18} /></span>}
              <button type="button" className="quitar-foto" onClick={() => setItems((prev) => prev.filter((y) => y.clave !== x.clave))} aria-label={`Sacar la foto ${i + 1}`}><X size={13} /></button>
            </li>
          ))}
          {items.length < MAX_FOTOS && (
            <li>
              <label className="agregar-foto-destacada">
                <input type="file" accept="image/*" multiple onChange={sumarArchivos} aria-label="Subir fotos a la destacada" />
                <ImagePlus size={22} />
                <small>Subir</small>
              </label>
            </li>
          )}
        </ul>
        {fotosComidas.length > 0 && (
          <button type="button" className="boton-texto" onClick={() => setDeComidas(!deComidas)} aria-expanded={deComidas}>
            <Camera size={15} /> {deComidas ? "Listo" : "Sumar fotos de tus comidas"}
          </button>
        )}
        {deComidas && (
          <ul className="editor-destacada-grilla de-comidas" aria-label="Fotos de tus comidas">
            {fotosComidas.slice(0, 60).map((c) => (
              <li key={c.id}>
                <button type="button" className={elegidas.has(c.foto_path) ? "elegida" : ""} onClick={() => alternarComida(c)} aria-pressed={elegidas.has(c.foto_path)} aria-label={`Foto de ${c.descripcion || "una comida"}`}>
                  <img src={fotos[c.foto_path]} alt="" loading="lazy" />
                  {elegidas.has(c.foto_path) && <span className="marca-elegida"><Check size={14} /></span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton boton-grande" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : nueva ? "Crear destacada" : "Guardar"}</button>
      {!nueva && (
        <button type="button" className={borrar ? "boton-texto peligro" : "boton-texto"} onClick={borrarDestacada} onBlur={() => setBorrar(false)} disabled={guardando}>
          <Trash2 size={15} /> {borrar ? "¿Seguro? Tocá de nuevo" : "Borrar destacada"}
        </button>
      )}
    </div>
  );
}
