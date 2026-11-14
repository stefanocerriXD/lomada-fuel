import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, FlaskConical, Minus, Plus, Search, X } from "lucide-react";
import { comprimirImagen } from "../lib/imagen.js";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, haceDias, nombreDia } from "../lib/fechas.js";
import { BEBIDAS_BASE, buscarTragos, TAMANOS, TRAGOS_BASE, valoresDeMezcla, vasoDe } from "../data/tragos.js";
import { Resultados } from "../vistas/NuevaComida.jsx";
import { avisarGrupo } from "../lib/api.js";
import { Avatar, Hoja, vibrar } from "./Base.jsx";

// La noche sigue siendo la misma hasta las 6 de la mañana.
export function fechaDeLaNoche(d = new Date()) {
  return d.getHours() < 6 ? haceDias(1, d) : fechaLocal(d);
}
export const esDeNoche = (d = new Date()) => d.getHours() >= 20 || d.getHours() < 6;

const numero = (n) => Math.round(n).toLocaleString("es-AR");
const MAX_FOTOS_NOCHE = 4;
const sumarVasos = (lista) => lista.reduce((t, v) => ({ kcal: t.kcal + v.kcal, p: t.p + v.p, c: t.c + v.c, g: t.g + v.g, alcohol: t.alcohol + (v.alcohol || 0) }), { kcal: 0, p: 0, c: 0, g: 0, alcohol: 0 });

// La noche se guarda primero en el celu y después se sube: sin señal en el boliche no se pierde ningún vaso.
const claveNoche = (usuarioId) => `lomada-fiesta-${usuarioId}`;
const CLAVE_TRAGO = "lomada-ultimo-trago";
const leer = (clave) => {
  try {
    return JSON.parse(localStorage.getItem(clave) || "null");
  } catch {
    return null;
  }
};
const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento, se sube directo.
  }
};

// La noche de hoy: lo del celu si todavía no se subió; si no, lo de la base.
export function nocheActual(usuarioId, comidas, fecha = fechaDeLaNoche()) {
  const local = leer(claveNoche(usuarioId));
  if (local?.fecha === fecha && local.pendiente) return local;
  const guardada = comidas.find((c) => c.usuario_id === usuarioId && c.tipo === "fiesta" && c.fecha === fecha);
  return {
    fecha,
    id: guardada?.id || (local?.fecha === fecha ? local.id : null) || null,
    vasos: guardada?.alimentos || [],
    gol: guardada?.gol ?? null,
    foto_path: guardada?.foto_path || null,
    fotos_extra: guardada?.fotos_extra || [],
    salida: guardada?.salida || null,
    salida_con: guardada?.salida_con || [],
    pendiente: false,
  };
}

// Sube la noche entera (es una sola carga que se va actualizando). Si ya existe la actualiza; si no, la crea.
// Las columnas nuevas (gol y salida) se mandan solo si la base ya las tiene.
async function subirNoche(usuarioId, noche, conGol = true) {
  const t = sumarVasos(noche.vasos);
  const fila = {
    descripcion: `Fiesta: ${noche.vasos.length} ${noche.vasos.length === 1 ? "vaso" : "vasos"}`,
    calorias: Math.round(t.kcal),
    proteinas: Math.round(t.p * 10) / 10,
    carbohidratos: Math.round(t.c * 10) / 10,
    grasas: Math.round(t.g * 10) / 10,
    alimentos: noche.vasos,
    macros_editados: false,
    foto_path: noche.foto_path || null,
    ...(noche.fotos_extra?.length || noche.habiaExtras ? { fotos_extra: noche.fotos_extra || [] } : {}),
    ...(conGol && typeof noche.gol === "boolean" ? { gol: noche.gol } : {}),
    ...(conGol && noche.salida ? { salida: noche.salida, salida_con: noche.salida_con || [] } : {}),
  };
  if (!noche.vasos.length && !noche.foto_path && typeof noche.gol !== "boolean" && !noche.salida) {
    const { error } = await supabase.from("comidas").delete().eq("id", noche.id);
    return !error;
  }
  const { data, error } = await supabase.from("comidas").update(fila).eq("id", noche.id).select("id");
  // Si la base todavía no tiene lo del gol (falta el SQL), los vasos se guardan igual.
  if (error && conGol && /gol|salida/.test(error.message || "")) return subirNoche(usuarioId, noche, false);
  if (error) return false;
  if (data?.length) return true;
  const { error: errNueva } = await supabase.from("comidas").insert({ ...fila, id: noche.id, usuario_id: usuarioId, tipo: "fiesta", fecha: noche.fecha, privada: false });
  if (errNueva && conGol && /gol|salida/.test(errNueva.message || "")) return subirNoche(usuarioId, noche, false);
  return !errNueva;
}

