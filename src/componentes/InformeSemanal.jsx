import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Award, ChefHat, ChevronRight, Crown, Droplets, Flame, List, Moon, Sparkles, Star, Target, TrendingUp, Users, Utensils, X } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { calcularPlan } from "../lib/cuerpo.js";
import { armarInforme, semanaDelInforme } from "../lib/informe.js";
import { contraMeta } from "../lib/metaMacro.js";
import { fechaLocal, nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { MIN_PLATOS_CHEF, promedioTexto } from "../lib/estrellas.js";
import { Avatar, Hoja, Numero, vibrar } from "./Base.jsx";
import Logo from "./Logo.jsx";
import { musiquita } from "../lib/sonidos.js";

import { EVENTO_INFORME, useInforme, miles, fechaCorta } from "./CartelInforme.jsx";

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const fechaLarga = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const diaSemana = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" }).replace(",", "");
const horaTexto = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
const SEGUNDOS_POR_PANTALLA = 6.5;

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
  lista.push({ id: "constancia", fondo: "noche" });
  // Las estrellas de la semana: las tuyas y las del grupo (solo si alguien puntuó).
  if (i.estrellas) lista.push({ id: "estrellas", fondo: "naranja" }, { id: "estrellas-grupo", fondo: "azul" });
  lista.push({ id: "cierre", fondo: "verde" });
  return lista.map((p) => ({ ...p, nombre }));
}

