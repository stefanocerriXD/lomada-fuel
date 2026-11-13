import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Award, ChevronRight, Droplets, Flame, List, Moon, Sparkles, Target, TrendingUp, Utensils, X } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { calcularPlan } from "../lib/cuerpo.js";
import { armarInforme, semanaDelInforme } from "../lib/informe.js";
import { fechaLocal, nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Hoja, Numero, vibrar } from "./Base.jsx";

export const EVENTO_INFORME = "lomada:informe";
// Se puede usar directo como onClick: lo que no sea "lista" abre la presentación.
export const abrirInforme = (modo) => window.dispatchEvent(new CustomEvent(EVENTO_INFORME, { detail: { modo: modo === "lista" ? "lista" : "historia" } }));

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const miles = (n) => Math.round(n).toLocaleString("es-AR");
const fechaCorta = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
const fechaLarga = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const diaSemana = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" }).replace(",", "");
const horaTexto = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const SEGUNDOS_POR_PANTALLA = 6.5;
const CLAVE_CERRADO = "lomada-informe-cerrado";

// El cartel y la presentación: el domingo y el lunes.
export function informeListo(ahora = new Date()) {
  return ahora.getDay() === 0 || ahora.getDay() === 1;
}

const leerCerrado = () => { try { return localStorage.getItem(CLAVE_CERRADO); } catch { return null; } };

function useInforme(activo) {
  const { usuario, yo, comidas, perfiles, salud, extras } = useDatos();
  return useMemo(() => {
    if (!activo) return null;
    const plan = salud ? calcularPlan(salud) : null;
    return armarInforme({ comidas, usuarioId: usuario.id, meta: yo.meta_calorias, metaProteina: plan?.proteinas || null, agua: extras.agua, perfiles });
  }, [activo, comidas, usuario.id, yo.meta_calorias, salud, extras.agua, perfiles]);
}

// ---------- El cartel anclado arriba del resumen ----------
export function CartelInforme() {
  const { hasta } = semanaDelInforme(fechaLocal());
  const [cerrado, setCerrado] = useState(() => leerCerrado() === hasta);
  const visible = informeListo() && !cerrado;
  const informe = useInforme(visible);

  function cerrar(e) {
    e.stopPropagation();
    vibrar(8);
    setCerrado(true);
    try { localStorage.setItem(CLAVE_CERRADO, hasta); } catch { /* opcional */ }
  }

  return (
    <AnimatePresence initial>
      {visible && informe && (
        <motion.div
          className="cartel-informe-marco"
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <motion.button className="cartel-informe" onClick={() => { vibrar(10); abrirInforme(); }} whileTap={{ scale: 0.97 }} aria-label="Ver tu informe semanal">
            <span className="cartel-brillo" aria-hidden="true" />
            <span className="cartel-chispas" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ "--i": i }} />)}</span>
            <span className="cartel-logo" aria-hidden="true">
              <span className="cartel-pulso" />
              <img src="/lomada.svg" alt="" width="40" height="40" />
            </span>
            <span className="cartel-texto">
              <small>Informe semanal</small>
              <strong>Tu semana está lista</strong>
              <span>
                {fechaCorta(informe.desde)} al {fechaCorta(informe.hasta)}
                {informe.actual.dias ? ` · ${miles(informe.actual.kcal)} kcal de promedio` : " · tocá para verla"}
              </span>
            </span>
            <span className="cartel-flecha" aria-hidden="true"><ChevronRight size={20} /></span>
          </motion.button>
          <button className="cartel-cerrar" onClick={cerrar} aria-label="Cerrar el cartel del informe"><X size={16} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Presentación (historias) y lista completa ----------
export default function InformeSemanal({ abiertoAlInicio = false }) {
  const [modo, setModo] = useState(abiertoAlInicio ? "historia" : null);
  useEffect(() => {
    const abrir = (e) => setModo(e.detail?.modo || "historia");
    window.addEventListener(EVENTO_INFORME, abrir);
    return () => window.removeEventListener(EVENTO_INFORME, abrir);
  }, []);
  const informe = useInforme(Boolean(modo));

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {modo === "historia" && informe && (
            <Historia key="historia" informe={informe} onCerrar={() => setModo(null)} onLista={() => setModo("lista")} />
          )}
        </AnimatePresence>,
        document.body,
      )}
      <Hoja abierta={modo === "lista"} onCerrar={() => setModo(null)} titulo="Tu semana" ancha>
        {modo === "lista" && informe && <Contenido informe={informe} />}
      </Hoja>
    </>
  );
}

