import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import { ChevronUp, Lock, Pencil, Reply, Star, X } from "lucide-react";
import { useFavorita } from "./Favorita.jsx";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, haceCuanto, hora } from "../lib/fechas.js";
import { sumarComidas } from "../lib/macros.js";
import { historiasDelDia } from "../lib/historias.js";
import { promedioTexto, puntajesPorComida } from "../lib/estrellas.js";
import { Avatar, BarraMacros, vibrar } from "./Base.jsx";
import IconoComida from "./IconoComida.jsx";
import DetalleAlimentos, { alimentosVisibles } from "./DetalleAlimentos.jsx";

// Historias del día, como en Instagram: un círculo por comida (desayuno, almuerzo, merienda, cena y colación).
// Adentro, lo que comió cada uno, una foto atrás de otra. Se pasan tocando, se pausan apretando,
// de costado se salta a la otra comida y hacia abajo se cierran. Cada plato se puede abrir (calorías)
// y puntuar con estrellas (SQL 068).
// Las pruebas pueden alargarlo (window.__segundosHistoria) para mirar cada una sin que pase sola.
const SEGUNDOS = () => (typeof window !== "undefined" && window.__segundosHistoria) || 6;
const CLAVE_VISTAS = "lomada-historias-vistas";
const MAXIMO_VISTAS = 800;

function leerVistas() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTAS) || "[]"));
  } catch {
    return new Set();
  }
}

// Lo que ya viste queda en este teléfono: el círculo pasa a gris.
function useVistas() {
  const [vistas, setVistas] = useState(leerVistas);
  const marcar = useCallback((clave) => {
    setVistas((prev) => {
      if (prev.has(clave)) return prev;
      const nuevas = new Set(prev);
      nuevas.add(clave);
      try {
        localStorage.setItem(CLAVE_VISTAS, JSON.stringify([...nuevas].slice(-MAXIMO_VISTAS)));
      } catch {
        // Sin almacenamiento se recuerda solo mientras la app está abierta.
      }
      return nuevas;
    });
  }, []);
  return [vistas, marcar];
}

export default function HistoriasComidas({ delDia, onEditar }) {
  const { fotos, usuario, castigo } = useDatos();
  const grupos = useMemo(() => historiasDelDia(delDia), [delDia]);
  const [vistas, marcarVista] = useVistas();
  // Al abrir se congela la lista: si alguien sube algo mientras mirás, no se corre lo que estás viendo.
  const [abierta, setAbierta] = useState(null);

  return (
    <section className="hdias" aria-label="Historias del día">
      <ul>
        {grupos.map((g, i) => {
          const vacia = !g.items.length;
          const nuevas = g.items.some((it) => !vistas.has(it.clave));
          const portada = [...g.items].reverse().find((it) => it.ruta && fotos[it.ruta]);
          const tapada = portada && portada.comida.usuario_id !== usuario.id && (castigo.diario || castigo.calavera);
          return (
            <li key={g.tipo.id}>
              <motion.button
                type="button"
                className={`hdia ${vacia ? "vacia" : nuevas ? "nueva" : "vista"}`}
                whileTap={vacia ? undefined : { scale: 0.9 }}
                aria-disabled={vacia || undefined}
                onClick={() => {
                  if (vacia) return;
                  vibrar(6);
                  setAbierta({ grupos, inicio: i });
                }}
                aria-label={vacia ? `${g.tipo.texto}: todavía nadie subió` : `${g.tipo.texto}: ${g.personas} ${g.personas === 1 ? "persona" : "personas"}${nuevas ? ", sin ver" : ""}`}
              >
                <span className="hdia-aro">
                  <span className="hdia-circulo">
                    {portada ? <img className={tapada ? "tapada" : undefined} src={fotos[portada.ruta]} alt="" loading="lazy" /> : <IconoComida tipo={g.tipo.id} size={24} />}
                  </span>
                </span>
                {g.personas > 0 && <span className="hdia-cuantos" aria-hidden="true">{g.personas}</span>}
                <span className="hdia-nombre">{g.tipo.texto}</span>
              </motion.button>
            </li>
          );
        })}
      </ul>
      <AnimatePresence>
        {abierta && <VisorHistorias key="visor" grupos={abierta.grupos} inicio={abierta.inicio} vistas={vistas} onVista={marcarVista} onCerrar={() => setAbierta(null)} onEditar={onEditar} />}
      </AnimatePresence>
    </section>
  );
}