function Historia({ informe: i, onCerrar, onLista }) {
  const { yo } = useDatos();
  useEffect(() => { musiquita(); }, []);
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
          <Logo tam={30} />
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
        <motion.span className="hp-logo" initial={{ scale: 0.4, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}><Logo tam={112} /></motion.span>
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
    const filas = [["Proteínas", "p", i.actual.p], ["Carbos", "c", i.actual.c], ["Grasas", "g", i.actual.g]];
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}>Tus macros por día</motion.p>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>{i.metaProteina ? (i.actual.p >= i.metaProteina * 0.95 ? "La proteína, al día 💪" : "Te faltó un poco de proteína") : "Así repartiste las calorías"}</motion.h2>
        <div className="hp-macros">
          {filas.map(([texto, k, valor], n) => {
            // Con meta: la barra se llena hasta la meta y dice cuánto faltó o cuánto te pasaste. Sin plan, el reparto de las kcal.
            const c = contraMeta(valor, i.metas?.[k]);
            return (
              <motion.div key={k} className={`hp-macro macro-${k}${c ? ` ${c.estado}` : ""}`} {...aparecer(2 + n)}>
                <span>{texto}</span>
                <strong><Contador valor={valor} /> g</strong>
                <div className="hp-macro-barra"><motion.i initial={{ width: 0 }} animate={{ width: `${c ? c.lleno : i.reparto[k]}%` }} transition={{ delay: 0.5 + n * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} /></div>
                <small>{c ? <><b className="hp-macro-estado">{c.texto}</b> · {i.reparto[k]}% de las kcal</> : `${i.reparto[k]}% de las kcal`}</small>
              </motion.div>
            );
          })}
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
  if (id === "estrellas") {
    const e = i.estrellas;
    const m = e.mias;
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}><Star size={16} fill="currentColor" /> Tus estrellas</motion.p>
        {m ? (
          <>
            <motion.p className="hp-numero" {...aparecer(1)}><Contador valor={m.promedio} decimales={1} /><small>de promedio · {m.votos} {m.votos === 1 ? "voto" : "votos"} del grupo</small></motion.p>
            <motion.div {...aparecer(2)}><Estrellitas valor={m.promedio} /></motion.div>
          </>
        ) : (
          <motion.h2 className="hp-titulo chico" {...aparecer(1)}>Esta semana nadie puntuó tus platos</motion.h2>
        )}
        {e.soyChef ? (
          <motion.p className="hp-pildora" {...aparecer(3)}><Crown size={16} /> Sos el chef de la semana</motion.p>
        ) : e.puesto > 0 && e.personas.length > 1 ? (
          <motion.p className="hp-pildora" {...aparecer(3)}>#{e.puesto} de {e.personas.length} en las estrellas del grupo</motion.p>
        ) : null}
        <div className="hp-tres">
          {[["Platos puntuados", m?.platos || 0], ["Platos perfectos", m?.cincos || 0], ["Votos que diste", e.diste]].map(([t, v], n) => (
            <motion.div key={t} {...aparecer(4 + n)}><strong><Contador valor={v} /></strong><small>{t}</small></motion.div>
          ))}
        </div>
        {m?.mejor && (
          <motion.p className="hp-sub" {...aparecer(7)}>Tu mejor plato: {m.mejor.comida.descripcion || tipoInfo(m.mejor.comida.tipo).texto}, {promedioTexto(m.mejor.promedio)} con {m.mejor.votos} {m.mejor.votos === 1 ? "voto" : "votos"}</motion.p>
        )}
        {!m && <motion.p className="hp-sub" {...aparecer(7)}>Subí fotos de tus platos: el grupo los puntúa desde las historias del Resumen.</motion.p>}
      </div>
    );
  }
  if (id === "estrellas-grupo") {
    const e = i.estrellas;
    const g = e.grupo;
    const filas = rankingCorto(e);
    return (
      <div className="hp">
        <motion.p className="hp-chico" {...aparecer(0)}><Users size={16} /> Las estrellas del grupo</motion.p>
        <motion.h2 className="hp-titulo chico" {...aparecer(1)}>
          {e.chefs.length ? <>{e.chefs.length > 1 ? "Chefs" : "Chef"} de la semana: <em>{e.chefs.map((c) => (c.perfil.id === e.yoId ? "vos" : c.perfil.nombre)).join(" y ")}</em></> : "Esta semana nadie llegó a chef"}
        </motion.h2>
        {e.plato && (
          <motion.p className="hp-pildora" {...aparecer(2)}><ChefHat size={16} /> Plato de la semana: {e.plato.comida.descripcion || tipoInfo(e.plato.comida.tipo).texto} · {promedioTexto(e.plato.promedio)}</motion.p>
        )}
        <ol className="hp-ranking">
          {filas.map(({ p, lugar }, n) => (
            <motion.li key={p.perfil.id} className={p.perfil.id === e.yoId ? "yo" : ""} {...aparecer(3 + n)}>
              <span className="lugar">{lugar}</span>
              <span className="datos"><strong>{p.perfil.id === e.yoId ? "Vos" : p.perfil.nombre}</strong><small>{p.platos} {p.platos === 1 ? "plato" : "platos"} · {p.votos} {p.votos === 1 ? "voto" : "votos"}</small></span>
              <span className="promedio"><Star size={15} fill="currentColor" aria-hidden="true" /> {promedioTexto(p.promedio)}</span>
            </motion.li>
          ))}
        </ol>
        {e.personas[0] && !e.chefs.includes(e.personas[0]) && <motion.p className="hp-sub chica" {...aparecer(3 + filas.length)}>Para ser chef hay que tener al menos {MIN_PLATOS_CHEF} platos puntuados.</motion.p>}
        <div className="hp-tres">
          {[["Votos", <Contador key="v" valor={g.votos} />], ["Promedio", promedioTexto(g.promedio)], ["Perfectos", <Contador key="c" valor={g.perfectos} />]].map(([t, v], n) => (
            <motion.div key={t} {...aparecer(4 + filas.length + n)}><strong>{v}</strong><small>{t}</small></motion.div>
          ))}
        </div>
      </div>
    );
  }
  // Cierre
  return (
    <div className="hp hp-portada">
      <motion.span className="hp-logo" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }}><Logo tam={112} /></motion.span>
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
        {[["Proteínas", "p", i.actual.p, i.previo.p], ["Carbos", "c", i.actual.c, i.previo.c], ["Grasas", "g", i.actual.g, i.previo.g]].map(([nombre, k, valor, antes]) => {
          const c = contraMeta(valor, i.metas?.[k]);
          return (
          <div key={k} className={`informe-macro macro-${k}${c ? ` ${c.estado}` : ""}`}>
            <span>{nombre}</span>
            <strong>{valor} g</strong>
            {c && <div className="informe-macro-barra" aria-hidden="true"><i style={{ width: `${c.lleno}%` }} /></div>}
            <small>{c ? <b className="informe-macro-estado">{c.texto}</b> : `${i.reparto[k]}% de las kcal`}</small>
            {i.previo.dias ? <small className="informe-cambio">{valor - antes >= 0 ? "+" : "−"}{Math.abs(valor - antes)} g</small> : null}
          </div>
          );
        })}
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
      {i.estrellas && <EstrellasLista e={i.estrellas} />}
      <p className="nota">Son estimaciones para llevar la cuenta entre amigos. No reemplazan a un profesional de la nutrición.</p>
    </div>
  );
}

