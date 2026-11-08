import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Camera, ClipboardPaste, LoaderCircle, Minus, PenLine, Plus, ScanBarcode, Search, Star, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo, buscarAlimentos, buscarCodigo } from "../lib/api.js";
import { comprimirImagen } from "../lib/imagen.js";
import { filaDeComida, itemImportado } from "../lib/importar.js";
import { alimentosUsados, buscarEnHistorial, combosDe } from "../lib/historial.js";
import { fechaLocal, nombreDia, tipoSegunHora } from "../lib/fechas.js";
import { macrosDeItem, sumarItems, TIPOS, tipoInfo } from "../lib/macros.js";
import { conCantidad, conUnidad, prepararItem, restar, sumar, textoMedida, unidadesDe } from "../lib/unidades.js";
import { buscarTipicos } from "../data/alimentos-ar.js";
import { Hoja, Numero, vibrar } from "../componentes/Base.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import Lector from "../componentes/Lector.jsx";
import Escaner from "./Escaner.jsx";

const CAMPOS = [["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]];
const ORDEN_FUENTE = { argentina: 0, mundo: 1, usda: 2 };
const PLURALES = { desayuno: "desayunos", almuerzo: "almuerzos", merienda: "meriendas", cena: "cenas", colacion: "colaciones", resumen: "días" };

export default function NuevaComida({ carga, onCerrar, onGuardar, onImportarDia }) {
  const editando = carga?.comida;
  return (
    <Hoja abierta={!!carga} onCerrar={onCerrar} titulo={editando ? "Editar comida" : "Subir comida"} ancha>
      {carga && <Formulario key={editando?.id || "nueva"} carga={carga} onGuardar={onGuardar} onImportarDia={onImportarDia} />}
    </Hoja>
  );
}

function Formulario({ carga, onGuardar, onImportarDia }) {
  const { usuario, yo, comidas, comidasLogros, fotos, cargarComidas, extras, avisarEstado } = useDatos();
  const original = carga.comida;

  // Mientras arma una comida nueva, el grupo ve "está publicando su comida…".
  useEffect(() => {
    if (original) return undefined;
    avisarEstado({ publicando: true });
    return () => avisarEstado({ publicando: false });
  }, [original, avisarEstado]);

  const [tipo, setTipo] = useState(original?.tipo || carga.tipo || tipoSegunHora());
  const [descripcion, setDescripcion] = useState(original?.descripcion || carga.receta?.descripcion || "");
  const [items, setItems] = useState(() => {
    if (!original) return (carga.receta?.items || []).map((i) => ({ ...prepararItem(i), id: crypto.randomUUID() }));
    if (original.alimentos?.length) return original.alimentos.map((a) => ({ ...(a.por100 ? prepararItem(a) : a), id: a.id || crypto.randomUUID() }));
    return [{ id: "base", nombre: original.descripcion || "Comida", fuente: "manual", kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas }];
  });
  const [foto, setFoto] = useState(null);
  const [vistaFoto, setVistaFoto] = useState(original ? fotos[original.foto_path] : null);
  const [texto, setTexto] = useState(carga.buscar || "");
  const [panel, setPanel] = useState(null);
  const [importado, setImportado] = useState(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [faltan, setFaltan] = useState(null);
  const [ajuste, setAjuste] = useState(
    original?.macros_editados ? { kcal: original.calorias, p: original.proteinas, c: original.carbohidratos, g: original.grasas } : null,
  );
  const [privada, setPrivada] = useState(original?.privada ?? yo.comidas_privadas ?? false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const campo = useRef(null);

  const calculado = useMemo(() => sumarItems(items), [items]);
  const total = ajuste ? { kcal: Number(ajuste.kcal) || 0, p: Number(ajuste.p) || 0, c: Number(ajuste.c) || 0, g: Number(ajuste.g) || 0 } : calculado;

  const historial = useMemo(() => alimentosUsados(comidasLogros || comidas, usuario.id), [comidasLogros, comidas, usuario.id]);
  const combos = useMemo(() => combosDe(comidasLogros || comidas, usuario.id, tipo), [comidasLogros, comidas, usuario.id, tipo]);

  useEffect(() => () => { if (vistaFoto?.startsWith("blob:")) URL.revokeObjectURL(vistaFoto); }, [vistaFoto]);

  function agregar(alimento) {
    // Lo que viene sin valores por 100 g (importado o a mano) se repite tal cual.
    setItems((prev) => [...prev, { ...(alimento.por100 ? prepararItem(alimento) : alimento), id: crypto.randomUUID() }]);
    setTexto("");
    setPanel(null);
    setImportado(null);
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

  function alternarPanel(nombre) {
    setPanel(panel === nombre ? null : nombre);
    setImportado(null);
  }

  // Lo leído pasa por la carga manual: ahí se corrige antes de sumarlo a la comida.
  function alLeer(filas) {
    const fila = filaDeComida(filas, tipo);
    if (!fila && filas.length) return onImportarDia(carga.fecha || fechaLocal(), filas);
    if (fila?.alimentos?.length) {
      // Si un alimento igual ya está en la comida, no se vuelve a sumar.
      const firma = (a) => `${String(a.nombre).toLowerCase().trim()}|${Math.round(macrosDeItem(a).kcal)}`;
      setItems((prev) => {
        const ya = new Set(prev.map(firma));
        const nuevos = fila.alimentos
          .map((a) => {
            const item = itemImportado(a);
            return { ...(item.por100 ? prepararItem(item) : item), id: crypto.randomUUID() };
          })
          .filter((a) => !ya.has(firma(a)));
        return [...prev, ...nuevos];
      });
      setPanel(null);
      setImportado(null);
      setError("");
      vibrar(12);
      return;
    }
    setImportado({
      clave: Date.now(),
      nombre: `${tipoInfo(tipo).texto} importado`,
      fuente: "importado",
      aviso: fila ? "Revisá los números y tocá Agregar." : "No encontramos calorías ni macros. Cargalos acá.",
      ...(fila ? { kcal: fila.kcal, p: fila.p, c: fila.c, g: fila.g } : {}),
    });
    setPanel("mano");
  }

  async function borrar() {
    if (!confirmarBorrado) return setConfirmarBorrado(true);
    setGuardando(true);
    const { data, error: err } = await supabase.from("comidas").delete().eq("id", original.id).select("id");
    if (err || data?.length === 0) {
      setError(err?.message || "No se pudo borrar");
      setGuardando(false);
      return;
    }
    if (original.foto_path) await supabase.storage.from("fotos").remove([original.foto_path]);
    await cargarComidas();
    onGuardar("borrada");
  }

  // Repite una comida anterior completa, con sus cantidades.
  function usarCombo(combo) {
    setItems(combo.alimentos.map((a) => ({ ...(a.por100 ? prepararItem(a) : a), id: crypto.randomUUID() })));
    setDescripcion((d) => d || combo.nombre);
    setError("");
    vibrar(10);
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

  // Antes de publicar algo nuevo, avisa qué quedó sin completar y deja seguir igual.
  function publicar() {
    if (!original) {
      const vacios = [!vistaFoto && "la foto de la comida", !items.length && !ajuste && "los alimentos", !descripcion.trim() && "el título"].filter(Boolean);
      if (vacios.length && !faltan) return setFaltan(vacios);
    }
    setFaltan(null);
    guardar();
  }

  async function guardar() {
    if (!items.length && !ajuste && !foto && !original?.foto_path) return setError("Agregá una comida o una foto.");
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
              <IconoComida tipo={t.id} /> {t.plural || t.texto}
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
            <button className={panel === "codigo" ? "boton-icono activo" : "boton-icono"} onClick={() => alternarPanel("codigo")} aria-label="Escanear código" aria-pressed={panel === "codigo"}><ScanBarcode size={20} /></button>
            <button className={panel === "mano" ? "boton-icono activo" : "boton-icono"} onClick={() => alternarPanel("mano")} aria-label="Cargar a mano" aria-pressed={panel === "mano"}><PenLine size={19} /></button>
          </>
        )}
      </div>

      {buscando ? (
        <Resultados texto={texto} onElegir={agregar} propios={historial.todos} />
      ) : (
        <>
          {!original && !items.length && (
            <div className="acciones-rapidas">
              <button className={panel === "importar" ? "tarjeta accion activa" : "tarjeta accion"} onClick={() => alternarPanel("importar")} aria-pressed={panel === "importar"}>
                <ClipboardPaste size={22} />
                <span><strong>Importar {tipoInfo(tipo).texto.toLowerCase()}</strong><small>Captura o texto</small></span>
              </button>
              <button className="tarjeta accion" onClick={() => onImportarDia(carga.fecha || fechaLocal())}>
                <CalendarDays size={22} />
                <span><strong>Todo el día</strong><small>Importar el total</small></span>
              </button>
            </div>
          )}

          {panel === "importar" && <div className="tarjeta-interna"><Lector onLeido={alLeer} /></div>}
          {panel === "codigo" && <Escaner onAlimento={agregar} buscar={buscarCodigo} />}
          {panel === "mano" && <CargaManual key={importado?.clave || "vacia"} inicial={importado} onAgregar={agregar} />}

          <AnimatePresence initial={false}>
            {items.map((i) => (
              <FilaItem key={i.id} item={i} onCambiar={(n) => cambiarItem(i.id, n)} onQuitar={() => setItems((prev) => prev.filter((x) => x.id !== i.id))} />
            ))}
          </AnimatePresence>

          {!items.length && !panel && (combos.length > 0 || extras.favoritas.length > 0 || historial.recientes.length > 0) && (
            <div className="historial">
              {combos.length > 0 && (
                <>
                  <h3 className="titulo-lista">Tus {PLURALES[tipo]} anteriores</h3>
                  <ul className="resultados">
                    {combos.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => usarCombo(c)}>
                          <span className="resultado-datos">
                            <strong>{c.nombre}</strong>
                            <span>{nombreDia(c.fecha)} · {c.kcal.toLocaleString("es-AR")} kcal · {c.alimentos.length} {c.alimentos.length === 1 ? "alimento" : "alimentos"}</span>
                          </span>
                          <span className="resultado-mas" aria-hidden="true"><Plus size={18} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {extras.favoritas.length > 0 && (
                <>
                  <h3 className="titulo-lista">Favoritas</h3>
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
                  </ul>
                </>
              )}
              {historial.recientes.length > 0 && (
                <>
                  <h3 className="titulo-lista">Recientes</h3>
                  <ul className="resultados">
                    {historial.recientes.map((h) => <FilaHistorial key={h.alimento.nombre} uso={h} onElegir={agregar} />)}
                  </ul>
                </>
              )}
              {historial.frecuentes.length > 0 && (
                <>
                  <h3 className="titulo-lista">Los que más usás</h3>
                  <ul className="resultados">
                    {historial.frecuentes.map((h) => <FilaHistorial key={h.alimento.nombre} uso={h} onElegir={agregar} />)}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="foto-y-nota">
            <label className={vistaFoto ? "miniatura con-foto" : "miniatura"}>
              <input type="file" accept="image/*" onChange={elegirFoto} aria-label="Foto de la comida" />
              {vistaFoto ? <img src={vistaFoto} alt="Foto de la comida" /> : <Camera size={24} />}
            </label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Título de la comida" aria-label="Nota de la comida" maxLength={200} />
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
              {original && (
                <button className={confirmarBorrado ? "boton-texto peligro" : "boton-texto"} onClick={borrar} onBlur={() => setConfirmarBorrado(false)} disabled={guardando}>
                  <Trash2 size={15} /> {confirmarBorrado ? "¿Seguro? Tocá de nuevo" : "Borrar comida"}
                </button>
              )}
            </div>
          </details>

          <div className="pie-publicar">
            {error && <p className="error" role="alert">{error}</p>}
            <AnimatePresence>
              {faltan && (
                <motion.div className="confirmar-publicar" role="alertdialog" aria-label="Faltan datos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <p>Te falta {faltan.length > 1 ? `${faltan.slice(0, -1).join(", ")} y ${faltan[faltan.length - 1]}` : faltan[0]}. ¿Publicás igual?</p>
                  <div>
                    <button className="boton boton-secundario" onClick={() => setFaltan(null)}>Completar</button>
                    <button className="boton" onClick={publicar} disabled={guardando}>Publicar igual</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="pie-fila">
              <div className="pie-total">
                <strong><Numero valor={Math.round(total.kcal)} /> kcal</strong>
                <span>P {Math.round(total.p)} · C {Math.round(total.c)} · G {Math.round(total.g)}</span>
              </div>
              <button className="boton" onClick={publicar} disabled={guardando} aria-label={original ? "Guardar cambios" : "Publicar comida"}>
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
        <span>{item.medida && !item.por100 ? `${item.medida} · ` : ""}{Math.round(m.kcal)} kcal · P {Math.round(m.p)} · C {Math.round(m.c)} · G {Math.round(m.g)}{item.estimado ? " · estimado" : ""}</span>
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

function FilaHistorial({ uso, onElegir }) {
  const { alimento, veces } = uso;
  const item = alimento.por100 ? prepararItem(alimento) : alimento;
  const m = macrosDeItem(item);
  const medida = item.por100 ? (item.unidad?.g === 1 ? `${Math.round(item.gramos)} g` : `${item.cantidad} ${item.unidad?.nombre}`) : item.medida;
  return (
    <li>
      <button onClick={() => onElegir(alimento)}>
        <span className="resultado-datos">
          <strong>{alimento.nombre}</strong>
          <span>{medida ? `${medida} · ` : ""}{Math.round(m.kcal)} kcal{veces > 1 ? ` · ${veces} veces` : ""}</span>
        </span>
        <span className="resultado-mas" aria-hidden="true"><Plus size={18} /></span>
      </button>
    </li>
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

function Resultados({ texto, onElegir, propios }) {
  const tuyos = useMemo(() => buscarEnHistorial(propios, texto), [propios, texto]);
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
      {tuyos.length > 0 && (
        <>
          <h3 className="titulo-lista">Tus alimentos</h3>
          <ul className="resultados">
            {tuyos.map((h) => <FilaHistorial key={h.alimento.nombre} uso={h} onElegir={onElegir} />)}
          </ul>
        </>
      )}

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

function CargaManual({ inicial, onAgregar }) {
  const [v, setV] = useState({ nombre: inicial?.nombre || "", kcal: inicial?.kcal ?? "", p: inicial?.p ?? "", c: inicial?.c ?? "", g: inicial?.g ?? "" });

  function agregar(e) {
    e.preventDefault();
    onAgregar({
      nombre: v.nombre.trim() || "Comida",
      fuente: inicial?.fuente || "manual",
      kcal: Number(v.kcal) || 0,
      p: Number(v.p) || 0,
      c: Number(v.c) || 0,
      g: Number(v.g) || 0,
    });
  }

  return (
    <form className="tarjeta-interna" onSubmit={agregar}>
      {inicial?.aviso && <p className="nota">{inicial.aviso}</p>}
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
