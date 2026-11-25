import AppleSalud, { textoEstadoSalud, useEstadoSalud } from "../componentes/AppleSalud.jsx";
import Mejoras from "../componentes/Mejoras.jsx";
import MisRecetas from "../componentes/MisRecetas.jsx";
import LaCaca from "../componentes/LaCaca.jsx";
import Tutorial from "../componentes/Tutorial.jsx";
import ObjetivosMFP from "../componentes/ObjetivosMFP.jsx";
import MisGrupos from "../componentes/MisGrupos.jsx";
import MiMotivacion from "../componentes/MiMotivacion.jsx";
import { Suspense, useEffect, useState } from "react";
import { perezosa } from "../lib/perezosa.js";
import Recuperable, { CargandoSeccion } from "../componentes/Recuperable.jsx";
import { motion } from "motion/react";
import { ArrowLeft, Bell, BellOff, BookOpen, Camera, Check, ChefHat, ChevronRight, Crown, Download, FileText, HeartPulse, KeyRound, ListChecks, Lock, LogOut, Megaphone, MessageSquarePlus, MoonStar, Palette, Plane, RefreshCw, Skull, Sprout, SunMedium, Target, Unplug, UserRound, Users, Volume2, VolumeX, Watch } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { guardarTema, leerTema } from "../lib/tema.js";
import { accionWhoop } from "../lib/api.js";
import { calcularPlan, OBJETIVOS, PRIORIDADES } from "../lib/cuerpo.js";
import { FormularioContrasena } from "../componentes/Contrasena.jsx";
import { activarAvisos, avisosActivos, desactivarAvisos, estadoAvisos } from "../lib/avisos.js";
import { Avatar } from "../componentes/Base.jsx";
import { useFotoPerfil } from "../componentes/FotoPerfil.jsx";
import { AjustesRegistros } from "../componentes/RegistrosDiarios.jsx";
import Actualizaciones from "../componentes/Actualizaciones.jsx";
import { ACTUALIZACIONES, hayNovedades } from "../data/actualizaciones.js";
import { ding, prenderSonidos, sonidosPrendidos } from "../lib/sonidos.js";
import { EVENTO_PEDIDOS, pedidosPendientes } from "../lib/grupos.js";
const PanelDueno = perezosa(() => import("../componentes/PanelDueno.jsx"));
import PreferenciasAvisos from "../componentes/PreferenciasAvisos.jsx";
import BorrarCuenta from "../componentes/BorrarCuenta.jsx";
import PrivacidadTerminos from "../componentes/PrivacidadTerminos.jsx";
import { LoQueLlego, MandarASalud } from "../componentes/SaludDetalle.jsx";
import { descargarMisDatos } from "../lib/misDatos.js";

const COLORES = ["#E4572E", "#E0A100", "#3FA45B", "#17A2A2", "#3F7FD9", "#7A5CD6", "#CE5AA8", "#8C6A4F"];
const TEMAS = [
  { id: "lomada", texto: "Lomada", icono: Sprout },
  { id: "negro", texto: "Full black", icono: MoonStar },
  { id: "blanco", texto: "Full white", icono: SunMedium },
];

function textoObjetivo(salud) {
  const plan = calcularPlan(salud);
  const objetivo = OBJETIVOS.find((o) => o.id === plan.objetivo).texto;
  const detalle = plan.aMedida ? "macros a medida" : PRIORIDADES.find((o) => o.id === plan.prioridad).texto.toLowerCase();
  return `${objetivo} · ${detalle} · P ${plan.proteinas} g · C ${plan.carbohidratos} g · G ${plan.grasas} g`;
}

// El cálculo del gasto cambió (ahora cuenta el día a día aparte del entreno): si la meta guardada
// quedó lejos de la que da el plan, se ofrece cambiarla. Nunca se cambia sola.
function MetaRecalculada({ salud, metaActual, onUsar, onEditar }) {
  const { usuario, cargarPerfiles } = useDatos();
  const [guardando, setGuardando] = useState(false);
  const plan = calcularPlan(salud);
  const clave = `lomada-meta-nueva-${plan.calorias}`;
  const [descartada, setDescartada] = useState(() => {
    try {
      return localStorage.getItem(clave) === "no";
    } catch {
      return false;
    }
  });
  if (plan.aMedida || descartada || Math.abs(plan.calorias - metaActual) < 100) return null;

  async function usar() {
    setGuardando(true);
    const { error } = await supabase.from("perfiles").update({ meta_calorias: plan.calorias }).eq("id", usuario.id);
    setGuardando(false);
    if (error) return;
    onUsar(plan.calorias);
    await cargarPerfiles();
  }
  function descartar() {
    try {
      localStorage.setItem(clave, "no");
    } catch {
      // Sin guardar, vuelve a aparecer la próxima vez.
    }
    setDescartada(true);
  }

  return (
    <div className="meta-recalculada">
      <p className="ajuste-texto">
        Mejoramos la cuenta de cuánto quemás: ahora separa tu día a día del entreno. Con tu plan, tu meta da <strong>{plan.calorias.toLocaleString("es-AR")} kcal</strong> (hoy tenés {metaActual.toLocaleString("es-AR")}).
        {!salud.dia_a_dia || salud.dia_a_dia === "sentado" ? " Si no pasás el día sentado, editá tu plan y elegí cómo es tu día a día." : ""}
      </p>
      <div className="meta-recalculada-botones">
        <button className="boton" onClick={usar} disabled={guardando}>{guardando ? "Guardando…" : `Usar ${plan.calorias.toLocaleString("es-AR")} kcal`}</button>
        <button className="boton-texto" onClick={onEditar}>Revisar mi plan</button>
        <button className="boton-texto" onClick={descartar}>Dejar la mía</button>
      </div>
    </div>
  );
}