// Cinco estrellas pintadas hasta el promedio (4,3 pinta cuatro y un tercio).
function Estrellitas({ valor }) {
  const llenas = [0, 1, 2, 3, 4].map((n) => <Star key={n} size={30} fill="currentColor" strokeWidth={0} />);
  return (
    <span className="hp-estrellitas" role="img" aria-label={`${promedioTexto(valor)} de 5 estrellas`}>
      <span className="vacias">{llenas}</span>
      <motion.span className="llenas" initial={{ width: 0 }} animate={{ width: `${(valor / 5) * 100}%` }} transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}>{llenas}</motion.span>
    </span>
  );
}

// La tabla del grupo: los primeros 5, y si quedaste afuera, vos con tu puesto.
function rankingCorto(e) {
  const filas = e.personas.map((p, n) => ({ p, lugar: n + 1 }));
  const arriba = filas.slice(0, 5);
  const mia = filas.find((f) => f.p.perfil.id === e.yoId);
  return mia && !arriba.includes(mia) ? [...arriba.slice(0, 4), mia] : arriba;
}

function EstrellasLista({ e }) {
  const m = e.mias;
  const g = e.grupo;
  const plato = e.plato;
  return (
    <section className="informe-estrellas" aria-label="Estrellas de la semana">
      <h3><Star size={16} fill="currentColor" aria-hidden="true" /> Estrellas</h3>
      <Dato
        icono={Star}
        titulo="Tus estrellas"
        texto={m ? `${promedioTexto(m.promedio)} de promedio con ${m.votos} ${m.votos === 1 ? "voto" : "votos"} en ${m.platos} ${m.platos === 1 ? "plato" : "platos"}${m.cincos ? ` · ${m.cincos} ${m.cincos === 1 ? "plato perfecto" : "platos perfectos"}` : ""}${e.puesto ? ` · puesto ${e.puesto} de ${e.personas.length}` : ""}` : "Nadie puntuó tus platos esta semana"}
      />
      {m?.mejor && <Dato icono={Award} titulo="Tu mejor plato" texto={`${m.mejor.comida.descripcion || tipoInfo(m.mejor.comida.tipo).texto}: ${promedioTexto(m.mejor.promedio)} con ${m.mejor.votos} ${m.mejor.votos === 1 ? "voto" : "votos"}`} />}
      <Dato icono={Target} titulo="Tus votos" texto={e.diste ? `Puntuaste ${e.diste} ${e.diste === 1 ? "plato" : "platos"}, con ${promedioTexto(e.promedioDiste)} de promedio` : "No puntuaste platos esta semana"} />
      <Dato icono={Crown} titulo="Chef de la semana" texto={e.chefs.length ? `${e.chefs.map((c) => (c.perfil.id === e.yoId ? "Vos" : c.perfil.nombre)).join(" y ")}, con ${promedioTexto(e.chefs[0].promedio)} de promedio` : "Nadie llegó a 2 platos puntuados"} />
      {plato && <Dato icono={ChefHat} titulo="Plato de la semana" texto={`${plato.comida.descripcion || tipoInfo(plato.comida.tipo).texto}, de ${plato.comida.usuario_id === e.yoId ? "vos" : e.personas.find((p) => p.perfil.id === plato.comida.usuario_id)?.perfil.nombre || "alguien"}: ${promedioTexto(plato.promedio)}`} />}
      <Dato icono={Users} titulo="El grupo" texto={`${g.votos} ${g.votos === 1 ? "voto" : "votos"} de ${g.votantes} ${g.votantes === 1 ? "persona" : "personas"} en ${g.platos} ${g.platos === 1 ? "plato" : "platos"} · ${promedioTexto(g.promedio)} de promedio${g.perfectos ? ` · ${g.perfectos} ${g.perfectos === 1 ? "plato perfecto" : "platos perfectos"}` : ""}`} />
      {e.personas.length > 0 && (
        <ol className="tabla-estrellas">
          {e.personas.map((p, n) => (
            <li key={p.perfil.id}>
              <span className="lugar">{n + 1}</span>
              <Avatar perfil={p.perfil} tam={34} />
              <span className="datos">
                <strong>{p.perfil.id === e.yoId ? "Vos" : p.perfil.nombre}</strong>
                <small>{p.platos} {p.platos === 1 ? "plato" : "platos"} · {p.votos} {p.votos === 1 ? "voto" : "votos"}{p.cincos ? ` · ${p.cincos} ${p.cincos === 1 ? "plato perfecto" : "platos perfectos"}` : ""}</small>
              </span>
              <span className="promedio" aria-label={`Promedio ${promedioTexto(p.promedio)}`}><Star size={15} fill="currentColor" aria-hidden="true" /> {promedioTexto(p.promedio)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
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
