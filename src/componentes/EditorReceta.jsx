import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Camera, Images, ImageUp, MessageCircle, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { comprimirImagen } from "../lib/imagen.js";
import { nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { prepararItem } from "../lib/unidades.js";
import { macrosDeItem } from "../lib/macros.js";
import { compartirEnChat, pesoDeReceta, totalesDeReceta } from "../lib/recetasPropias.js";
import { FilaItem, Resultados } from "../vistas/NuevaComida.jsx";
import { leerIngredientes } from "../lib/ingredientes.js";
import Lector from "./Lector.jsx";
import { Hoja, vibrar } from "./Base.jsx";

const redondo = (n) => Math.round(n).toLocaleString("es-AR");
const MAX_FOTOS_RECETA = 4;

// Armar o editar una receta: ingredientes con sus cantidades, en cuántas porciones se divide y cuánto pesa terminada.
export default function EditorReceta({ receta, onCerrar, avisar }) {
  return (
    <Hoja abierta={!!receta} onCerrar={onCerrar} titulo={receta?.id ? "Editar receta" : "Nueva receta"} ancha>
      {receta && <Formulario key={receta.id || "nueva"} receta={receta} onListo={onCerrar} avisar={avisar} />}
    </Hoja>
  );
}

function Formulario({ receta, onListo, avisar }) {
  const { usuario, cargarExtras, mandarRecetaAlChat, fotos, comidas, comidasLogros, firmarRutas } = useDatos();
  // Fotos de la receta: las guardadas, las nuevas (se suben al guardar) y las tomadas de una comida ya cargada.
  const [fotosReceta, setFotosReceta] = useState(() => (receta.fotos || []).map((ruta) => ({ id: ruta, ruta })));
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  const llenas = fotosReceta.length >= MAX_FOTOS_RECETA;

  async function sumarFotos(e) {
    const archivos = [...e.target.files].slice(0, MAX_FOTOS_RECETA - fotosReceta.length);
    e.target.value = "";
    try {
      const nuevas = [];
      for (const archivo of archivos) {
        const blob = await comprimirImagen(archivo);
        nuevas.push({ id: crypto.randomUUID(), blob, vista: URL.createObjectURL(blob) });
      }
      setFotosReceta((prev) => [...prev, ...nuevas].slice(0, MAX_FOTOS_RECETA));
      vibrar(8);
    } catch (err) {
      setError(err.message);
    }
  }

  function elegirDeComida(c) {
    if (!fotosReceta.some((f) => f.deComida === c.foto_path)) setFotosReceta((prev) => [...prev, { id: crypto.randomUUID(), deComida: c.foto_path }].slice(0, MAX_FOTOS_RECETA));
    setEligiendoFoto(false);
    vibrar(10);
  }

  // Al guardar: las nuevas se suben y las de una comida se copian (si la comida se borra, la receta conserva su foto).
  async function subirFotos(idReceta) {
    const rutas = [];
    for (const [n, f] of fotosReceta.entries()) {
      if (f.ruta) { rutas.push(f.ruta); continue; }
      const ruta = `${usuario.id}/recetas/${idReceta}-${Date.now()}-${n}.jpg`;
      if (f.blob) {
        const { error: err } = await supabase.storage.from("fotos").upload(ruta, f.blob, { contentType: "image/jpeg" });
        if (err) throw err;
        rutas.push(ruta);
      } else if (f.deComida) {
        const { error: err } = await supabase.storage.from("fotos").copy(f.deComida, ruta);
        rutas.push(err ? f.deComida : ruta);
      }
    }
    return rutas;
  }
  const [compartida, setCompartida] = useState(receta.compartida !== false);
  const [nombre, setNombre] = useState(receta.nombre || "");
  const [porciones, setPorciones] = useState(receta.porciones || 8);
  const desdeComida = !receta.id && (receta.ingredientes || []).length > 0;
  const [pesoFinal, setPesoFinal] = useState(receta.peso_final ? String(receta.peso_final) : "");
  const [importando, setImportando] = useState(false);
  const [leido, setLeido] = useState(null);
  // Las comidas propias con foto: primero las que usaron esta receta, después las más nuevas.
  const comidasConFoto = useMemo(() => {
    const propias = (comidasLogros || comidas).filter((c) => c.usuario_id === usuario.id && c.foto_path && c.tipo !== "resumen");
    const usoLaReceta = (c) => receta.id && (c.alimentos || []).some((a) => a.receta_id === receta.id);
    const clave = nombre.trim().toLowerCase().slice(0, 12);
    const parecida = (c) => clave.length >= 3 && String(c.descripcion || "").toLowerCase().includes(clave);
    return [...propias]
      .sort((a, b) => Number(usoLaReceta(b) || parecida(b)) - Number(usoLaReceta(a) || parecida(a)) || (a.creado_en < b.creado_en ? 1 : -1))
      .slice(0, 40)
      .map((c) => ({ ...c, deEstaReceta: Boolean(usoLaReceta(c) || parecida(c)) }));
  }, [comidasLogros, comidas, usuario.id, receta.id, nombre]);

  // Una foto o el texto de la receta: cada ingrediente reconocido entra con su cantidad.
  function alLeer({ titulo, porciones: rinde, items: nuevos, sinReconocer }) {
    setItems((prev) => [...prev, ...nuevos.map((i) => ({ ...i, id: crypto.randomUUID() }))]);
    if (titulo) setNombre((n) => n || titulo.slice(0, 80));
    if (rinde) setPorciones(Math.min(100, rinde));
    setLeido({ cantidad: nuevos.length, sinReconocer });
    setImportando(false);
    vibrar(15);
  }
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
    const idReceta = receta.id || crypto.randomUUID();
    const escribir = (datos) => {
      const consulta = supabase.from("recetas_propias");
      return receta.id ? consulta.update(datos).eq("id", receta.id) : consulta.insert({ ...datos, id: idReceta, usuario_id: usuario.id });
    };
    let rutasFotos = [];
    try {
      rutasFotos = await subirFotos(idReceta);
    } catch {
      setGuardando(false);
      return setError("No se pudo subir la foto. Probá de nuevo.");
    }
    // Las fotos se mandan solo si hay (o había): así sigue andando aunque falte el SQL nuevo.
    const conFotos = rutasFotos.length || receta.fotos?.length ? { fotos: rutasFotos } : {};
    let { error: err } = await escribir({ ...fila, compartida, ...conFotos });
    if (err && /fotos/.test(err.message || "")) ({ error: err } = await escribir({ ...fila, compartida }));
    // Si todavía no se corrió el SQL de recetas compartidas, se guarda igual.
    if (err && /compartida/.test(err.message || "")) ({ error: err } = await escribir(fila));
    setGuardando(false);
    if (err) return setError("No se pudo guardar la receta.");
    // Las fotos que se sacaron (solo las de la carpeta de recetas: las de comidas siguen siendo de su comida).
    const sacadas = (receta.fotos || []).filter((r) => !rutasFotos.includes(r) && r.includes("/recetas/"));
    if (sacadas.length) supabase.storage.from("fotos").remove(sacadas).catch(() => {});
    if (rutasFotos.length) firmarRutas(rutasFotos).catch(() => {});
    await cargarExtras();
    vibrar(20);
    avisar(receta.id ? "Receta actualizada" : "Receta guardada. Buscala al cargar una comida.");
    onListo();
  }

  async function compartir() {
    try {
      await compartirEnChat({ supabase, receta: { ...receta, compartida }, usuarioId: usuario.id, mandarRecetaAlChat });
      if (!compartida) await cargarExtras();
      vibrar(10);
      onListo();
    } catch {
      setError("No se pudo compartir.");
    }
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

      <div className="fotos-receta" role="group" aria-label="Fotos de la receta">
        <span className="fotos-receta-titulo"><strong>Fotos</strong><small>De cómo queda. Las ve el grupo si la compartís.</small></span>
        <div className="fotos-receta-lista">
          {fotosReceta.map((f) => {
            const src = f.vista || fotos[f.ruta] || fotos[f.deComida];
            return (
              <span key={f.id} className="miniatura con-foto">
                {src ? <img src={src} alt="Foto de la receta" /> : <Camera size={18} />}
                <button type="button" className="quitar-foto" onClick={() => setFotosReceta((prev) => prev.filter((x) => x.id !== f.id))} aria-label="Quitar esta foto"><X size={13} /></button>
              </span>
            );
          })}
          {!llenas && (
            <>
              <label className="miniatura agregar-foto">
                <input type="file" accept="image/*" multiple onChange={sumarFotos} aria-label="Subir fotos de la receta" />
                <Camera size={18} />
              </label>
              {comidasConFoto.length > 0 && (
                <button type="button" className="miniatura agregar-foto" onClick={() => setEligiendoFoto(true)} aria-label="Elegir la foto de una comida que ya cargaste">
                  <Images size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {createPortal(
        <Hoja abierta={eligiendoFoto} onCerrar={() => setEligiendoFoto(false)} titulo="Elegí una comida" ancha>
          <p className="nota">Su foto pasa a ser una foto de la receta.</p>
          <ul className="elegir-comida-foto">
            {comidasConFoto.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => elegirDeComida(c)} aria-label={`Usar la foto de ${c.descripcion || tipoInfo(c.tipo).texto}`}>
                  {fotos[c.foto_path] ? <img src={fotos[c.foto_path]} alt="" loading="lazy" /> : <span className="adjunto-cargando" />}
                  <span><strong>{c.descripcion || tipoInfo(c.tipo).texto}</strong><small>{c.deEstaReceta ? "Con esta receta · " : ""}{tipoInfo(c.tipo).texto} · {nombreDia(c.fecha)}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </Hoja>,
        document.body,
      )}

      {desdeComida && <p className="nota">Si es algo que dividís (un budín, una tarta), poné en cuántas porciones. Si es tu comida de siempre, dejá 1.</p>}
      <div className="campos-dobles">
        <div className="campo">
          <span id="etiqueta-porciones">Porciones que rinde</span>
          <div className="gramos" role="group" aria-labelledby="etiqueta-porciones">
            <button onClick={() => setPorciones((n) => Math.max(1, n - 1))} aria-label="Una porción menos"><Minus size={17} /></button>
            <input type="number" min="1" max="100" inputMode="numeric" value={porciones} onChange={(e) => setPorciones(Math.max(1, Number(e.target.value) || 1))} aria-label="Porciones" />
            <button onClick={() => setPorciones((n) => Math.min(100, n + 1))} aria-label="Una porción más"><Plus size={17} /></button>
          </div>
          <div className="porciones-rapidas" role="group" aria-label="Porciones rápidas">
            {[2, 4, 6, 8, 10, 12].map((n) => (
              <button key={n} type="button" className={porciones === n ? "activo" : ""} onClick={() => setPorciones(n)} aria-pressed={porciones === n}>{n}</button>
            ))}
          </div>
        </div>
        <label className="campo">
          <span>Peso terminada (g, opcional)</span>
          <input type="number" min="0" inputMode="numeric" value={pesoFinal} onChange={(e) => setPesoFinal(e.target.value)} placeholder={total.gramos ? String(Math.round(total.gramos)) : "Ej: 800"} aria-label="Peso de la receta terminada" />
        </label>
      </div>

      <div className="ingredientes-cabecera">
        <h3 className="titulo-lista">Ingredientes</h3>
        <button type="button" className={importando ? "boton-chico activo" : "boton-chico"} onClick={() => setImportando(!importando)} aria-expanded={importando}>
          <ImageUp size={15} /> Importar foto o texto
        </button>
      </div>
      {importando && (
        <div className="tarjeta-interna">
          <Lector
            nota="Subí una foto de la receta o pegá la lista de ingredientes. Cada uno entra con su cantidad y después lo podés ajustar."
            interpretar={leerIngredientes}
            onLeido={alLeer}
            ejemplo={"250 g de harina\n3 huevos\n1 taza de leche\n100 g de manteca"}
          />
        </div>
      )}
      {leido && (
        <p className={leido.cantidad ? "nota" : "error"} role="status">
          {leido.cantidad ? `Agregué ${leido.cantidad} ${leido.cantidad === 1 ? "ingrediente" : "ingredientes"}.` : "No encontré ingredientes con cantidad."}
          {leido.sinReconocer.length > 0 && ` No reconocí: ${leido.sinReconocer.join(", ")}. Buscalos abajo.`}
        </p>
      )}
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

      <label className="interruptor">
        <input type="checkbox" checked={compartida} onChange={(e) => setCompartida(e.target.checked)} />
        <span>Que la vea el grupo</span>
      </label>
      {receta.id && (
        <button type="button" className="boton boton-secundario" onClick={compartir} disabled={guardando}>
          <MessageCircle size={17} /> Compartir en el chat
        </button>
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