export default function Ajustes({ avisar, onEditarCuerpo, pedido }) {
  const { castigo, usuario, yo, cargarPerfiles, salud, grupo, misGrupos, extras } = useDatos();
  const [nombre, setNombre] = useState(yo.nombre);
  const [color, setColor] = useState(yo.color);
  const fotoPerfil = useFotoPerfil(avisar);
  const [meta, setMeta] = useState(yo.meta_calorias);
  // La bio (SQL 063): solo si la base ya la tiene.
  const conBio = "bio" in yo;
  const [bio, setBio] = useState(yo.bio || "");
  const [objetivosMFP, setObjetivosMFP] = useState(false);
  const [tema, setTema] = useState(leerTema());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [seccion, setSeccion] = useState(pedido?.seccion || null);
  // Llegar desde un link (por ejemplo, "Ver receta" en una comida) abre esa sección.
  useEffect(() => { if (pedido?.seccion) setSeccion(pedido.seccion); }, [pedido]);
  // El panel del dueño: lo decide la base (solo una persona).
  const [esDueno, setEsDueno] = useState(false);
  useEffect(() => {
    supabase.rpc("es_dueno").then(({ data }) => setEsDueno(data === true));
  }, []);
  // Los que esperan entrar a los grupos que administro.
  const [pedidosGrupo, setPedidosGrupo] = useState(0);
  useEffect(() => {
    const cargar = () => pedidosPendientes().then(setPedidosGrupo);
    cargar();
    window.addEventListener(EVENTO_PEDIDOS, cargar);
    return () => window.removeEventListener(EVENTO_PEDIDOS, cargar);
  }, []);

  const cambios = nombre.trim() !== yo.nombre || color !== yo.color || meta !== yo.meta_calorias || (conBio && bio.trim() !== (yo.bio || ""));

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Poné un nombre");
    setError("");
    setGuardando(true);
    const { error: err } = await supabase
      .from("perfiles")
      .update({ nombre: nombre.trim(), color, meta_calorias: meta, ...(conBio ? { bio: bio.trim() || null } : {}) })
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

  const estadoSalud = useEstadoSalud();
  // Agrupadas para que se encuentre todo rápido; el orden de los grupos es el del menú.
  const SECCIONES = [
    { grupo: "Vos", id: "perfil", titulo: "Tu perfil", detalle: "Foto, nombre, color, meta y plan", icono: UserRound },
    { grupo: "Vos", id: "registros", titulo: "Registros diarios", detalle: "Creatina, gym, tus actividades y recordatorios", icono: ListChecks },
    { grupo: "Vos", id: "motivacion", titulo: "Viaje y Match Day", detalle: "Tu cuenta regresiva y tu día de partido", icono: Plane },
    { grupo: "Vos", id: "recetas", titulo: "Mis recetas", detalle: "Tus comidas caseras por porción", icono: ChefHat },
    { grupo: "Tu grupo", id: "grupos", titulo: "Grupos", detalle: pedidosGrupo > 0 ? `${pedidosGrupo} ${pedidosGrupo === 1 ? "pedido" : "pedidos"} para entrar` : misGrupos.length > 1 ? misGrupos.map((g) => g.nombre).join(" · ") : "Crear un grupo o sumarte con un código", icono: Users, nuevo: pedidosGrupo > 0, pastilla: String(pedidosGrupo) },
    { grupo: "Tu grupo", id: "caca", titulo: grupo.conBocha ? "La cacona 💩" : "La maldición de la cacona 💩", detalle: grupo.conBocha ? "La regla de las fotos y el Bocha" : "La regla de la foto del día", icono: Skull },
    { grupo: "Tu grupo", id: "privacidad", titulo: "Privacidad", detalle: "Qué ve el grupo", icono: Lock },
    { grupo: "Avisos y novedades", id: "notificaciones", titulo: "Notificaciones", detalle: "Avisos en el celular", icono: Bell },
    ...(ACTUALIZACIONES.length ? [{ grupo: "Avisos y novedades", id: "actualizaciones", titulo: "Actualizaciones", detalle: ACTUALIZACIONES[0].titulo, icono: Megaphone, nuevo: hayNovedades() }] : []),
    { grupo: "Conexiones", id: "salud", titulo: "Apple Salud", detalle: estadoSalud?.ultimo ? textoEstadoSalud(estadoSalud) : "Traer calorías y macros", icono: HeartPulse },
    { grupo: "Conexiones", id: "whoop", titulo: "WHOOP", detalle: "Recuperación, sueño y esfuerzo", icono: Watch },
    { grupo: "La app", id: "apariencia", titulo: "Apariencia y sonidos", detalle: "Tema y efectos de sonido", icono: Palette },
    { grupo: "La app", id: "tutorial", titulo: "Tutorial", detalle: "Cómo se usa cada cosa", icono: BookOpen },
    { grupo: "La app", id: "mejoras", titulo: "Mejoras", detalle: "Pedí cambios para la app", icono: MessageSquarePlus },
    { grupo: "Cuenta", id: "cuenta", titulo: "Cuenta", detalle: "Contraseña, tus datos, cerrar sesión y borrar cuenta", icono: KeyRound },
    { grupo: "Cuenta", id: "legal", titulo: "Privacidad y términos", detalle: "Qué datos guardamos y para qué", icono: FileText },
    ...(esDueno ? [{ grupo: "Solo vos", id: "dueno", titulo: "Panel del dueño", detalle: "Usuarios, números y espacio", icono: Crown }] : []),
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
          {[...new Set(SECCIONES.map((x) => x.grupo))].map((nombre) => (
            <section key={nombre} className="menu-ajustes-grupo" aria-label={nombre}>
              <h2>{nombre}</h2>
              {SECCIONES.filter((x) => x.grupo === nombre).map((x) => (
                <button key={x.id} onClick={() => { setSeccion(x.id); scrollTo(0, 0); }}>
                  <span className="icono-ajuste"><x.icono size={19} /></span>
                  <span><strong>{x.titulo}{x.nuevo && <span className="pastilla-nuevo">{x.pastilla || "Nuevo"}</span>}</strong><small>{x.detalle}</small></span>
                  <ChevronRight className="chevron" size={19} aria-hidden="true" />
                </button>
              ))}
            </section>
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
          {fotoPerfil.elementos}
          <form className="ajustes" onSubmit={guardar}>
            <section className="tarjeta ajuste">
              <div className="perfil-vista">
                {/* Tocar el avatar: elegir la foto de perfil y encuadrarla. */}
                <button type="button" className="perfil-avatar" onClick={fotoPerfil.elegir} aria-label={yo.foto ? "Cambiar foto de perfil" : "Poner foto de perfil"}>
                  <motion.span key={color} initial={{ scale: 0.7 }} animate={{ scale: 1 }} style={{ display: "inline-grid" }}>
                    <Avatar perfil={{ ...yo, nombre, color }} tam={72} />
                  </motion.span>
                  <span className="perfil-avatar-camara" aria-hidden="true"><Camera size={13} /></span>
                </button>
                <label>
                  <span>Nombre</span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} required />
                </label>
              </div>
              {conBio && (
                <label className="campo campo-bio">
                  <span>Bio <small>{bio.length}/120</small></span>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={120} rows={2} placeholder="Ej: Volumen · gym 5 veces por semana" aria-label="Bio" />
                </label>
              )}

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
              {salud && <MetaRecalculada salud={salud} metaActual={yo.meta_calorias} onUsar={setMeta} onEditar={onEditarCuerpo} />}
              <button className="boton boton-secundario" onClick={onEditarCuerpo}><Target size={17} /> {salud ? "Editar mi plan" : "Armar mi plan"}</button>
              <button className="boton boton-secundario" onClick={() => setObjetivosMFP(true)}><RefreshCw size={17} /> Traer objetivos de MyFitnessPal</button>
            </section>
          )}
          <ObjetivosMFP abierta={objetivosMFP} onCerrar={() => setObjetivosMFP(false)} onListo={(kcal) => { setMeta(kcal); setObjetivosMFP(false); }} avisar={avisar} />
        </>
      )}

      {seccion === "notificaciones" && <Notificaciones avisar={avisar} />}
      {seccion === "privacidad" && <Privacidad avisar={avisar} />}
      {seccion === "salud" && <><AppleSalud avisar={avisar} /><LoQueLlego /><MandarASalud avisar={avisar} /></>}
      {seccion === "whoop" && <ConexionWhoop avisar={avisar} />}
      {seccion === "tutorial" && <Tutorial />}
      {seccion === "mejoras" && <Mejoras avisar={avisar} />}
      {seccion === "dueno" && esDueno && <Recuperable><Suspense fallback={<CargandoSeccion />}><PanelDueno /></Suspense></Recuperable>}
      {seccion === "recetas" && <MisRecetas avisar={avisar} abrir={pedido?.receta ? pedido : null} />}
      {seccion === "caca" && <LaCaca avisar={avisar} />}
      {seccion === "registros" && <AjustesRegistros avisar={avisar} />}
      {seccion === "motivacion" && <MiMotivacion avisar={avisar} />}
      {seccion === "actualizaciones" && <Actualizaciones />}
      {seccion === "legal" && <section className="tarjeta ajuste"><PrivacidadTerminos /></section>}
      {seccion === "grupos" && <MisGrupos avisar={avisar} />}

      {seccion === "apariencia" && (
        <section className="tarjeta ajuste">
          {castigo.evo && <p className="castigo-nota">El Bocha Evo te pintó la app de marrón. Volvés a elegir el lunes.</p>}
          <div className="opciones-tema" role="radiogroup" aria-label="Tema" aria-disabled={castigo.evo}>
            {TEMAS.map((t) => (
              <button key={t.id} role="radio" aria-checked={tema === t.id} className={`tema-${t.id}${tema === t.id ? " activo" : ""}`} onClick={() => cambiarTema(t.id)} disabled={castigo.evo}>
                <t.icono size={18} /> {t.texto}
              </button>
            ))}
          </div>
          <Sonidos />
        </section>
      )}

      {seccion === "cuenta" && (
        <>
          <section className="tarjeta ajuste">
            <p className="ajuste-texto">Usuario: <strong>{yo.usuario || yo.nombre}</strong><br />Mail de recuperación: {usuario.email}</p>
            <Contrasena avisar={avisar} />
            <MisDatos usuario={usuario} avisar={avisar} />
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
          <BorrarCuenta usuarioId={usuario.id} />
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
          <p className="ajuste-texto">Activalas en este celu y elegí abajo cuáles querés recibir.</p>
          <button className={activas ? "boton boton-secundario" : "boton"} onClick={alternar} disabled={ocupado}>
            {activas ? <><BellOff size={17} /> Apagar</> : <><Bell size={17} /> Activar</>}
          </button>
          <PreferenciasAvisos activas={activas} avisar={avisar} />
        </>
      ) : (
        <>
          <p className="ajuste-texto">{textos[estado]}</p>
          <PreferenciasAvisos activas={false} avisar={avisar} />
        </>
      )}
    </section>
  );
}

