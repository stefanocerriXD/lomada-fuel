import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookmarkPlus, CalendarDays, HeartPulse, Camera, ClipboardPaste, LoaderCircle, Martini, Minus, PenLine, Plus, ScanBarcode, Search, Star, Trash2, Users, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo, buscarAlimentos, buscarCodigo } from "../lib/api.js";
import { comprimirImagen } from "../lib/imagen.js";
import { filaDeComida, itemImportado } from "../lib/importar.js";
import { alimentosUsados, buscarEnHistorial, combosDe } from "../lib/historial.js";
import { buscarRecetas, recetaComoAlimento } from "../lib/recetasPropias.js";
import { fechaLocal, nombreDia, tipoSegunHora } from "../lib/fechas.js";
import { macrosDeItem, sumarItems, TIPOS, tipoInfo } from "../lib/macros.js";
import { conCantidad, conUnidad, prepararItem, restar, sumar, textoMedida, unidadesDe } from "../lib/unidades.js";
import { buscarTipicos } from "../data/alimentos-ar.js";
import { Avatar, Hoja, Numero, vibrar } from "../componentes/Base.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import Lector from "../componentes/Lector.jsx";
import Escaner from "./Escaner.jsx";
import EditorReceta from "../componentes/EditorReceta.jsx";
import { createPortal } from "react-dom";