// Un número que sube desde cero al aparecer.
function Contador({ valor, decimales = 0 }) {
  const quieto = useReducedMotion();
  const [visible, setVisible] = useState(quieto ? valor : 0);
  useEffect(() => {
    if (quieto) return setVisible(valor);
    const control = animate(0, valor, { duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1], onUpdate: setVisible });
    return () => control.stop();
  }, [valor, quieto]);
  return <>{Number(visible).toLocaleString("es-AR", { maximumFractionDigits: decimales, minimumFractionDigits: decimales })}</>;
}

const aparecer = (i = 0) => ({ initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.12 + i * 0.09, type: "spring", stiffness: 220, damping: 22 } });

function pantallasDe(i, nombre) {
  const lista = [{ id: "portada", fondo: "verde" }];
  if (!i.actual.dias) return [...lista, { id: "vacia", fondo: "azul" }, { id: "cierre", fondo: "noche" }];
  lista.push({ id: "calorias", fondo: "azul" }, { id: "dias", fondo: "verde" }, { id: "macros", fondo: "noche" });
  if (i.bien.length) lista.push({ id: "bien", fondo: "verde" });
  if (i.mejorar.length) lista.push({ id: "mejorar", fondo: "naranja" });
  if (i.comidaTop || i.favorito || i.horaCena !== null || i.aguaPromedio > 0 || (i.finde > 0 && i.habiles > 0)) lista.push({ id: "datos", fondo: "azul" });
  lista.push({ id: "constancia", fondo: "noche" }, { id: "cierre", fondo: "verde" });
  return lista.map((p) => ({ ...p, nombre }));
}