// Una copia de todo lo tuyo en un archivo.
function MisDatos({ usuario, avisar }) {
  const [bajando, setBajando] = useState(false);
  async function bajar() {
    setBajando(true);
    try {
      const datos = await descargarMisDatos(usuario);
      const filas = Object.values(datos.tablas).reduce((t, l) => t + l.length, 0);
      avisar(`Listo: ${filas.toLocaleString("es-AR")} registros`);
    } catch {
      avisar("No pudimos armar el archivo. Probá de nuevo.");
    } finally {
      setBajando(false);
    }
  }
  return (
    <button className="boton boton-secundario" onClick={bajar} disabled={bajando}>
      <Download size={17} /> {bajando ? "Juntando tus datos…" : "Descargar mis datos"}
    </button>
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

// Efectos de sonido: al publicar, al ganar un logro, al sumar un vaso y al tildar un registro.
function Sonidos() {
  const [prendidos, setPrendidos] = useState(sonidosPrendidos);
  function elegir(si) {
    prenderSonidos(si);
    setPrendidos(si);
    if (si) setTimeout(ding, 60);
  }
  return (
    <div className="ajuste-sonidos">
      <p className="ajuste-texto"><strong>Sonidos</strong><br />Al publicar, al ganar logros, al sumar un vaso y al tildar registros. Con el celu en silencio no suenan.</p>
      <div className="opciones-tema" role="radiogroup" aria-label="Sonidos">
        <button role="radio" aria-checked={prendidos} className={prendidos ? "activo" : ""} onClick={() => elegir(true)}><Volume2 size={18} /> Con sonido</button>
        <button role="radio" aria-checked={!prendidos} className={!prendidos ? "activo" : ""} onClick={() => elegir(false)}><VolumeX size={18} /> Sin sonido</button>
      </div>
    </div>
  );
}
