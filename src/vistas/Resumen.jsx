import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Activity, BarChart3, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ClipboardPaste, Flame, Martini, Moon, Plus, UserRound, Zap } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { diaCorto, fechaLocal, nombreDia, saludo, ultimosDias } from "../lib/fechas.js";
import { calcularPlan } from "../lib/cuerpo.js";
import { calcularRacha, sumarComidas, TIPOS, tipoInfo } from "../lib/macros.js";
import { Indicador, Anillo, Avatar, BarraMacros, Numero, vibrar } from "../componentes/Base.jsx";
import InvitacionesComida from "../componentes/InvitacionesComida.jsx";
import { abrirInforme, CartelInforme } from "../componentes/InformeSemanal.jsx";
import { FOTOS_POR_DIA, fotosDelDia } from "../lib/multas.js";
import { esDeAppleSalud } from "../lib/importar.js";
import { esDeNoche, fechaDeLaNoche } from "../componentes/Fiesta.jsx";
import Habitos from "../componentes/Habitos.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import TiraDias from "../componentes/TiraDias.jsx";
import Recomendador from "../componentes/Recomendador.jsx";
import Progreso from "./Progreso.jsx";
import Visor from "../componentes/Visor.jsx";
import { createPortal } from "react-dom";

export default function Resumen({ onCargar, onImportar, onEditarCuerpo, onFiesta, avisar }) {
  const [modo, setModo] = useState("dia");
  return (
    <>
      <div className="selector tres" role="tablist" aria-label="Sección del resumen">
        {[["dia", "Por día"], ["semana", "Semana"], ["progreso", "Progreso"]].map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={modo === id} className={modo === id ? "activo" : ""} onClick={() => { setModo(id); vibrar(5); }}>
            <span>{texto}</span>
          </button>
        ))}
        <Indicador indice={[["dia", "Por día"], ["semana", "Semana"], ["progreso", "Progreso"]].findIndex(([id]) => id === modo)} total={3} />
      </div>
      {modo === "dia" && <ResumenDia onCargar={onCargar} onImportar={onImportar} onFiesta={onFiesta} avisar={avisar} />}
      {modo === "semana" && <ResumenSemana />}
      {modo === "progreso" && <Progreso onEditarCuerpo={onEditarCuerpo} avisar={avisar} />}
    </>
  );
}