function Historia({ informe: i, onCerrar, onLista }) {
  const { yo } = useDatos();
  const pantallas = useMemo(() => pantallasDe(i, yo.nombre), [i, yo.nombre]);
  const [indice, setIndice] = useState(0);
  const [avance, setAvance] = useState(0);
  const [pausa, setPausa] = useState(false);
  const [sentido, setSentido] = useState(1);
  const sostener = useRef(null);
  const sostenido = useRef(false);
  const ultima = indice === pantallas.length - 1;

  const ir = useCallback((n) => {
    setIndice((actual) => {
      const nuevo = Math.max(0, Math.min(pantallas.length - 1, actual + n));
      if (nuevo !== actual) { setSentido(n); setAvance(0); vibrar(5); }
      return nuevo;
    });
  }, [pantallas.length]);

  // Avanza sola; manteniendo apretado se pausa. La última queda quieta.
  useEffect(() => {
    if (pausa || ultima) return undefined;
    let cuadro;
    let previo = performance.now();
    const paso = (t) => {
      const dt = t - previo;
      previo = t;
      setAvance((a) => Math.min(1, a + dt / (SEGUNDOS_POR_PANTALLA * 1000)));
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [pausa, ultima, indice]);
  useEffect(() => { if (avance >= 1 && !ultima) ir(1); }, [avance, ultima, ir]);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  }, [ir, onCerrar]);

  function alApretar() {
    sostenido.current = false;
    sostener.current = setTimeout(() => { sostenido.current = true; setPausa(true); }, 220);
  }
  function alSoltar(e) {
    clearTimeout(sostener.current);
    if (sostenido.current) { setPausa(false); return; }
    const ancho = e.currentTarget.getBoundingClientRect();
    if (e.clientX - ancho.left < ancho.width * 0.32) ir(-1);
    else ir(1);
  }

  const p = pantallas[indice];
  return (
    <motion.div
      className={`historia fondo-${p.fondo}`}
      role="dialog"
      aria-modal="true"
      aria-label="Tu informe semanal"
      initial={{ opacity: 0, scale: 0.92, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 40 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="historia-fondo" aria-hidden="true"><i /><i /><i /></div>
      <header className="historia-cabecera">
        <div className="historia-barras" aria-hidden="true">
          {pantallas.map((x, n) => (
            <span key={x.id}><i style={{ transform: `scaleX(${n < indice ? 1 : n === indice ? (ultima ? 1 : avance) : 0})` }} /></span>
          ))}
        </div>
        <div className="historia-marca">
          <img src="/lomada.svg" alt="" width="26" height="26" />
          <span><strong>Lomada Fuel</strong><small>Informe semanal · {fechaCorta(i.desde)} al {fechaCorta(i.hasta)}</small></span>
          <button className="historia-cerrar" onClick={onCerrar} aria-label="Cerrar el informe"><X size={22} /></button>
        </div>
      </header>

      <div className="historia-toque" onPointerDown={alApretar} onPointerUp={alSoltar} onPointerCancel={() => { clearTimeout(sostener.current); setPausa(false); }}>
        <AnimatePresence mode="wait" custom={sentido}>
          <motion.section
            key={p.id}
            className="historia-pantalla"
            custom={sentido}
            initial={{ opacity: 0, x: sentido * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: sentido * -40 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Pantalla id={p.id} i={i} nombre={p.nombre} onCerrar={onCerrar} onLista={onLista} />
          </motion.section>
        </AnimatePresence>
      </div>
      {pausa && <p className="historia-pausa" aria-live="polite">En pausa</p>}
    </motion.div>
  );
}

function Pantalla({ id, i, nombre, onCerrar, onLista }) {
  const techo = Math.max(...i.porDia.map((d) => d.kcal), i.meta || 0, 1) * 1.08;
  const dif = i.previo.dias ? Math.round(i.actual.kcal - i.previo.kcal) : null;

  if (id === "portada") {
    return (
      <div className="hp hp-portada">
        <motion.img className="hp-logo" src="/lomada.svg" alt="" initial={{ scale: 0.4, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }} />
        <motion.p className="hp-chico" {...aparecer(1)}>{nombre}, esta fue</motion.p>
        <motion.h2 className="hp-titulo" {...aparecer(2)}>Tu semana</motion.h2>
        <motion.p className="hp-sub" {...aparecer(3)}>Del {fechaLarga(i.desde)} al {fechaLarga(i.hasta)}</motion.p>
        {i.actual.dias > 0 && <motion.p className="hp-pildora" {...aparecer(4)}>{i.actual.dias} de 7 días cargados</motion.p>}
        <motion.p className="hp-ayuda" {...aparecer(6)}>Tocá para avanzar · mantené apretado para pausar</motion.p>
      </div>
    );
  }
  if (id === "vacia") {
    return (
      <div className="hp">
        <motion.span className="hp-emoji" {...aparecer(0)}>🫥</motion.span>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>No cargaste comidas esta semana</motion.h2>
        <motion.p className="hp-sub" {...aparecer(2)}>Cuando cargues, acá vas a ver tus promedios, tu mejor día y cómo vas contra la semana anterior.</motion.p>
      </div>
    );
  }
  if (id === "calorias") {
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}><Flame size={16} /> Comiste en promedio</motion.p>
        <motion.p className="hp-numero" {...aparecer(1)}><Contador valor={i.actual.kcal} /><small>kcal por día</small></motion.p>
        {i.meta ? (
          <motion.div className="hp-meta" {...aparecer(2)}>
            <div className="hp-meta-barra"><motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (i.actual.kcal / i.meta) * 100)}%` }} transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }} /></div>
            <span>Tu meta: {miles(i.meta)} kcal · {i.enMeta ? `${i.enMeta} ${i.enMeta === 1 ? "día" : "días"} en meta` : "ningún día en meta"}</span>
          </motion.div>
        ) : null}
        {dif !== null && (
          <motion.p className="hp-pildora" {...aparecer(3)}>
            {dif === 0 ? "Igual que la semana pasada" : <>{dif > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} {dif > 0 ? "+" : "−"}{miles(Math.abs(dif))} kcal contra la semana pasada</>}
          </motion.p>
        )}
      </div>
    );
  }
  if (id === "dias") {
    const mejor = i.mejorDia ? DIAS_LARGOS[i.porDia.findIndex((d) => d.fecha === i.mejorDia.fecha)] : null;
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}>Día por día</motion.p>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>{mejor ? <>Tu mejor día fue el <em>{mejor}</em></> : "Así fue tu semana"}</motion.h2>
        <div className="hp-barras">
          {i.porDia.map((d, n) => (
            <div key={d.fecha} className={`${d.kcal ? "" : "sin-datos"}${i.mejorDia?.fecha === d.fecha ? " mejor" : ""}`}>
              <small>{d.kcal ? miles(d.kcal) : "–"}</small>
              <motion.i initial={{ height: 0 }} animate={{ height: `${Math.max(3, (d.kcal / techo) * 100)}%` }} transition={{ delay: 0.3 + n * 0.08, type: "spring", stiffness: 140, damping: 18 }} />
              <span>{DIAS[n]}</span>
            </div>
          ))}
        </div>
        {i.diaPesado && i.diaPesado.fecha !== i.mejorDia?.fecha && (
          <motion.p className="hp-sub" {...aparecer(5)}>El más pesado: {nombreDia(i.diaPesado.fecha)}, {miles(i.diaPesado.kcal)} kcal</motion.p>
        )}
      </div>
    );
  }
  if (id === "macros") {
    const filas = [["Proteínas", "p", i.actual.p, i.metaProteina], ["Carbos", "c", i.actual.c], ["Grasas", "g", i.actual.g]];
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}>Tus macros por día</motion.p>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>{i.metaProteina ? (i.actual.p >= i.metaProteina * 0.95 ? "La proteína, al día 💪" : "Te faltó un poco de proteína") : "Así repartiste las calorías"}</motion.h2>
        <div className="hp-macros">
          {filas.map(([texto, k, valor, meta], n) => (
            <motion.div key={k} className={`hp-macro macro-${k}`} {...aparecer(2 + n)}>
              <span>{texto}</span>
              <strong><Contador valor={valor} /> g</strong>
              <div className="hp-macro-barra"><motion.i initial={{ width: 0 }} animate={{ width: `${i.reparto[k]}%` }} transition={{ delay: 0.5 + n * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} /></div>
              <small>{i.reparto[k]}% de las kcal{meta ? ` · meta ${meta} g` : ""}</small>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }
  if (id === "bien" || id === "mejorar") {
    const lista = id === "bien" ? i.bien : i.mejorar;
    return (
      <div className="hp">
        <motion.span className="hp-emoji" {...aparecer(0)}>{id === "bien" ? "🏆" : "🎯"}</motion.span>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>{id === "bien" ? "Lo mejor de tu semana" : "Para la próxima"}</motion.h2>
        <ul className="hp-lista">
          {lista.map((t, n) => <motion.li key={t} {...aparecer(2 + n)}>{id === "bien" ? <Sparkles size={17} /> : <Target size={17} />}<span>{t}</span></motion.li>)}
        </ul>
      </div>
    );
  }
  if (id === "datos") {
    const datos = [
      i.comidaTop && [Utensils, "La comida más grande", `${i.comidaTop.descripcion || tipoInfo(i.comidaTop.tipo).texto}: ${miles(i.comidaTop.calorias)} kcal (${tipoInfo(i.comidaTop.tipo).texto.toLowerCase()} del ${diaSemana(i.comidaTop.fecha)})`],
      i.favorito && [Sparkles, "Lo que más se repitió", `${i.favorito.nombre}, ${i.favorito.veces} veces`],
      i.finde > 0 && i.habiles > 0 && [TrendingUp, "Finde contra semana", `${miles(i.finde)} kcal por día el finde y ${miles(i.habiles)} de lunes a viernes`],
      i.horaCena !== null && [Moon, "La cena", `La subís a las ${horaTexto(i.horaCena)} en promedio`],
      i.aguaPromedio > 0 && [Droplets, "Agua", `${(i.aguaPromedio / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} L por día`],
    ].filter(Boolean);
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}>Datos de la semana</motion.p>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>Lo que dicen tus platos</motion.h2>
        <ul className="hp-datos">
          {datos.map(([Icono, titulo, texto], n) => (
            <motion.li key={titulo} {...aparecer(2 + n)}><span><Icono size={18} /></span><span><strong>{titulo}</strong><small>{texto}</small></span></motion.li>
          ))}
        </ul>
      </div>
    );
  }
  if (id === "constancia") {
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}><Award size={16} /> Constancia</motion.p>
        {i.integrantes > 1 && i.puesto > 0 ? (
          <motion.p className="hp-numero" {...aparecer(1)}>#{i.puesto}<small>de {i.integrantes} en el grupo</small></motion.p>
        ) : (
          <motion.p className="hp-numero" {...aparecer(1)}><Contador valor={i.actual.dias} /><small>de 7 días cargados</small></motion.p>
        )}
        <div className="hp-tres">
          {[["Comidas", i.platos], ["Fotos", i.fotos], ["Desayunos", i.conDesayuno]].map(([t, v], n) => (
            <motion.div key={t} {...aparecer(2 + n)}><strong><Contador valor={v} /></strong><small>{t}</small></motion.div>
          ))}
        </div>
      </div>
    );
  }
  // Cierre
  return (
    <div className="hp hp-portada">
      <motion.img className="hp-logo" src="/lomada.svg" alt="" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} />
      <motion.h2 className="hp-titulo" {...aparecer(1)}>¡A romperla esta semana!</motion.h2>
      <motion.p className="hp-sub" {...aparecer(2)}>Son estimaciones para llevar la cuenta entre amigos. No reemplazan a un profesional de la nutrición.</motion.p>
      <motion.div className="hp-botones" {...aparecer(3)} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button className="hp-boton" onClick={onLista}><List size={18} /> Ver todo en una lista</button>
        <button className="hp-boton claro" onClick={onCerrar}>Listo</button>
      </motion.div>
    </div>
  );
}

// ---------- Lista completa (la de antes) ----------
function Cambio({ ahora, antes, unidad }) {
  if (!antes) return null;
  const dif = Math.round(ahora - antes);
  if (!dif) return <small className="informe-cambio igual">igual que la semana pasada</small>;
  const Icono = dif > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <small className="informe-cambio">
      <Icono size={13} aria-hidden="true" /> {dif > 0 ? "+" : "−"}{miles(Math.abs(dif))} {unidad} vs. semana pasada
    </small>
  );
}

function Contenido({ informe: i }) {
  const techo = Math.max(...i.porDia.map((d) => d.kcal), i.meta || 0, 1) * 1.1;
  if (!i.actual.dias) {
    return (
      <div className="informe">
        <p className="informe-rango">{fechaCorta(i.desde)} al {fechaCorta(i.hasta)}</p>
        <p className="ajuste-texto">No cargaste comidas esta semana. Cuando cargues, acá vas a ver tus promedios, tu mejor día y cómo vas contra la semana anterior.</p>
      </div>
    );
  }
  return (
    <div className="informe">
      <p className="informe-rango">{fechaCorta(i.desde)} al {fechaCorta(i.hasta)} · {i.actual.dias} de 7 días cargados</p>

      <section className="informe-heroe">
        <span className="informe-etiqueta"><Flame size={15} aria-hidden="true" /> Promedio por día</span>
        <strong className="informe-numero"><Numero valor={i.actual.kcal} /> <small>kcal</small></strong>
        {i.meta ? <small className="informe-meta">Meta {miles(i.meta)} kcal · {i.enMeta ? `${i.enMeta} ${i.enMeta === 1 ? "día" : "días"} en meta` : "ningún día en meta"}</small> : null}
        <Cambio ahora={i.actual.kcal} antes={i.previo.dias ? i.previo.kcal : 0} unidad="kcal" />
      </section>

      <section className="informe-barras" aria-label="Calorías de cada día">
        {i.porDia.map((d, n) => (
          <span key={d.fecha} className={`informe-dia${d.kcal === 0 ? " sin-datos" : ""}${i.mejorDia?.fecha === d.fecha ? " mejor" : ""}`} title={`${nombreDia(d.fecha)}: ${miles(d.kcal)} kcal`}>
            <motion.i initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: n * 0.05, duration: 0.4 }} style={{ height: Math.max(4, Math.round((d.kcal / techo) * 92)) }} />
            <small>{DIAS[n]}</small>
          </span>
        ))}
      </section>

      <section className="informe-macros">
        {[["Proteínas", "p", i.actual.p, i.previo.p, i.metaProteina], ["Carbos", "c", i.actual.c, i.previo.c], ["Grasas", "g", i.actual.g, i.previo.g]].map(([nombre, k, valor, antes, meta]) => (
          <div key={k} className={`informe-macro macro-${k}`}>
            <span>{nombre}</span>
            <strong>{valor} g</strong>
            <small>{i.reparto[k]}% de las kcal{meta ? ` · meta ${meta} g` : ""}</small>
            {i.previo.dias ? <small className="informe-cambio">{valor - antes >= 0 ? "+" : "−"}{Math.abs(valor - antes)} g</small> : null}
          </div>
        ))}
      </section>

      {(i.bien.length > 0 || i.mejorar.length > 0) && (
        <section className="informe-veredicto">
          {i.bien.length > 0 && (
            <div>
              <h3><Sparkles size={16} aria-hidden="true" /> Lo mejor</h3>
              <ul>{i.bien.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          {i.mejorar.length > 0 && (
            <div>
              <h3><Target size={16} aria-hidden="true" /> Para la próxima</h3>
              <ul>{i.mejorar.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="informe-datos">
        {i.mejorDia && <Dato icono={Award} titulo="Tu mejor día" texto={`${nombreDia(i.mejorDia.fecha)}: ${miles(i.mejorDia.kcal)} kcal, el más cerca de tu meta`} />}
        {i.diaPesado && i.diaPesado.fecha !== i.mejorDia?.fecha && <Dato icono={TrendingUp} titulo="El día más pesado" texto={`${nombreDia(i.diaPesado.fecha)}: ${miles(i.diaPesado.kcal)} kcal`} />}
        {i.comidaTop && <Dato icono={Utensils} titulo="La comida más grande" texto={`${i.comidaTop.descripcion || tipoInfo(i.comidaTop.tipo).texto} (${tipoInfo(i.comidaTop.tipo).texto.toLowerCase()} del ${diaSemana(i.comidaTop.fecha)}): ${miles(i.comidaTop.calorias)} kcal`} />}
        {i.favorito && <Dato icono={Sparkles} titulo="Lo que más se repitió" texto={`${i.favorito.nombre}, ${i.favorito.veces} veces`} />}
        {i.finde > 0 && i.habiles > 0 && <Dato icono={Flame} titulo="Finde contra semana" texto={`${miles(i.finde)} kcal por día el finde y ${miles(i.habiles)} de lunes a viernes`} />}
        {i.horaCena !== null && <Dato icono={Moon} titulo="La cena" texto={`La subís a las ${horaTexto(i.horaCena)} en promedio`} />}
        {i.aguaPromedio > 0 && <Dato icono={Droplets} titulo="Agua" texto={`${(i.aguaPromedio / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} L por día`} />}
        <Dato icono={Utensils} titulo="Comidas y fotos" texto={`${i.platos} comidas cargadas y ${i.fotos} ${i.fotos === 1 ? "foto" : "fotos"} · desayunaste ${i.conDesayuno} de 7 días`} />
        {i.integrantes > 1 && i.puesto > 0 && <Dato icono={Award} titulo="Constancia en el grupo" texto={`Puesto ${i.puesto} de ${i.integrantes}`} />}
      </section>
      <p className="nota">Son estimaciones para llevar la cuenta entre amigos. No reemplazan a un profesional de la nutrición.</p>
    </div>
  );
}

function Dato({ icono: Icono, titulo, texto }) {
  return (
    <div className="informe-dato">
      <span className="informe-dato-icono"><Icono size={17} aria-hidden="true" /></span>
      <span><strong>{titulo}</strong><small>{texto}</small></span>
    </div>
  );
}
