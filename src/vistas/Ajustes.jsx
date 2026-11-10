import AppleSalud from "../componentes/AppleSalud.jsx";
import Mejoras from "../componentes/Mejoras.jsx";
import MisRecetas from "../componentes/MisRecetas.jsx";
import LaCaca from "../componentes/LaCaca.jsx";
import Tutorial from "../componentes/Tutorial.jsx";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Bell, BellOff, BookOpen, Check, ChefHat, ChevronRight, HeartPulse, KeyRound, Lock, LogOut, MessageSquarePlus, Monitor, Moon, Palette, RefreshCw, Skull, Sprout, Sun, Target, Unplug, UserRound, Watch } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { guardarTema, leerTema } from "../lib/tema.js";
import { accionWhoop } from "../lib/api.js";
import { calcularPlan, OBJETIVOS, PRIORIDADES } from "../lib/cuerpo.js";
import { FormularioContrasena } from "../componentes/Contrasena.jsx";
import { activarAvisos, avisosActivos, desactivarAvisos, estadoAvisos } from "../lib/avisos.js";
import { Avatar } from "../componentes/Base.jsx";

const COLORES = ["#E4572E", "#E0A100", "#3FA45B", "#17A2A2", "#3F7FD9", "#7A5CD6", "#CE5AA8", "#8C6A4F"];
const TEMAS = [
  { id: "lomada", texto: "Lomada", icono: Sprout },
  { id: "auto", texto: "Automático", icono: Monitor },
  { id: "claro", texto: "Claro", icono: Sun },
  { id: "oscuro", texto: "Oscuro", icono: Moon },
];

function textoObjetivo(salud) {
  const plan = calcularPlan(salud);
  const objetivo = OBJETIVOS.find((o) => o.id === plan.objetivo).texto;
  const detalle = plan.aMedida ? "macros a medida" : PRIORIDADES.find((o) => o.id === plan.prioridad).texto.toLowerCase();
  return `${objetivo} · ${detalle} · P ${plan.proteinas} g · C ${plan.carbohidratos} g · G ${plan.grasas} g`;
}