let subiendo = Promise.resolve(true);
// Guarda en el celu y sube; avisa si llegó a la base. Los cambios se suben de a uno, en orden.
export function guardarNoche(usuarioId, noche) {
  const conId = { ...noche, id: noche.id || crypto.randomUUID(), pendiente: true };
  escribir(claveNoche(usuarioId), conId);
  subiendo = subiendo.then(async () => {
    const actual = leer(claveNoche(usuarioId)) || conId;
    let ok = false;
    try {
      ok = await subirNoche(usuarioId, actual);
    } catch {
      ok = false;
    }
    // Solo se marca subida si mientras tanto no cambió nada más.
    if (ok && JSON.stringify(leer(claveNoche(usuarioId))) === JSON.stringify(actual)) escribir(claveNoche(usuarioId), { ...actual, pendiente: false });
    return ok;
  });
  return { noche: conId, subida: subiendo };
}

// Lo que quedó en el celu sin señal se sube apenas vuelve la conexión o se abre la app.
export async function sincronizarNoche(usuarioId) {
  const local = leer(claveNoche(usuarioId));
  if (!local?.pendiente) return false;
  return guardarNoche(usuarioId, local).subida;
}

// El último trago (y su tamaño) para seguir sumando con un toque.
export function ultimoTrago(vasos = []) {
  const v = vasos[vasos.length - 1];
  if (v?.ml) {
    const f = 100 / v.ml;
    return { nombre: v.nombre, mezcla: v.mezcla || null, ml: v.ml, por100: { kcal: v.kcal * f, p: (v.p || 0) * f, c: (v.c || 0) * f, g: (v.g || 0) * f, alcohol: (v.alcohol || 0) * f } };
  }
  const guardado = leer(CLAVE_TRAGO);
  return guardado?.por100 ? guardado : null;
}

// +1 del último trago sin abrir el modo fiesta.
export function sumarUnVaso(usuarioId, comidas) {
  const noche = nocheActual(usuarioId, comidas);
  const trago = ultimoTrago(noche.vasos);
  if (!trago) return null;
  const vasos = [...noche.vasos, { ...vasoDe(trago, trago.ml), id: crypto.randomUUID(), hora: new Date().toISOString() }];
  return { ...guardarNoche(usuarioId, { ...noche, vasos }), trago };
}

export default function Fiesta({ abierta, onCerrar, avisar }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Modo fiesta" ancha>
      {abierta && <Contador avisar={avisar} />}
    </Hoja>
  );
}