const pasoTipo = {
  entra: (dir) => ({ x: dir > 0 ? "100%" : dir < 0 ? "-100%" : 0, opacity: dir ? 1 : 0, scale: dir ? 0.94 : 1 }),
  centro: { x: 0, opacity: 1, scale: 1 },
  sale: (dir) => ({ x: dir > 0 ? "-35%" : dir < 0 ? "35%" : 0, opacity: 0, scale: 0.9 }),
};

function VisorHistorias({ grupos, inicio, vistas, onVista, onCerrar, onEditar }) {
  const { fotos, usuario, perfiles, castigo, puntajes, puntuar, abrirPerfil, responder } = useDatos();
  const conItems = useMemo(() => grupos.map((g, i) => (g.items.length ? i : -1)).filter((i) => i >= 0), [grupos]);
  // Arranca en la primera que no viste de esa comida (si ya viste todas, desde el principio).
  const vistasAlAbrir = useRef(vistas);
  const primera = useCallback((g) => Math.max(0, grupos[g].items.findIndex((it) => !vistasAlAbrir.current.has(it.clave))), [grupos]);
  const [pos, setPos] = useState(() => ({ g: inicio, i: primera(inicio), dir: 0 }));
  const [vuelta, setVuelta] = useState(0);
  // Qué foto ya cargó (por su clave): así una que viene del caché no queda esperando.
  const [cargadaClave, setCargadaClave] = useState(null);
  const [sostenido, setSostenido] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const [oculta, setOculta] = useState(() => document.hidden);
  const [aviso, setAviso] = useState("");
  const grupo = grupos[pos.g];
  const item = grupo.items[Math.min(pos.i, grupo.items.length - 1)];
  const comida = item.comida;
  const perfil = perfiles[comida.usuario_id];
  const propia = comida.usuario_id === usuario.id;
  const url = item.ruta ? fotos[item.ruta] : null;
  const sinFotos = !propia && castigo.calavera;
  const tapada = !propia && !sinFotos && castigo.diario;
  const cargada = !item.ruta || sinFotos || cargadaClave === item.clave;
  const pausado = sostenido || detalle || oculta || !cargada;

  const { favorita, alternar: alternarFavorita, disponible: favoritaDisponible } = useFavorita(comida, setAviso);
  const porComida = useMemo(() => puntajesPorComida(puntajes || [], usuario.id), [puntajes, usuario.id]);
  const puntaje = porComida.get(comida.id) || { votos: 0, promedio: 0, mio: 0, quienes: [] };

  useEffect(() => onVista(item.clave), [item.clave, onVista]);

  // Hasta que carga la foto no corre el tiempo (si no hay link en 4 s, sigue igual).
  useEffect(() => {
    if (!item.ruta) return undefined;
    const t = setTimeout(() => setCargadaClave(item.clave), 4000);
    return () => clearTimeout(t);
  }, [item.clave, item.ruta]);

  // La que sigue se baja antes, para que pase sin espera.
  useEffect(() => {
    const sig = grupo.items[pos.i + 1] || grupos[conItems.find((x) => x > pos.g)]?.items[0];
    if (sig?.ruta && fotos[sig.ruta]) new Image().src = fotos[sig.ruta];
  }, [pos, grupo, grupos, conItems, fotos]);

  useEffect(() => {
    const ver = () => setOculta(document.hidden);
    document.addEventListener("visibilitychange", ver);
    return () => document.removeEventListener("visibilitychange", ver);
  }, []);

  // Mientras está abierto, la página de atrás no se mueve.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = antes; };
  }, []);

  const irA = (g, i, dir) => {
    setDetalle(false);
    setAviso("");
    setPos({ g, i, dir });
  };
  const otroTipo = (sentido) => {
    const g = sentido > 0 ? conItems.find((x) => x > pos.g) : [...conItems].reverse().find((x) => x < pos.g);
    if (g === undefined) return sentido > 0 ? onCerrar() : setVuelta((n) => n + 1);
    irA(g, sentido > 0 ? primera(g) : 0, sentido);
  };
  const siguiente = () => (pos.i < grupo.items.length - 1 ? irA(pos.g, pos.i + 1, 0) : otroTipo(1));
  const anterior = () => {
    if (pos.i > 0) return irA(pos.g, pos.i - 1, 0);
    const g = [...conItems].reverse().find((x) => x < pos.g);
    if (g === undefined) return setVuelta((n) => n + 1);
    irA(g, grupos[g].items.length - 1, -1);
  };
  const acciones = useRef({});
  acciones.current = { siguiente, anterior, onCerrar };

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") acciones.current.onCerrar();
      if (e.key === "ArrowRight") acciones.current.siguiente();
      if (e.key === "ArrowLeft") acciones.current.anterior();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  // Gestos: tocar a la izquierda vuelve, a la derecha avanza; apretado pausa; de costado cambia de comida; abajo cierra.
  const bajada = useMotionValue(0);
  const escala = useTransform(bajada, [0, 400], [1, 0.82]);
  const fondo = useTransform(bajada, [0, 300], [1, 0.3]);
  const toque = useRef(null);
  function alApretar(e) {
    if (e.target.closest("button, a, .historia-panel")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const t = { x: e.clientX, y: e.clientY, largo: false, movio: false };
    t.reloj = setTimeout(() => { t.largo = true; setSostenido(true); }, 200);
    toque.current = t;
  }
  function alMover(e) {
    const t = toque.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (!t.movio && Math.hypot(dx, dy) > 10) {
      t.movio = true;
      clearTimeout(t.reloj);
      setSostenido(true);
    }
    if (t.movio && dy > 0 && dy > Math.abs(dx)) bajada.set(dy);
  }
  function alSoltar(e) {
    const t = toque.current;
    if (!t) return;
    toque.current = null;
    clearTimeout(t.reloj);
    setSostenido(false);
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (dy > 110 && dy > Math.abs(dx)) return onCerrar();
    animate(bajada, 0, { type: "spring", stiffness: 420, damping: 36 });
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return otroTipo(dx < 0 ? 1 : -1);
    if (t.largo || t.movio) return;
    const caja = e.currentTarget.getBoundingClientRect();
    if (e.clientX < caja.left + caja.width * 0.3) anterior();
    else siguiente();
  }
  function alCancelar() {
    if (toque.current) clearTimeout(toque.current.reloj);
    toque.current = null;
    setSostenido(false);
    animate(bajada, 0, { type: "spring", stiffness: 420, damping: 36 });
  }

  async function ponerEstrellas(n) {
    if (castigo.activo) return setAviso("Subí tu foto de hoy para puntuar las del grupo.");
    vibrar(n === 5 ? [12, 40, 12] : 12);
    const r = await puntuar(comida.id, n);
    if (r === false) setAviso("No se pudo guardar. Probá de nuevo.");
  }

  const titulo = comida.descripcion || grupo.tipo.texto;
  const kcal = Math.round(comida.calorias || 0);

  return createPortal(
    <motion.div className="hdia-visor" role="dialog" aria-modal="true" aria-label={`Historias: ${grupo.tipo.texto}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <motion.div className="hdia-telon" style={{ opacity: fondo }} aria-hidden="true" />
      <motion.div className="hdia-escena" style={{ y: bajada, scale: escala }} initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
        <AnimatePresence initial={false} custom={pos.dir} mode="popLayout">
          <motion.div
            key={grupo.tipo.id}
            className={sostenido ? "hdia-tipo sostenida" : "hdia-tipo"}
            custom={pos.dir}
            variants={pasoTipo}
            initial="entra"
            animate="centro"
            exit="sale"
            transition={{ type: "spring", stiffness: 330, damping: 34 }}
            onPointerDown={alApretar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alCancelar}
          >
            <div className="hdia-medio">
              {item.ruta ? (
                sinFotos ? (
                  <div className="hdia-bloqueada"><Lock size={28} /><p>Dos semanas sin subir fotos. Subí la tuya para volver a verlas.</p></div>
                ) : (
                  <>
                    {url && !tapada && <div key={`f-${item.clave}`} className="hdia-fondo" style={{ backgroundImage: `url("${url}")` }} aria-hidden="true" />}
                    {url && <img key={item.clave} className={tapada ? "hdia-foto foto-castigo" : "hdia-foto"} src={url} alt={titulo} onLoad={() => setCargadaClave(item.clave)} onError={() => setCargadaClave(item.clave)} draggable={false} />}
                    {tapada && <span className="foto-castigo-texto">Subí tu foto de hoy para ver las del grupo</span>}
                  </>
                )
              ) : (
                <div className="hdia-sin-foto">
                  <span className="hdia-sin-foto-icono"><IconoComida tipo={comida.tipo} size={44} /></span>
                  <strong>{titulo}</strong>
                  <ul>
                    {alimentosVisibles(comida.alimentos).slice(0, 6).map((a, n) => <li key={n}>{a.nombre}</li>)}
                  </ul>
                </div>
              )}
              {item.postre && <span className="hdia-postre">🍮 Postre{comida.postre_nombre ? ` · ${comida.postre_nombre}` : ""}</span>}
            </div>
            <div className="hdia-sombra arriba" aria-hidden="true" />
            <div className="hdia-sombra abajo" aria-hidden="true" />

            <div className="hdia-barras" aria-hidden="true">
              {grupo.items.map((it, n) => (
                <span key={it.clave}>
                  {n < pos.i && <span className="llena" />}
                  {n === pos.i && (
                    <span
                      key={`${it.clave}-${vuelta}`}
                      className="corriendo"
                      style={{ animationDuration: `${SEGUNDOS()}s`, animationPlayState: pausado ? "paused" : "running" }}
                      onAnimationEnd={siguiente}
                    />
                  )}
                </span>
              ))}
            </div>

            <header className="hdia-cabecera">
              <button type="button" className="hdia-autor" onClick={() => { onCerrar(); abrirPerfil(comida.usuario_id); }} aria-label={`Ver perfil de ${perfil?.nombre || "Amigo"}`}>
                <Avatar perfil={perfil} tam={34} />
                <span>
                  <strong>{propia ? "Vos" : perfil?.nombre || "Amigo"}</strong>
                  <small>{grupo.tipo.texto} · {comida.fecha === fechaLocal(new Date(comida.creado_en)) ? hora(comida.creado_en) : haceCuanto(comida.creado_en)}</small>
                </span>
              </button>
              <button type="button" className="hdia-cerrar" onClick={onCerrar} aria-label="Cerrar historias"><X size={26} /></button>
            </header>

            <footer className="hdia-pie">
              {item.ruta && <p className="hdia-titulo">{titulo}</p>}
              <button type="button" className="hdia-kcal" onClick={() => { vibrar(6); setDetalle(true); }} aria-label={`Ver calorías de ${titulo}`}>
                <strong>{kcal.toLocaleString("es-AR")}</strong> kcal
                <span>P {Math.round(comida.proteinas || 0)} · C {Math.round(comida.carbohidratos || 0)} · G {Math.round(comida.grasas || 0)}</span>
                <ChevronUp size={16} aria-hidden="true" />
              </button>
              {puntajes && (
                <div className="hdia-puntaje">
                  {propia ? (
                    <button type="button" className="hdia-promedio" onClick={() => setDetalle(true)}>
                      <Star size={18} fill="currentColor" aria-hidden="true" />
                      {puntaje.votos ? <><strong>{promedioTexto(puntaje.promedio)}</strong> · {puntaje.votos} {puntaje.votos === 1 ? "voto" : "votos"}</> : "Todavía nadie lo puntuó"}
                    </button>
                  ) : (
                    <>
                      <Estrellas valor={puntaje.mio} onElegir={ponerEstrellas} etiqueta={`Puntuar ${titulo}`} />
                      <small className="hdia-votos">{puntaje.votos ? `${promedioTexto(puntaje.promedio)} · ${puntaje.votos} ${puntaje.votos === 1 ? "voto" : "votos"}` : puntaje.mio ? "" : "Puntuá el plato"}</small>
                    </>
                  )}
                </div>
              )}
              {aviso && <p className="hdia-aviso" role="status">{aviso}</p>}
              <div className="hdia-acciones">
                {propia && onEditar && (
                  <button type="button" className="hdia-responder" onClick={() => { onCerrar(); onEditar(comida); }}>
                    <Pencil size={16} /> Editar
                  </button>
                )}
                {favoritaDisponible && (
                  <button type="button" className={favorita ? "hdia-responder hdia-favorita activa" : "hdia-responder hdia-favorita"} onClick={() => { vibrar(6); alternarFavorita(); }} aria-pressed={Boolean(favorita)} aria-label={favorita ? "Sacar de favoritas" : "Guardar en favoritas"}>
                    <Star size={17} fill={favorita ? "currentColor" : "none"} />
                  </button>
                )}
                {!propia && (
                  <button type="button" className="hdia-responder" onClick={() => { responder(comida); onCerrar(); }}>
                    <Reply size={17} /> Responder en el chat
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {detalle && <PanelDetalle comida={comida} puntaje={puntaje} propia={propia} onCerrar={() => setDetalle(false)} />}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

// Las estrellas para puntuar: tocar la misma que ya pusiste la saca.
export function Estrellas({ valor = 0, onElegir, etiqueta, tam = 30 }) {
  return (
    <div className="estrellas" role="radiogroup" aria-label={etiqueta}>
      {[1, 2, 3, 4, 5].map((n) => {
        const llena = n <= valor;
        return (
          <motion.button
            key={`${n}-${llena}`}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            className={llena ? "estrella llena" : "estrella"}
            whileTap={{ scale: 0.75 }}
            initial={llena ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={llena ? { type: "spring", stiffness: 520, damping: 14, delay: (n - 1) * 0.035 } : { duration: 0.15 }}
            onClick={() => onElegir(n)}
          >
            <Star size={tam} fill={llena ? "currentColor" : "none"} strokeWidth={1.8} />
          </motion.button>
        );
      })}
    </div>
  );
}

// El plato abierto: calorías, macros, alimentos y quién lo puntuó.
function PanelDetalle({ comida, puntaje, propia, onCerrar }) {
  const { perfiles, usuario } = useDatos();
  const total = sumarComidas([comida]);
  const alimentos = alimentosVisibles(comida.alimentos);
  // Se baja arrastrando desde arriba (la lista de alimentos sigue scrolleando normal).
  const controles = useDragControls();
  return (
    <>
      <motion.div className="hdia-panel-fondo" onClick={onCerrar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true" />
      <motion.section
        className="hdia-panel"
        role="dialog"
        aria-label={`Calorías de ${comida.descripcion || "la comida"}`}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragControls={controles}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, g) => { if (g.offset.y > 90 || g.velocity.y > 500) onCerrar(); }}
      >
        <div className="hdia-panel-tirador" onPointerDown={(e) => controles.start(e)}>
          <span className="hdia-panel-asa" aria-hidden="true" />
        </div>
        <header onPointerDown={(e) => controles.start(e)}>
          <strong>{comida.descripcion || "Comida"}</strong>
          <button type="button" className="boton-icono chico" onClick={onCerrar} aria-label="Cerrar detalle"><X size={18} /></button>
        </header>
        <p className="hdia-panel-kcal"><strong>{Math.round(total.kcal).toLocaleString("es-AR")}</strong> kcal</p>
        <BarraMacros total={total} />
        {alimentos.length > 0 ? <DetalleAlimentos alimentos={comida.alimentos} autorComida={comida.usuario_id} /> : <p className="hdia-panel-nada">Sin detalle de alimentos.</p>}
        {puntaje.votos > 0 && (
          <div className="hdia-panel-votos">
            <p><Star size={15} fill="currentColor" aria-hidden="true" /> <strong>{promedioTexto(puntaje.promedio)}</strong> de 5 · {puntaje.votos} {puntaje.votos === 1 ? "voto" : "votos"}</p>
            {(propia || puntaje.quienes.length) && (
              <ul>
                {puntaje.quienes.map((q) => (
                  <li key={q.usuarioId}>
                    <Avatar perfil={perfiles[q.usuarioId]} tam={24} />
                    <span>{q.usuarioId === usuario.id ? "Vos" : perfiles[q.usuarioId]?.nombre || "Alguien"}</span>
                    <span className="hdia-panel-estrellas" aria-label={`${q.estrellas} de 5`}>{"★".repeat(q.estrellas)}<i>{"★".repeat(5 - q.estrellas)}</i></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.section>
    </>
  );
}