function ResumenDia({ onCargar, onImportar, onFiesta, avisar }) {
  const { usuario, yo, perfiles, comidas, fotos, whoop, salud, extras } = useDatos();
  const hoy = fechaLocal();
  const [fecha, setFecha] = useState(hoy);

  const delDia = useMemo(() => comidas.filter((c) => c.fecha === fecha), [comidas, fecha]);
  const fotosHoy = fotosDelDia(comidas, usuario.id, hoy);
  const mias = delDia.filter((c) => c.usuario_id === usuario.id);
  // Hoy, la fiesta de esta noche (sigue siendo la de anoche hasta las 6); otro día, la de ese día.
  const nocheDeFiesta = fecha === hoy ? comidas.find((c) => c.usuario_id === usuario.id && c.tipo === "fiesta" && c.fecha === fechaDeLaNoche()) : mias.find((c) => c.tipo === "fiesta");
  const total = sumarComidas(mias);
  const restante = yo.meta_calorias - Math.round(total.kcal);
  // El de Apple Salud cuenta en el total pero no se muestra aparte: parecería sumado dos veces.
  const resumenDia = mias.find((c) => c.tipo === "resumen" && !esDeAppleSalud(c));
  const racha = calcularRacha(comidas.filter((c) => c.usuario_id === usuario.id).map((c) => c.fecha));

  const amigos = Object.values(perfiles)
    .map((p) => ({ perfil: p, comidas: delDia.filter((c) => c.usuario_id === p.id) }))
    .sort((a, b) => (a.perfil.id === usuario.id ? -1 : b.perfil.id === usuario.id ? 1 : b.comidas.length - a.comidas.length));

  const plan = useMemo(() => (salud ? calcularPlan(salud) : null), [salud]);
  const propias = useMemo(() => new Set(comidas.filter((c) => c.usuario_id === usuario.id).map((c) => c.fecha)), [comidas, usuario.id]);

  return (
    <>
      {fecha === hoy && <CartelInforme />}
      <div className="dia-encabezado">
        <p className="dia-titulo">{fecha === hoy ? `${saludo()}, ${yo.nombre}` : nombreDia(fecha)}</p>
        {extras.multasActivas && fecha === hoy && (
          <span className={fotosHoy >= FOTOS_POR_DIA ? "fotos-hoy completas" : "fotos-hoy"} title="Fotos de comidas de hoy">
            {fotosHoy >= FOTOS_POR_DIA ? <><Check size={14} /> Foto de hoy</> : <><Camera size={14} /> Sin foto hoy</>}
          </span>
        )}
      </div>

      <InvitacionesComida avisar={avisar} />

      <TiraDias fecha={fecha} onElegir={setFecha} conComidas={propias} />

      <section className="tarjeta tarjeta-heroe">
        {racha > 1 && (
          <span className="racha">
            <Flame size={15} /> {racha} días seguidos
          </span>
        )}
        <div className="heroe-principal">
          <Anillo valor={total.kcal} meta={yo.meta_calorias} tam={124}>
            <strong className="heroe-numero"><Numero valor={Math.round(total.kcal)} /></strong>
            <span>de {yo.meta_calorias.toLocaleString("es-AR")}</span>
          </Anillo>
          <div className="heroe-detalle">
            <p className="heroe-restante">
              {restante >= 0 ? (
                <><strong>{restante.toLocaleString("es-AR")}</strong> kcal libres</>
              ) : (
                <><strong>{Math.abs(restante).toLocaleString("es-AR")}</strong> kcal sobre la meta</>
              )}
            </p>
            <BarraMacros total={total} compacta />
          </div>
        </div>
        {plan && <MacrosRestantes total={total} plan={plan} meta={yo.meta_calorias} />}
        <ul className="ranuras">
          {TIPOS.map((t) => {
            const lista = mias.filter((c) => c.tipo === t.id);
            const kcal = Math.round(sumarComidas(lista).kcal);
            return (
              <li key={t.id}>
                <motion.button
                  className={lista.length ? "ranura llena" : "ranura"}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onCargar({ tipo: t.id, fecha })}
                  aria-label={`Agregar ${t.texto.toLowerCase()}`}
                >
                  <span className="ranura-icono"><IconoComida tipo={t.id} size={21} /></span>
                  <span className="ranura-nombre">{t.plural || t.texto}</span>
                  <span className="ranura-valor">
                    {lista.length ? <><Check size={13} /> {kcal > 0 && kcal.toLocaleString("es-AR")}</> : <Plus size={15} />}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </section>

      {resumenDia && (
        <button className="tarjeta resumen-importado" onClick={() => onCargar({ comida: resumenDia })}>
          <span className="resumen-icono"><ClipboardList size={22} aria-hidden="true" /></span>
          <span><strong>{resumenDia.descripcion || "Resumen importado"}</strong><small>{(resumenDia.calorias || 0).toLocaleString("es-AR")} kcal</small></span>
        </button>
      )}

      <div className="acciones-rapidas">
        {fecha === hoy && <Recomendador yo={yo} salud={salud} total={total} cargadas={mias.map((c) => c.tipo)} fecha={fecha} onCargar={onCargar} />}
        {(nocheDeFiesta || (fecha === hoy && esDeNoche())) && (
          <motion.button className="tarjeta accion fiesta-accion" whileTap={{ scale: 0.97 }} onClick={onFiesta}>
            <Martini size={22} />
            <span>
              <strong>Modo fiesta</strong>
              <small>{nocheDeFiesta ? `${nocheDeFiesta.alimentos.length} ${nocheDeFiesta.alimentos.length === 1 ? "vaso" : "vasos"} · ${Math.round(nocheDeFiesta.calorias).toLocaleString("es-AR")} kcal` : "Cargá tus vasos"}</small>
            </span>
          </motion.button>
        )}
        <motion.button className="tarjeta accion" whileTap={{ scale: 0.97 }} onClick={() => onImportar(fecha)}>
          <ClipboardPaste size={22} />
          <span><strong>Importar el día</strong><small>Captura o texto</small></span>
        </motion.button>
      </div>

      <Habitos fecha={fecha} />

      {whoop.dias[fecha] && <TarjetaWhoop dia={whoop.dias[fecha]} comidas={total.kcal} />}

      <section>
        <h2 className="titulo-seccion">El día de cada uno</h2>
        <motion.ul className="lista-amigos" initial="oculto" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
          {amigos.map(({ perfil, comidas: lista }) => (
            <TarjetaAmigo key={perfil.id} perfil={perfil} comidas={lista} fotos={fotos} propio={perfil.id === usuario.id} />
          ))}
        </motion.ul>
      </section>
    </>
  );
}

// Cómo se ven los macros del día: lo que falta, lo que llevás o el porcentaje. Se recuerda en este teléfono.
const VISTAS_MACROS = [["falta"], ["llevo"], ["porcentaje"]];
const CLAVE_VISTA_MACROS = "lomada-vista-macros";

function vistaGuardada() {
  try {
    const v = localStorage.getItem(CLAVE_VISTA_MACROS);
    return VISTAS_MACROS.some(([id]) => id === v) ? v : "falta";
  } catch {
    return "falta";
  }
}

function MacrosRestantes({ total, plan, meta }) {
  const [vista, setVista] = useState(vistaGuardada);
  const [direccion, setDireccion] = useState(1);
  // Los carbos completan la meta de calorías que se ve en el anillo.
  const carbos = Math.max(0, Math.round((meta - plan.proteinas * 4 - plan.grasas * 9) / 4));
  const filas = [["Proteínas", "p", plan.proteinas, 4], ["Carbos", "c", carbos, 4], ["Grasas", "g", plan.grasas, 9]];
  const kcalMacros = total.p * 4 + total.c * 4 + total.g * 9;

  function elegir(id) {
    setVista(id);
    vibrar(5);
    try {
      localStorage.setItem(CLAVE_VISTA_MACROS, id);
    } catch {
      // Sin almacenamiento, la elección dura hasta cerrar la app.
    }
  }

  function textos(clave, objetivo, porGramo) {
    const llevo = Math.round(total[clave]);
    const falta = Math.round(objetivo - total[clave]);
    if (vista === "llevo") return [`${llevo} g`, `de ${objetivo} g`];
    if (vista === "porcentaje") {
      const parte = kcalMacros > 0 ? Math.round((total[clave] * porGramo * 100) / kcalMacros) : 0;
      return [`${objetivo ? Math.round((total[clave] * 100) / objetivo) : 0}%`, kcalMacros > 0 ? `de ${objetivo} g · ${parte}% kcal` : `de ${objetivo} g`];
    }
    return falta >= 0 ? [`${falta} g`, `faltan de ${objetivo} g`] : [`+${Math.abs(falta)} g`, `de más sobre ${objetivo} g`];
  }

  const indice = VISTAS_MACROS.findIndex(([id]) => id === vista);
  const mover = (paso) => {
    setDireccion(paso);
    elegir(VISTAS_MACROS[(indice + paso + VISTAS_MACROS.length) % VISTAS_MACROS.length][0]);
  };
  const nombreVista = vista === "falta" ? "Lo que te falta" : vista === "llevo" ? "Lo que llevás" : "Porcentaje de la meta";

  return (
    <div className="macros-del-dia">
      <ul className="macros-faltan" aria-label={nombreVista} aria-live="polite">
        {filas.map(([texto, clave, objetivo, porGramo]) => {
          const [numero, detalle] = textos(clave, objetivo, porGramo);
          const avance = objetivo ? total[clave] / objetivo : 1;
          return (
            <li key={clave}>
              <span className="macro-nombre"><span className={`punto s-${clave}`} /> {texto}</span>
              <AnimatePresence mode="wait" initial={false} custom={direccion}>
                <motion.span
                  key={vista}
                  className={`macro-vista vista-${vista}`}
                  custom={direccion}
                  initial={{ opacity: 0, x: direccion * 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direccion * -14 }}
                  transition={{ duration: 0.18 }}
                >
                  {vista === "porcentaje" ? (
                    <span className="macro-con-anillo">
                      <MiniAnillo avance={avance} clave={clave} />
                      <strong>{numero}</strong>
                    </span>
                  ) : (
                    <strong>{numero}</strong>
                  )}
                  <small>{detalle}</small>
                  {vista !== "porcentaje" && (
                    <span className={`pista-progreso${vista === "falta" ? " pista-falta" : ""}`}>
                      {/* Lo que falta se va vaciando; lo que llevás se va llenando. */}
                      <motion.span
                        className={`s-${clave}`}
                        initial={{ scaleX: vista === "falta" ? 1 : 0 }}
                        animate={{ scaleX: vista === "falta" ? Math.max(0, 1 - avance) : Math.min(avance, 1) }}
                        transition={{ duration: 0.7 }}
                      />
                    </span>
                  )}
                </motion.span>
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      {vista === "porcentaje" && kcalMacros > 0 && (
        <div className="reparto-kcal" role="img" aria-label={`De dónde vienen tus calorías: ${filas.map(([t, k, , g]) => `${t} ${Math.round((total[k] * g * 100) / kcalMacros)}%`).join(", ")}`}>
          {filas.map(([, clave, , porGramo]) => (
            <motion.span key={clave} className={`s-${clave}`} initial={{ flexGrow: 0 }} animate={{ flexGrow: (total[clave] * porGramo) / kcalMacros }} transition={{ duration: 0.6 }} />
          ))}
        </div>
      )}
      <div className="vista-macros">
        <button className="flecha-vista" onClick={() => mover(-1)} aria-label="Vista anterior de los macros"><ChevronLeft size={18} /></button>
        <span className="puntos-vista" aria-hidden="true">
          {VISTAS_MACROS.map(([id]) => <i key={id} className={id === vista ? "activo" : ""} />)}
        </span>
        <button className="flecha-vista" onClick={() => mover(1)} aria-label="Vista siguiente de los macros"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

function MiniAnillo({ avance, clave }) {
  const r = 11;
  return (
    <svg className="mini-anillo" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--pista)" strokeWidth="4" />
      <motion.circle
        cx="14" cy="14" r={r} fill="none" className={`trazo-${clave}`} strokeWidth="4" strokeLinecap="round" transform="rotate(-90 14 14)"
        initial={{ pathLength: 0 }} animate={{ pathLength: Math.min(avance, 1), opacity: avance > 0 ? 1 : 0 }} transition={{ duration: 0.7 }}
      />
    </svg>
  );
}

function TarjetaWhoop({ dia, comidas }) {
  const numero = (v, decimales = 0) => Number(v).toLocaleString("es-AR", { maximumFractionDigits: decimales });
  const datos = [
    dia.recuperacion != null && { icono: Activity, etiqueta: "Recuperación", valor: `${dia.recuperacion}%`, detalle: dia.hrv != null ? `HRV ${numero(dia.hrv)} ms` : "" },
    dia.sueno_horas != null && { icono: Moon, etiqueta: "Sueño", valor: `${numero(dia.sueno_horas, 1)} h`, detalle: dia.sueno_porcentaje != null ? `${dia.sueno_porcentaje}% de rendimiento` : "" },
    dia.strain != null && { icono: Zap, etiqueta: "Esfuerzo", valor: numero(dia.strain, 1), detalle: "de 21" },
    dia.calorias_quemadas != null && { icono: Flame, etiqueta: "Quemadas", valor: numero(dia.calorias_quemadas), detalle: "kcal" },
  ].filter(Boolean);
  const balance = dia.calorias_quemadas != null ? Math.round(comidas - dia.calorias_quemadas) : null;

  return (
    <motion.section className="tarjeta tarjeta-whoop" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className="whoop-cabecera">
        <h2>Tu cuerpo</h2>
        <span>WHOOP · solo lo ves vos</span>
      </div>
      <ul className="whoop-datos">
        {datos.map(({ icono: Icono, etiqueta, valor, detalle }) => (
          <li key={etiqueta}>
            <span className="whoop-etiqueta"><Icono size={15} /> {etiqueta}</span>
            <strong>{valor}</strong>
            {detalle && <small>{detalle}</small>}
          </li>
        ))}
      </ul>
      {balance !== null && comidas > 0 && (
        <p className="whoop-balance">
          Comiste <strong>{numero(comidas)}</strong> y quemaste <strong>{numero(dia.calorias_quemadas)}</strong> kcal:{" "}
          <strong>{numero(Math.abs(balance))} kcal {balance >= 0 ? "de más" : "de menos"}</strong>
        </p>
      )}
    </motion.section>
  );
}

function TarjetaAmigo({ perfil, comidas, fotos, propio }) {
  const { abrirPerfil, castigo } = useDatos();
  const [abierta, setAbierta] = useState(false);
  const total = sumarComidas(comidas);
  const visibles = comidas.filter((c) => !esDeAppleSalud(c));
  // Ordenadas por comida del día: desayuno, almuerzo, merienda, cena, colaciones y fiesta.
  const orden = [...TIPOS.map((t) => t.id), "fiesta", "resumen"];
  const porComida = orden
    .map((tipo) => ({ tipo, lista: visibles.filter((c) => c.tipo === tipo) }))
    .filter((g) => g.lista.length);
  const fotosDelDia = porComida.flatMap((g) => g.lista).filter((c) => fotos[c.foto_path]);
  const [visor, setVisor] = useState(null);
  const avance = Math.min(total.kcal / perfil.meta_calorias, 1);
  const conFoto = comidas.filter((c) => fotos[c.foto_path]).slice(0, 3);

  return (
    <motion.li className={castigo.calavera && !propio ? "tarjeta tarjeta-amigo fotos-ocultas" : "tarjeta tarjeta-amigo"} variants={{ oculto: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}>
      <button className="amigo-cabecera" onClick={() => (comidas.length ? setAbierta(!abierta) : abrirPerfil(perfil.id))} aria-expanded={comidas.length ? abierta : undefined}>
        <Avatar perfil={perfil} tam={44} />
        <span className="amigo-datos">
          <strong>{propio ? `${perfil.nombre} (vos)` : perfil.nombre}</strong>
          <span>
            {comidas.length
              ? `${Math.round(total.kcal).toLocaleString("es-AR")} kcal${visibles.length ? ` · ${visibles.length} ${visibles.length === 1 ? "comida" : "comidas"}` : ""}`
              : "Todavía no subió nada"}
          </span>
          <span className="pista-progreso">
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.8 }} />
          </span>
        </span>
        <span className="amigo-fotos" aria-hidden="true">
          {conFoto.map((c) => (
            <img key={c.id} src={fotos[c.foto_path]} alt="" loading="lazy" />
          ))}
        </span>
        {comidas.length > 0 && (
          <motion.span animate={{ rotate: abierta ? 180 : 0 }} className="amigo-flecha">
            <ChevronDown size={18} />
          </motion.span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div className="amigo-detalle" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="amigo-detalle-interno">
              <BarraMacros total={total} compacta />
              <ul className="dia-por-comida">
                {porComida.map((g) => (
                  <li key={g.tipo}>
                    <span className="dia-por-comida-tipo"><IconoComida tipo={g.tipo} size={15} /> {tipoInfo(g.tipo).plural && g.lista.length > 1 ? tipoInfo(g.tipo).plural : tipoInfo(g.tipo).texto}</span>
                    {g.lista.map((c) => (
                      <div key={c.id} className="dia-por-comida-fila">
                        {fotos[c.foto_path] ? (
                          <button type="button" className="dia-por-comida-foto" onClick={() => setVisor(Math.max(0, fotosDelDia.findIndex((x) => x.id === c.id)))} aria-label={`Ver foto: ${c.descripcion || tipoInfo(c.tipo).texto}`}>
                            <img src={fotos[c.foto_path]} alt="" loading="lazy" />
                          </button>
                        ) : (
                          <span className="dia-por-comida-foto sin-foto"><IconoComida tipo={c.tipo} size={20} /></span>
                        )}
                        <span className="dia-por-comida-datos">
                          <strong>{c.descripcion || tipoInfo(c.tipo).texto}</strong>
                          <small>{Math.round(c.calorias || 0).toLocaleString("es-AR")} kcal · P {Math.round(c.proteinas || 0)} · C {Math.round(c.carbohidratos || 0)} · G {Math.round(c.grasas || 0)}</small>
                        </span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              <button className="boton-texto" onClick={() => abrirPerfil(perfil.id)}><UserRound size={15} /> Ver perfil</button>
              {visor !== null && createPortal(<Visor lista={fotosDelDia} inicio={visor} onCerrar={() => setVisor(null)} />, document.body)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function ResumenSemana() {
  const { usuario, perfiles, comidas } = useDatos();
  const [personaId, setPersonaId] = useState(usuario.id);
  const dias = useMemo(() => ultimosDias(7), []);
  const persona = perfiles[personaId];

  const semana = comidas.filter((c) => c.fecha >= dias[0]);
  const propias = semana.filter((c) => c.usuario_id === personaId);
  const porDia = dias.map((d) => ({ fecha: d, kcal: Math.round(sumarComidas(propias.filter((c) => c.fecha === d)).kcal) }));
  const conRegistro = porDia.filter((d) => d.kcal > 0);
  const totalSemana = sumarComidas(propias);
  const promedio = conRegistro.length ? Math.round(totalSemana.kcal / conRegistro.length) : 0;
  const proteina = conRegistro.length ? Math.round(totalSemana.p / conRegistro.length) : 0;

  const ranking = Object.values(perfiles)
    .map((p) => {
      const lista = semana.filter((c) => c.usuario_id === p.id);
      const diasActivos = new Set(lista.map((c) => c.fecha));
      return { perfil: p, comidas: lista.length, diasActivos };
    })
    .sort((a, b) => b.diasActivos.size - a.diasActivos.size || b.comidas - a.comidas);

  return (
    <>
      <header className="titulo-vista">
        <div>
          <p className="sobretitulo">Últimos 7 días</p>
          <h1>La semana</h1>
        </div>
      </header>

      <button className="informe-aviso" onClick={abrirInforme}>
        <span className="informe-aviso-icono" aria-hidden="true"><BarChart3 size={20} /></span>
        <span><strong>Tu informe semanal</strong><small>De lunes a domingo, con todo lo que cargaste</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <div className="fichas-personas" role="group" aria-label="Elegir persona">
        {Object.values(perfiles).map((p) => (
          <button key={p.id} className={p.id === personaId ? "ficha activa" : "ficha"} onClick={() => setPersonaId(p.id)} aria-pressed={p.id === personaId}>
            <Avatar perfil={p} tam={26} /> {p.id === usuario.id ? "Vos" : p.nombre}
          </button>
        ))}
      </div>

      <div className="estadisticas">
        <Estadistica etiqueta="Promedio diario" valor={promedio} unidad="kcal" />
        <Estadistica etiqueta="Proteína diaria" valor={proteina} unidad="g" />
        <Estadistica etiqueta="Comidas" valor={propias.length} />
      </div>

      <section className="tarjeta tarjeta-grafico">
        <h2>Calorías por día</h2>
        <GraficoSemana datos={porDia} meta={persona?.meta_calorias || 2000} />
        <details className="tabla-grafico">
          <summary>Ver como tabla</summary>
          <table>
            <thead>
              <tr><th scope="col">Día</th><th scope="col">Calorías</th></tr>
            </thead>
            <tbody>
              {porDia.map((d) => (
                <tr key={d.fecha}><td>{nombreDia(d.fecha)}</td><td>{d.kcal.toLocaleString("es-AR")} kcal</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section>
        <h2 className="titulo-seccion">Constancia del grupo</h2>
        <ol className="ranking">
          {ranking.map((r, i) => (
            <motion.li key={r.perfil.id} className="tarjeta" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
              <span className="ranking-lugar">{i + 1}</span>
              <Avatar perfil={r.perfil} tam={38} />
              <span className="ranking-datos">
                <strong>{r.perfil.id === usuario.id ? "Vos" : r.perfil.nombre}</strong>
                <span>{r.diasActivos.size} de 7 días · {r.comidas} {r.comidas === 1 ? "comida" : "comidas"}</span>
              </span>
              <span className="ranking-dias" aria-hidden="true">
                {dias.map((d) => (
                  <i key={d} className={r.diasActivos.has(d) ? "lleno" : ""} />
                ))}
              </span>
            </motion.li>
          ))}
        </ol>
      </section>
      <p className="nota">Los valores son estimaciones para llevar la cuenta entre amigos. No reemplazan a un profesional de la nutrición.</p>
    </>
  );
}

function Estadistica({ etiqueta, valor, unidad }) {
  return (
    <div className="tarjeta estadistica">
      <span>{etiqueta}</span>
      <strong><Numero valor={valor} /></strong>
      {unidad && <small>{unidad}</small>}
    </div>
  );
}

function GraficoSemana({ datos, meta }) {
  const [activo, setActivo] = useState(null);
  const mayor = Math.max(...datos.map((d) => d.kcal), meta);
  const techo = Math.ceil((mayor * 1.08) / 500) * 500;
  const marcas = [techo, techo / 2, 0];
  const pico = datos.reduce((m, d) => (d.kcal > (m?.kcal ?? 0) ? d : m), null);

  return (
    <div className="grafico" onMouseLeave={() => setActivo(null)}>
      <div className="grafico-eje" aria-hidden="true">
        {marcas.map((m) => (
          <span key={m} style={{ bottom: `${(m / techo) * 100}%` }}>{m.toLocaleString("es-AR")}</span>
        ))}
      </div>
      <div className="grafico-area">
        {marcas.map((m) => (
          <i key={m} className="grafico-linea" style={{ bottom: `${(m / techo) * 100}%` }} />
        ))}
        <i className="grafico-meta" style={{ bottom: `${(meta / techo) * 100}%` }}>
          <span>Meta {meta.toLocaleString("es-AR")}</span>
        </i>
        <div className="grafico-columnas">
          {datos.map((d, i) => (
            <button
              key={d.fecha}
              className="grafico-columna"
              onMouseEnter={() => setActivo(d.fecha)}
              onFocus={() => setActivo(d.fecha)}
              onBlur={() => setActivo(null)}
              aria-label={`${nombreDia(d.fecha)}: ${d.kcal} kcal`}
            >
              {activo === d.fecha && (
                <span className={i > 3 ? "grafico-globo izquierda" : "grafico-globo"}>
                  <strong>{d.kcal.toLocaleString("es-AR")} kcal</strong>
                  {nombreDia(d.fecha)}
                </span>
              )}
              {d.fecha === pico?.fecha && activo !== d.fecha && d.kcal > 0 && (
                <span className="grafico-rotulo" style={{ bottom: `calc(${(d.kcal / techo) * 100}% + 4px)` }}>
                  {d.kcal.toLocaleString("es-AR")}
                </span>
              )}
              <motion.span
                className="grafico-barra"
                initial={{ height: 0 }}
                animate={{ height: `${(d.kcal / techo) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="grafico-dias" aria-hidden="true">
        {datos.map((d) => (
          <span key={d.fecha}>{diaCorto(d.fecha)}</span>
        ))}
      </div>
    </div>
  );
}