const CAMPOS = [["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]];
const ORDEN_FUENTE = { argentina: 0, mundo: 1, usda: 2 };
const horaDe = (momento) => new Date(momento).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const PLURALES = { desayuno: "desayunos", almuerzo: "almuerzos", merienda: "meriendas", cena: "cenas", colacion: "colaciones", resumen: "días" };

export default function NuevaComida({ carga, onCerrar, onGuardar, onImportarDia, onFiesta, onPostre, avisar }) {
  const editando = carga?.comida;
  return (
    <Hoja abierta={!!carga} onCerrar={onCerrar} titulo={carga?.postre ? "Agregar postre" : editando ? "Editar comida" : "Subir comida"} ancha>
      {carga && <Formulario key={editando?.id || "nueva"} carga={carga} onGuardar={onGuardar} onImportarDia={onImportarDia} onFiesta={onFiesta} onPostre={onPostre} avisar={avisar} />}
    </Hoja>
  );
}

function Formulario({ carga, onGuardar, onImportarDia, onFiesta, onPostre, avisar }) {
  // Lo que se está cargando se puede guardar como receta propia (un budín, el desayuno de siempre).
  const [recetaNueva, setRecetaNueva] = useState(null);
  const { usuario, yo, perfiles, comidas, comidasLogros, fotos, cargarComidas, extras, avisarEstado, invitaciones, cargarInvitaciones, grupo, misGrupos } = useDatos();
  // En varios grupos: dónde se publica según el ajuste de cada uno, o eligiendo acá.
  const variosGrupos = misGrupos.length > 1;
  const eligeGrupos = variosGrupos && yo.publicar_en === "elegir";
  const [gruposElegidos, setGruposElegidos] = useState(() => {
    const propios = (carga.comida?.grupos || []).filter((id) => misGrupos.some((g) => g.id === id));
    return propios.length ? propios : [grupo.id];
  });
  const alternarGrupo = (id) => setGruposElegidos((lista) => (lista.includes(id) ? (lista.length > 1 ? lista.filter((x) => x !== id) : lista) : [...lista, id]));
  // Comida grupal: a quién sumar. Solo la comida original invita, no las copias de los que aceptaron.
  const [companeros, setCompaneros] = useState([]);
  const otrosIntegrantes = Object.values(perfiles).filter((p) => p.id !== usuario.id);
  const estadoCompanero = (id) => {
    if (!original) return "";
    if (comidas.some((c) => c.grupo_comida === original.id && c.usuario_id === id)) return "Comió";
    if (invitaciones.some((i) => i.comida_id === original.id && i.para_usuario === id && i.estado === "pendiente")) return "Pendiente";
    return "";
  };
  const alternarCompanero = (id) => setCompaneros((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]));
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

  // Lo que llegó de Apple Salud (MyFitnessPal escribe una entrada por comida): se precarga y solo falta la foto.
  const [deSalud, setDeSalud] = useState([]);
  useEffect(() => {
    if (original || carga.postre || !extras.disponible) return undefined;
    let vigente = true;
    supabase
      .from("salud_comidas")
      .select("id, momento, kcal, proteinas, carbohidratos, grasas")
      .eq("usuario_id", usuario.id)
      .eq("fecha", carga.fecha || fechaLocal())
      .order("momento", { ascending: false })
      .then(({ data, error }) => { if (vigente && !error) setDeSalud(data || []); });
    return () => { vigente = false; };
  }, [original, carga.postre, carga.fecha, extras.disponible, usuario.id]);
  const usadasDeSalud = useMemo(() => new Set(comidas.filter((c) => c.usuario_id === usuario.id).flatMap((c) => (c.alimentos || []).map((a) => a.salud_id).filter(Boolean))), [comidas, usuario.id]);
  const sugeridasDeSalud = deSalud.filter((e) => !usadasDeSalud.has(e.id) && !items.some((i) => i.salud_id === e.id)).slice(0, 3);

  function usarDeSalud(e) {
    const t = carga.tipo || tipoSegunHora(e.momento);
    setTipo(t);
    setItems((prev) => [...prev, {
      id: crypto.randomUUID(),
      nombre: `${tipoInfo(t).texto} de Apple Salud`,
      fuente: "importado",
      medida: `cargado a las ${horaDe(e.momento)}`,
      kcal: Number(e.kcal) || 0,
      p: Number(e.proteinas) || 0,
      c: Number(e.carbohidratos) || 0,
      g: Number(e.grasas) || 0,
      salud_id: e.id,
    }]);
    setError("");
    vibrar(12);
  }

  const calculado = useMemo(() => sumarItems(items), [items]);
  const total = ajuste ? { kcal: Number(ajuste.kcal) || 0, p: Number(ajuste.p) || 0, c: Number(ajuste.c) || 0, g: Number(ajuste.g) || 0 } : calculado;

  const historial = useMemo(() => alimentosUsados(comidasLogros || comidas, usuario.id), [comidasLogros, comidas, usuario.id]);
  const combos = useMemo(() => combosDe(comidasLogros || comidas, usuario.id, tipo), [comidasLogros, comidas, usuario.id, tipo]);

  // Solo se libera la vista previa propia: la foto guardada en el celu la usan otras pantallas.
  useEffect(() => () => { if (vistaFoto?.startsWith("blob:") && vistaFoto !== fotos[original?.foto_path]) URL.revokeObjectURL(vistaFoto); }, [vistaFoto]); // eslint-disable-line react-hooks/exhaustive-deps

  function agregar(alimento) {
    // Lo que viene sin valores por 100 g (importado o a mano) se repite tal cual.
    // En modo postre, lo que se suma queda marcado como postre de esa comida.
    setItems((prev) => [...prev, { ...(alimento.por100 ? prepararItem(alimento) : alimento), id: crypto.randomUUID(), ...(carga.postre ? { postre: true } : {}) }]);
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
    // La foto de una comida grupal la siguen usando los demás.
    if (original.foto_path && !original.grupo_comida) await supabase.storage.from("fotos").remove([original.foto_path]);
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
        ...(eligeGrupos ? { grupos: gruposElegidos } : {}),
        alimentos: items.map(({ indice, ...i }) => ({ ...i, ...(i.por100 ? macrosDeItem(i) : {}) })),
      };
      const { error: errFila } = original
        ? await supabase.from("comidas").update(fila).eq("id", id)
        : await supabase.from("comidas").insert({ ...fila, id, usuario_id: usuario.id, fecha: carga.fecha || fechaLocal() });
      if (errFila) throw errFila;
      if (rutaNueva && original?.foto_path && !original.grupo_comida) await supabase.storage.from("fotos").remove([original.foto_path]);
      if (companeros.length) {
        const { error: errInvitar } = await supabase.rpc("invitar_a_comida", { p_comida: id, p_para: companeros });
        if (!errInvitar) {
          avisarGrupo("invitacion", id);
          cargarInvitaciones().catch(() => {});
        }
      }
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
  // En colación, una opción discreta: si es el postre del almuerzo o la cena, va dentro de esa comida.
  const fechaCarga = carga.fecha || fechaLocal();
  const paraPostre = original || carga.postre || !onPostre || tipo !== "colacion"
    ? null
    : comidas
        .filter((c) => c.usuario_id === usuario.id && c.fecha === fechaCarga && (c.tipo === "almuerzo" || c.tipo === "cena"))
        .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1))[0];

  return (
    <div className="carga">
      {!buscando && items.length === 0 && sugeridasDeSalud.length > 0 && (
        <div className="de-salud">
          <p className="de-salud-titulo"><HeartPulse size={15} /> Llegó de Apple Salud · tocá para precargar</p>
          {sugeridasDeSalud.map((e) => {
            const t = carga.tipo || tipoSegunHora(e.momento);
            return (
              <button key={e.id} className="de-salud-boton" onClick={() => usarDeSalud(e)}>
                <IconoComida tipo={t} />
                <span>
                  <strong>{tipoInfo(t).texto} · {horaDe(e.momento)}</strong>
                  <small>{Math.round(e.kcal)} kcal · P {Math.round(e.proteinas)} · C {Math.round(e.carbohidratos)} · G {Math.round(e.grasas)}</small>
                </span>
                <span className="de-salud-usar">Usar</span>
              </button>
            );
          })}
        </div>
      )}
      {!buscando && (
        <div className="tipos" role="radiogroup" aria-label="Tipo de comida">
          {TIPOS.map((t) => (
            <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => setTipo(t.id)}>
              <IconoComida tipo={t.id} /> {t.plural || t.texto}
            </button>
          ))}
        </div>
      )}

      {!buscando && items.length === 0 && paraPostre && (
        <button className="postre-opcion" onClick={() => onPostre(paraPostre)}>
          🍮 ¿Es postre? <strong>Sumalo a tu {paraPostre.tipo === "cena" ? "cena" : "almuerzo"}</strong>
        </button>
      )}
      {carga.postre && <p className="postre-nota">🍮 Buscá el postre y sumalo. Queda dentro de tu {original?.tipo === "cena" ? "cena" : "almuerzo"}.</p>}
      <div className="fila-busqueda">
        <div className="buscador-campo">
          <Search size={19} />
          <input ref={campo} autoFocus={Boolean(carga.postre)} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Qué comiste?" aria-label="Buscar alimento o producto" enterKeyHint="search" autoComplete="off" />
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
              {onFiesta && (
                <button className="enlace-fiesta" onClick={onFiesta}>
                  <Martini size={16} /> ¿Estás de fiesta? Cargá tus vasos
                </button>
              )}
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

          {items.length > 0 && !panel && (
            <button type="button" className="boton-texto guardar-receta" onClick={() => setRecetaNueva({ nombre: descripcion.trim().slice(0, 80), ingredientes: items, porciones: 1 })}>
              <BookmarkPlus size={15} /> Guardar como receta
            </button>
          )}
          {createPortal(<EditorReceta receta={recetaNueva} onCerrar={() => setRecetaNueva(null)} avisar={avisar || (() => {})} />, document.body)}

          {!items.length && !panel && (combos.length > 0 || extras.favoritas.length > 0 || historial.recientes.length > 0 || extras.recetas?.length > 0) && (
            <div className="historial">
              {extras.recetas?.length > 0 && (
                <>
                  <h3 className="titulo-lista">Tus recetas</h3>
                  <ul className="resultados">
                    {extras.recetas.slice(0, 4).map((r) => <FilaResultado key={r.id} alimento={recetaComoAlimento(r)} onElegir={agregar} />)}
                  </ul>
                </>
              )}
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

          {tipo !== "resumen" && otrosIntegrantes.length > 0 && (!original || !original.grupo_comida || original.grupo_comida === original.id) && (
            <details className="comida-grupal" open={Boolean(original?.grupo_comida) || undefined}>
              <summary className="comida-grupal-titulo">
                <Users size={15} /> Comida grupal
                {companeros.length > 0 && <small> · {companeros.length} {companeros.length === 1 ? "persona" : "personas"}</small>}
              </summary>
              <div className="comida-grupal-lista" role="group" aria-label="Sumar integrantes a la comida">
                {otrosIntegrantes.map((p) => {
                  const estado = estadoCompanero(p.id);
                  const elegido = companeros.includes(p.id);
                  return (
                    <button key={p.id} type="button" className={elegido || estado ? "persona-chip activo" : "persona-chip"} aria-pressed={elegido || Boolean(estado)} disabled={Boolean(estado)} onClick={() => alternarCompanero(p.id)}>
                      <Avatar perfil={p} tam={24} />
                      <span>{p.nombre}</span>
                      {estado && <small>{estado}</small>}
                    </button>
                  );
                })}
              </div>
              {companeros.length > 0 && <p className="nota">Les llega una solicitud. Cuando la acepten, la comida se suma a su día y cada uno puede ajustar su porción.</p>}
            </details>
          )}

          {eligeGrupos && (
            <div className="publicar-en" role="group" aria-label="En qué grupos se publica">
              <span>Publicar en</span>
              <div className="chips-grupos">
                {misGrupos.map((g) => (
                  <button key={g.id} type="button" className={gruposElegidos.includes(g.id) ? "chip-grupo activo" : "chip-grupo"} aria-pressed={gruposElegidos.includes(g.id)} onClick={() => alternarGrupo(g.id)}>
                    <Users size={14} /> {g.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          {variosGrupos && !eligeGrupos && !original && (
            <p className="nota publicar-nota">
              Se publica en {yo.publicar_en === "actual" ? grupo.nombre : misGrupos.map((g) => g.nombre).join(" y ")}. Lo cambiás en Ajustes → Grupos.
            </p>
          )}
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

export function FilaItem({ item, onCambiar, onQuitar }) {
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

export function Resultados({ texto, onElegir, propios }) {
  const { extras, perfiles } = useDatos();
  const recetas = useMemo(
    () => [
      ...buscarRecetas(extras.recetas || [], texto).map((r) => recetaComoAlimento(r)),
      ...buscarRecetas((extras.recetasGrupo || []).filter((r) => perfiles[r.usuario_id]), texto).map((r) => recetaComoAlimento(r, perfiles[r.usuario_id].nombre)),
    ],
    [extras.recetas, extras.recetasGrupo, perfiles, texto],
  );
  const tuyos = useMemo(() => buscarEnHistorial(propios, texto), [propios, texto]);
  const locales = useMemo(() => buscarTipicos(texto), [texto]);
  const [productos, setProductos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [pedidos, setPedidos] = useState(false);
  const [falla, setFalla] = useState(false);
  const limpio = texto.trim();
  const automatico = locales.length === 0 && recetas.length === 0 && limpio.length >= 2;
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

      {recetas.length > 0 && (
        <>
          <h3 className="titulo-lista">{recetas.some((a) => a.marca !== "Tu receta") ? "Recetas" : "Tus recetas"}</h3>
          <ul className="resultados">
            {recetas.map((a) => <FilaResultado key={a.id} alimento={a} onElegir={onElegir} />)}
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