function Contador({ avisar }) {
  const { usuario, comidas, cargarComidas, fotos, perfiles } = useDatos();
  const fecha = useMemo(() => fechaDeLaNoche(), []);
  // Al abrir: lo de esta noche (del celu si quedó sin subir) y el último trago, listo para sumar otro.
  const inicio = useMemo(() => nocheActual(usuario.id, comidas, fecha), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [vasos, setVasos] = useState(inicio.vasos);
  const [gol, setGol] = useState(inicio.gol);
  // Las fotos de la noche: rutas guardadas y su vista (la primera es la principal).
  const [fotosNoche, setFotosNoche] = useState(() => [inicio.foto_path, ...(inicio.fotos_extra || [])].filter(Boolean).map((ruta) => ({ ruta, vista: fotos[ruta] })));
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [trago, setTrago] = useState(() => ultimoTrago(inicio.vasos) || TRAGOS_BASE[1]);
  const [ml, setMl] = useState(() => ultimoTrago(inicio.vasos)?.ml || TRAGOS_BASE[1].ml);
  const [texto, setTexto] = useState("");
  const [mezclando, setMezclando] = useState(false);
  const [mezcla, setMezcla] = useState([["Fernet", 30], ["Pomelo light", 70]]);
  const [sinSenal, setSinSenal] = useState(inicio.pendiente);
  const id = useRef(inicio.id);
  const estado = useRef({ vasos: inicio.vasos, gol: inicio.gol, foto_path: inicio.foto_path, fotos_extra: inicio.fotos_extra || [], habiaExtras: Boolean(inicio.fotos_extra?.length), salida: inicio.salida || null, salida_con: inicio.salida_con || [] });
  // Salida en grupo: cada uno carga sus vasos y quedan unidos por la misma salida.
  const [salida, setSalida] = useState(inicio.salida || null);
  const [invitados, setInvitados] = useState(inicio.salida_con || []);
  const otros = Object.values(perfiles).filter((p) => p.id !== usuario.id);
  const deLaSalida = salida ? comidas.filter((c) => c.tipo === "fiesta" && c.usuario_id !== usuario.id && (c.id === salida || c.salida === salida)) : [];
  const invitadosDeTodos = new Set([...invitados, ...deLaSalida.flatMap((c) => c.salida_con || [])]);
  const invitacion = !salida ? comidas.find((c) => c.tipo === "fiesta" && c.fecha === fecha && c.usuario_id !== usuario.id && (c.salida_con || []).includes(usuario.id)) : null;
  const totales = sumarVasos(vasos);
  const vaso = vasoDe(trago, ml);

  // Lo que había quedado sin subir se sube al abrir y cuando vuelve la señal.
  useEffect(() => {
    const reintentar = () => sincronizarNoche(usuario.id).then((ok) => {
      if (!ok) return;
      setSinSenal(false);
      cargarComidas().catch(() => {});
    });
    reintentar();
    window.addEventListener("online", reintentar);
    return () => window.removeEventListener("online", reintentar);
  }, [usuario.id, cargarComidas]);

  // Se guarda solo en cada cambio: primero en el celu, después en la base.
  function guardar(cambio) {
    estado.current = { ...estado.current, ...cambio };
    const { noche, subida } = guardarNoche(usuario.id, { fecha, id: id.current, ...estado.current });
    id.current = noche.id;
    subida.then((ok) => {
      setSinSenal(!ok);
      if (ok) cargarComidas().catch(() => {});
    });
    return subida;
  }

  // Sumar (o sacar) a alguien de la salida: le llega un aviso para que cargue sus vasos.
  function alternarInvitado(persona) {
    const sacar = invitados.includes(persona);
    const lista = sacar ? invitados.filter((x) => x !== persona) : [...invitados, persona];
    const idNoche = id.current || crypto.randomUUID();
    id.current = idNoche;
    const laSalida = salida || idNoche;
    setSalida(laSalida);
    setInvitados(lista);
    vibrar(10);
    guardar({ salida: laSalida, salida_con: lista }).then((ok) => { if (ok && !sacar) avisarGrupo("salida", idNoche); });
  }

  function sumarmeALaSalida() {
    const laSalida = invitacion.salida || invitacion.id;
    setSalida(laSalida);
    guardar({ salida: laSalida });
    vibrar([20, 40, 20]);
  }

  function sumar() {
    const lista = [...vasos, { ...vaso, id: crypto.randomUUID(), hora: new Date().toISOString() }];
    setVasos(lista);
    guardar({ vasos: lista });
    escribir(CLAVE_TRAGO, { ...trago, ml });
    vibrar(18);
  }

  // ¿Hubo gol? Se puede cambiar toda la noche; tocando el mismo de nuevo se borra.
  function elegirGol(valor) {
    const nuevo = gol === valor ? null : valor;
    setGol(nuevo);
    guardar({ gol: nuevo });
    vibrar(valor ? [20, 40, 20] : 12);
  }

  // Las fotos de la noche (o de los vasos): se ven en Imágenes con el cartel del gol.
  const conRutas = (lista) => ({ foto_path: lista[0]?.ruta || null, fotos_extra: lista.slice(1).map((f) => f.ruta) });
  async function sumarFotos(e) {
    const archivos = [...e.target.files].slice(0, MAX_FOTOS_NOCHE - fotosNoche.length);
    e.target.value = "";
    if (!archivos.length) return;
    setSubiendoFoto(true);
    let lista = fotosNoche;
    try {
      const idNoche = id.current || crypto.randomUUID();
      id.current = idNoche;
      for (const [n, archivo] of archivos.entries()) {
        const blob = await comprimirImagen(archivo);
        const ruta = `${usuario.id}/${idNoche}-fiesta-${Date.now()}-${n}.jpg`;
        const { error } = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        lista = [...lista, { ruta, vista: URL.createObjectURL(blob) }];
        setFotosNoche(lista);
      }
      vibrar(12);
    } catch {
      avisar?.("No se pudo subir la foto. Probá cuando tengas señal.");
    } finally {
      if (lista !== fotosNoche) guardar(conRutas(lista));
      setSubiendoFoto(false);
    }
  }

  function quitarFoto(foto) {
    const lista = fotosNoche.filter((f) => f.ruta !== foto.ruta);
    setFotosNoche(lista);
    guardar(conRutas(lista));
    supabase.storage.from("fotos").remove([foto.ruta]).catch(() => {});
  }

  function sacarUltimo() {
    const lista = vasos.slice(0, -1);
    setVasos(lista);
    guardar({ vasos: lista });
    vibrar(8);
  }

  function quitar(nombre, cuanto) {
    const i = vasos.map((v, n) => [v, n]).reverse().find(([v]) => v.nombre === nombre && v.ml === cuanto)?.[1];
    if (i === undefined) return;
    const lista = vasos.filter((_, n) => n !== i);
    setVasos(lista);
    guardar({ vasos: lista });
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
      {invitacion && (
        <div className="salida-invitacion">
          <Avatar perfil={perfiles[invitacion.usuario_id]} tam={36} />
          <span><strong>🪩 {perfiles[invitacion.usuario_id]?.nombre || "Alguien"} te sumó a su salida</strong><small>Cada uno carga sus vasos y en el grupo sale todo junto.</small></span>
          <button className="boton-chico activo" onClick={sumarmeALaSalida}>Sumarme</button>
        </div>
      )}
      {sinSenal && <p className="nota fiesta-sin-senal" role="status">Sin señal: los vasos quedan guardados en el celu y se suben solos cuando vuelva.</p>}

      <div className="sumar-fila">
        <motion.button className="boton boton-grande sumar-vaso" whileTap={{ scale: 0.95 }} onClick={sumar}>
          <Plus size={20} /> 1 {trago.nombre}
          <small>{ml} ml · {numero(vaso.kcal)} kcal{vaso.alcohol ? ` · ${numero(vaso.alcohol)} g de alcohol` : ""}</small>
        </motion.button>
        {vasos.length > 0 && (
          <motion.button className="sacar-vaso" whileTap={{ scale: 0.9 }} onClick={sacarUltimo} aria-label={`Sacar el último vaso (${vasos[vasos.length - 1].nombre})`}>
            <Minus size={20} />
            <small>Sacar el último</small>
          </motion.button>
        )}
      </div>

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


      <div className="fiesta-salida">
        {!invitacion && (
          <>
            <span className="fiesta-salida-titulo"><strong>{salida ? "🪩 Salida en grupo" : "¿Salieron juntos?"}</strong><small>Sumá a los que salieron con vos: cada uno carga sus vasos y en el grupo sale todo junto.</small></span>
            <div className="comida-grupal-lista" role="group" aria-label="Con quién saliste">
              {otros.map((p) => {
                const suya = deLaSalida.find((c) => c.usuario_id === p.id);
                const invitado = invitados.includes(p.id) || invitadosDeTodos.has(p.id);
                return (
                  <button key={p.id} type="button" className={suya || invitado ? "persona-chip activo" : "persona-chip"} aria-pressed={Boolean(suya || invitado)} disabled={Boolean(suya) || (invitado && !invitados.includes(p.id))} onClick={() => alternarInvitado(p.id)}>
                    <Avatar perfil={p} tam={24} />
                    <span>{p.nombre}</span>
                    {suya ? <small>{(suya.alimentos || []).length} {(suya.alimentos || []).length === 1 ? "vaso" : "vasos"}{suya.gol === true ? " · ⚽" : ""}</small> : invitado ? <small>Invitado</small> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="fiesta-gol">
        <span id="etiqueta-gol">¿Hubo gol? <small>(beso con chica)</small></span>
        <div className="gol-opciones" role="radiogroup" aria-labelledby="etiqueta-gol">
          <button role="radio" aria-checked={gol === true} className={gol === true ? "activo si" : ""} onClick={() => elegirGol(true)}>⚽ Sí, gol</button>
          <button role="radio" aria-checked={gol === false} className={gol === false ? "activo no" : ""} onClick={() => elegirGol(false)}>🥅 No hubo</button>
        </div>
      </div>

      <div className="fiesta-fotos">
        <span className="fiesta-fotos-titulo"><strong>Fotos de la noche</strong><small>De los vasos o del grupo, hasta {MAX_FOTOS_NOCHE}. Salen en Imágenes con si hubo gol o no.</small></span>
        <div className="fiesta-fotos-lista">
          {fotosNoche.map((f) => (
            <span key={f.ruta} className="fiesta-miniatura">
              {f.vista ? <img src={f.vista} alt="Foto de la noche" /> : <Camera size={18} />}
              <button type="button" className="quitar-foto" onClick={() => quitarFoto(f)} aria-label="Quitar esta foto"><X size={13} /></button>
            </span>
          ))}
          {fotosNoche.length < MAX_FOTOS_NOCHE && (
            <label className="fiesta-miniatura agregar">
              <input type="file" accept="image/*" multiple onChange={sumarFotos} aria-label="Sumar fotos de la noche" disabled={subiendoFoto} />
              {subiendoFoto ? <small>Subiendo…</small> : <><Camera size={20} /><small>Sumar</small></>}
            </label>
          )}
        </div>
      </div>

      <p className="nota">Cada vaso se guarda al toque y suma al total del día: cerrá y volvé a abrir cuando quieras, sigue con tu trago. Después de medianoche cuenta para la noche que empezó.</p>
    </div>
  );
}