export default function Ajustes({ avisar, onEditarCuerpo }) {
  const { castigo, usuario, yo, cargarPerfiles, salud } = useDatos();
  const [nombre, setNombre] = useState(yo.nombre);
  const [color, setColor] = useState(yo.color);
  const [meta, setMeta] = useState(yo.meta_calorias);
  const [tema, setTema] = useState(leerTema());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [seccion, setSeccion] = useState(null);

  const cambios = nombre.trim() !== yo.nombre || color !== yo.color || meta !== yo.meta_calorias;

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Poné un nombre");
    setError("");
    setGuardando(true);
    const { error: err } = await supabase
      .from("perfiles")
      .update({ nombre: nombre.trim(), color, meta_calorias: meta })
      .eq("id", usuario.id);
    setGuardando(false);
    if (err) return setError(err.message);
    await cargarPerfiles();
    avisar("Perfil actualizado");
  }

  function cambiarTema(nuevo) {
    setTema(nuevo);
    guardarTema(nuevo);
  }

  const SECCIONES = [
    { id: "perfil", titulo: "Tu perfil", detalle: "Nombre, color, meta y plan", icono: UserRound },
    { id: "caca", titulo: "La caca 💩", detalle: "La regla de las fotos y el Bocha", icono: Skull },
    { id: "recetas", titulo: "Mis recetas", detalle: "Tus comidas caseras por porción", icono: ChefHat },
    { id: "notificaciones", titulo: "Notificaciones", detalle: "Avisos en el celular", icono: Bell },
    { id: "privacidad", titulo: "Privacidad", detalle: "Qué ve el grupo", icono: Lock },
    { id: "salud", titulo: "Apple Salud", detalle: "Traer calorías y macros", icono: HeartPulse },
    { id: "whoop", titulo: "WHOOP", detalle: "Recuperación, sueño y esfuerzo", icono: Watch },
    { id: "apariencia", titulo: "Apariencia", detalle: "Lomada, claro u oscuro", icono: Palette },
    { id: "tutorial", titulo: "Tutorial", detalle: "Cómo se usa cada cosa", icono: BookOpen },
    { id: "mejoras", titulo: "Mejoras", detalle: "Pedí cambios para la app", icono: MessageSquarePlus },
    { id: "cuenta", titulo: "Cuenta", detalle: "Contraseña y cerrar sesión", icono: KeyRound },
  ];
  const actual = SECCIONES.find((x) => x.id === seccion);

  if (!actual) {
    return (
      <>
        <header className="titulo-vista">
          <div>
            <p className="sobretitulo">Tu cuenta</p>
            <h1>Ajustes</h1>
          </div>
        </header>
        <nav className="menu-ajustes" aria-label="Secciones de ajustes">
          {SECCIONES.map((x) => (
            <button key={x.id} onClick={() => { setSeccion(x.id); scrollTo(0, 0); }}>
              <span className="icono-ajuste"><x.icono size={19} /></span>
              <span><strong>{x.titulo}</strong><small>{x.detalle}</small></span>
              <ChevronRight className="chevron" size={19} aria-hidden="true" />
            </button>
          ))}
        </nav>
      </>
    );
  }

  return (
    <div className="ajustes-seccion">
      <header className="volver-ajustes">
        <button className="boton-icono" onClick={() => { setSeccion(null); scrollTo(0, 0); }} aria-label="Volver a ajustes"><ArrowLeft size={20} /></button>
        <h1>{actual.titulo}</h1>
      </header>

      {seccion === "perfil" && (
        <>
          <form className="ajustes" onSubmit={guardar}>
            <section className="tarjeta ajuste">
              <div className="perfil-vista">
                <motion.span key={color} initial={{ scale: 0.7 }} animate={{ scale: 1 }}>
                  <Avatar perfil={{ nombre, color }} tam={72} />
                </motion.span>
                <label>
                  <span>Nombre</span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} required />
                </label>
              </div>

              <fieldset>
                <legend>Tu color</legend>
                <div className="opciones-color">
                  {COLORES.map((c) => (
                    <button type="button" key={c} style={{ background: c }} onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Color ${c}`}>
                      {color === c && <Check size={17} color="#fff" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className="tarjeta ajuste con-titulo">
              <h3 className="perfil-subtitulo">Meta diaria</h3>
              <label className="meta">
                <span className="meta-valor"><strong>{meta.toLocaleString("es-AR")}</strong> kcal por día</span>
                <input type="range" min="1200" max="4500" step="50" value={meta} onChange={(e) => setMeta(Number(e.target.value))} aria-label="Meta diaria de calorías" />
              </label>
            </section>

            {error && <p className="error" role="alert">{error}</p>}
            {cambios && (
              <motion.button className="boton boton-grande" type="submit" disabled={guardando} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </motion.button>
            )}
          </form>

          {salud !== undefined && (
            <section className="tarjeta ajuste con-titulo">
              <h3 className="perfil-subtitulo">Tu cuerpo y objetivo</h3>
              {salud ? (
                <p className="ajuste-texto">
                  <strong>{textoObjetivo(salud)}</strong>
                  <br />
                  {Number(salud.altura_cm)} cm · {Number(salud.peso_kg).toLocaleString("es-AR")} kg · objetivo {Number(salud.peso_objetivo).toLocaleString("es-AR")} kg. Quemás unas {calcularPlan(salud).gasto.toLocaleString("es-AR")} kcal por día. Solo lo ves vos.
                </p>
              ) : (
                <p className="ajuste-texto">Cargá tus medidas, tu actividad y tu objetivo para calcular cuánto quemás y tu meta diaria.</p>
              )}
              <button className="boton boton-secundario" onClick={onEditarCuerpo}><Target size={17} /> {salud ? "Editar mi plan" : "Armar mi plan"}</button>
            </section>
          )}
        </>
      )}

      {seccion === "notificaciones" && <Notificaciones avisar={avisar} />}
      {seccion === "privacidad" && <Privacidad avisar={avisar} />}
      {seccion === "salud" && <AppleSalud avisar={avisar} />}
      {seccion === "whoop" && <ConexionWhoop avisar={avisar} />}
      {seccion === "tutorial" && <Tutorial />}
      {seccion === "mejoras" && <Mejoras avisar={avisar} />}
      {seccion === "recetas" && <MisRecetas avisar={avisar} />}
      {seccion === "caca" && <LaCaca avisar={avisar} />}

      {seccion === "apariencia" && (
        <section className="tarjeta ajuste">
          {castigo.evo && <p className="castigo-nota">El Bocha Evo te pintó la app de marrón. Volvés a elegir el lunes.</p>}
          <div className="opciones-tema" role="radiogroup" aria-label="Tema" aria-disabled={castigo.evo}>
            {TEMAS.map((t) => (
              <button key={t.id} role="radio" aria-checked={tema === t.id} className={tema === t.id ? "activo" : ""} onClick={() => cambiarTema(t.id)} disabled={castigo.evo}>
                <t.icono size={18} /> {t.texto}
              </button>
            ))}
          </div>
        </section>
      )}

      {seccion === "cuenta" && (
        <>
          <section className="tarjeta ajuste">
            <p className="ajuste-texto">Usuario: <strong>{yo.usuario || yo.nombre}</strong><br />Mail de recuperación: {usuario.email}</p>
            <Contrasena avisar={avisar} />
            <button className="boton boton-secundario" onClick={() => supabase.auth.signOut()}>
              <LogOut size={17} /> Cerrar sesión
            </button>
          </section>
          <section className="tarjeta ajuste con-titulo">
            <h3 className="perfil-subtitulo">Datos de alimentos</h3>
            <p className="ajuste-texto">
              Los productos vienen de Open Food Facts, una base colaborativa; los alimentos genéricos, de USDA FoodData Central. Las comidas típicas son valores aproximados. Revisá siempre el envase si necesitás precisión.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function ConexionWhoop({ avisar }) {
  const { whoop, cargarWhoop } = useDatos();
  const [ocupado, setOcupado] = useState(false);

  async function correr(tarea) {
    setOcupado(true);
    try {
      await tarea();
    } catch (err) {
      avisar(err.message);
    } finally {
      setOcupado(false);
    }
  }

  const conectar = () =>
    correr(async () => {
      const { url } = await accionWhoop("conectar");
      location.href = url;
    });

  const actualizar = () =>
    correr(async () => {
      const estado = await cargarWhoop(true);
      if (!estado.conectado) avisar("WHOOP pide conectar de nuevo");
      else avisar(estado.desactualizado ? "WHOOP no respondió. Probá más tarde" : "Datos de WHOOP actualizados");
    });

  const desconectar = () =>
    correr(async () => {
      await accionWhoop("desconectar");
      await cargarWhoop();
      avisar("WHOOP desconectado y datos borrados");
    });

  return (
    <section className="tarjeta ajuste">
      <h2>WHOOP</h2>
      {!whoop.disponible ? (
        <p className="ajuste-texto">La conexión con WHOOP se activa cuando la app esté publicada y configurada.</p>
      ) : whoop.conectado ? (
        <>
          <p className="ajuste-texto">Conectado. Trae recuperación, sueño, esfuerzo y calorías quemadas. Solo los ves vos.</p>
          <div className="ajuste-botones">
            <button className="boton boton-secundario" onClick={actualizar} disabled={ocupado}><RefreshCw size={17} /> Actualizar</button>
            <button className="boton boton-secundario" onClick={desconectar} disabled={ocupado}><Unplug size={17} /> Desconectar</button>
          </div>
        </>
      ) : (
        <>
          <p className="ajuste-texto">Mirá tu recuperación, sueño, esfuerzo y calorías quemadas junto a lo que comés. Solo los ves vos.</p>
          <button className="boton" onClick={conectar} disabled={ocupado}><Watch size={17} /> Conectar WHOOP</button>
        </>
      )}
    </section>
  );
}

function Privacidad({ avisar }) {
  const { usuario, yo, extras, cargarPerfiles } = useDatos();
  if (!extras.disponible) return null;

  async function cambiar(e) {
    const { error } = await supabase.from("perfiles").update({ comidas_privadas: e.target.checked }).eq("id", usuario.id);
    if (error) return avisar("No se pudo guardar");
    await cargarPerfiles();
    avisar("Preferencia guardada");
  }

  return (
    <section className="tarjeta ajuste">
      <h2>Qué ve el grupo</h2>
      <p className="ajuste-texto">
        El grupo ve tu nombre, tu meta de calorías, tus comidas con sus fotos y macros, tu agua y tus medallas. Tu peso, altura, edad, objetivo, favoritas y datos de WHOOP son solo tuyos.
      </p>
      <label className="interruptor">
        <input type="checkbox" checked={!!yo.comidas_privadas} onChange={cambiar} />
        <span>Mis comidas nuevas arrancan como privadas</span>
      </label>
      <p className="nota">Una comida privada no aparece en el chat ni en los premios del bot. También podés elegirlo en cada comida.</p>
    </section>
  );
}

function Notificaciones({ avisar }) {
  const { usuario, extras } = useDatos();
  const estado = estadoAvisos();
  const [activas, setActivas] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    avisosActivos().then(setActivas, () => setActivas(false));
  }, []);

  if (!extras.disponible) return null;

  async function alternar() {
    setOcupado(true);
    try {
      if (activas) await desactivarAvisos();
      else await activarAvisos(usuario.id);
      avisar(activas ? "Notificaciones apagadas" : "Notificaciones activadas");
      setActivas(!activas);
    } catch {
      avisar("No se pudieron activar las notificaciones");
    } finally {
      setOcupado(false);
    }
  }

  const textos = {
    sin_configurar: "Se activan cuando la app esté publicada y configurada.",
    instalar: "En iPhone, primero agregá la app a la pantalla de inicio y abrila desde ahí.",
    no_compatible: "Este navegador no permite notificaciones.",
    bloqueadas: "Las bloqueaste para esta app. Podés habilitarlas desde los permisos del navegador.",
  };

  return (
    <section className="tarjeta ajuste">
      <h2>Notificaciones</h2>
      {estado === "disponible" ? (
        <>
          <p className="ajuste-texto">Avisos de mensajes nuevos y comidas del grupo en tus fotos.</p>
          <button className={activas ? "boton boton-secundario" : "boton"} onClick={alternar} disabled={ocupado}>
            {activas ? <><BellOff size={17} /> Apagar</> : <><Bell size={17} /> Activar</>}
          </button>
        </>
      ) : (
        <p className="ajuste-texto">{textos[estado]}</p>
      )}
    </section>
  );
}

function Contrasena({ avisar }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button className="boton boton-secundario" onClick={() => setAbierto(true)}>
        <KeyRound size={17} /> Cambiar contraseña
      </button>
    );
  }

  return (
    <FormularioContrasena
      onListo={() => {
        setAbierto(false);
        avisar("Contraseña guardada");
      }}
    />
  );
}

