import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell, BellOff, Check, Copy, HeartPulse, KeyRound, LogOut, Monitor, Moon, RefreshCw, Sun, Target, Unplug, Watch } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { guardarTema, leerTema } from "../lib/tema.js";
import { accionWhoop, URL_SALUD } from "../lib/api.js";
import { calcularPlan } from "../lib/cuerpo.js";
import { FormularioContrasena } from "../componentes/Contrasena.jsx";
import { activarAvisos, avisosActivos, desactivarAvisos, estadoAvisos } from "../lib/avisos.js";
import { Avatar } from "../componentes/Base.jsx";

const EMOJIS = ["🍽️", "🍕", "🥑", "🌮", "🍔", "🍣", "🥩", "🍝", "🧉", "🥐", "🍩", "🍦", "🥦", "🍗", "🌶️", "🍺"];
const COLORES = ["#E4572E", "#E0A100", "#3FA45B", "#17A2A2", "#3F7FD9", "#7A5CD6", "#CE5AA8", "#8C6A4F"];
const TEMAS = [
  { id: "auto", texto: "Automático", icono: Monitor },
  { id: "claro", texto: "Claro", icono: Sun },
  { id: "oscuro", texto: "Oscuro", icono: Moon },
];

export default function Ajustes({ avisar, onEditarCuerpo }) {
  const { usuario, yo, cargarPerfiles, salud } = useDatos();
  const [nombre, setNombre] = useState(yo.nombre);
  const [emoji, setEmoji] = useState(yo.emoji);
  const [color, setColor] = useState(yo.color);
  const [meta, setMeta] = useState(yo.meta_calorias);
  const [tema, setTema] = useState(leerTema());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambios = nombre.trim() !== yo.nombre || emoji !== yo.emoji || color !== yo.color || meta !== yo.meta_calorias;

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Poné un nombre");
    setError("");
    setGuardando(true);
    const { error: err } = await supabase
      .from("perfiles")
      .update({ nombre: nombre.trim(), emoji, color, meta_calorias: meta })
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

  return (
    <>
      <header className="titulo-vista">
        <div>
          <p className="sobretitulo">Tu cuenta</p>
          <h1>Ajustes</h1>
        </div>
      </header>

      <form className="ajustes" onSubmit={guardar}>
        <section className="tarjeta ajuste">
          <h2>Tu perfil</h2>
          <div className="perfil-vista">
            <motion.span key={`${emoji}${color}`} initial={{ scale: 0.7 }} animate={{ scale: 1 }}>
              <Avatar perfil={{ emoji, color }} tam={72} />
            </motion.span>
            <label>
              <span>Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} required />
            </label>
          </div>

          <fieldset>
            <legend>Tu emoji</legend>
            <div className="opciones-emoji">
              {EMOJIS.map((e) => (
                <button type="button" key={e} className={emoji === e ? "activo" : ""} onClick={() => setEmoji(e)} aria-pressed={emoji === e} aria-label={`Emoji ${e}`}>
                  {e}
                </button>
              ))}
            </div>
          </fieldset>

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

        <section className="tarjeta ajuste">
          <h2>Meta diaria</h2>
          <label className="meta">
            <span className="meta-valor"><strong>{meta.toLocaleString("es-AR")}</strong> kcal por día</span>
            <input
              type="range"
              min="1200"
              max="4500"
              step="50"
              value={meta}
              onChange={(e) => setMeta(Number(e.target.value))}
              aria-label="Meta diaria de calorías"
            />
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
        <section className="tarjeta ajuste">
          <h2>Tu cuerpo y objetivo</h2>
          {salud ? (
            <p className="ajuste-texto">
              {Number(salud.altura_cm)} cm · {Number(salud.peso_kg).toLocaleString("es-AR")} kg · objetivo {Number(salud.peso_objetivo).toLocaleString("es-AR")} kg. Quemás unas {calcularPlan(salud).gasto.toLocaleString("es-AR")} kcal por día. Solo lo ves vos.
            </p>
          ) : (
            <p className="ajuste-texto">Cargá tus medidas, tu actividad y tu objetivo para calcular cuánto quemás y tu meta diaria.</p>
          )}
          <button className="boton boton-secundario" onClick={onEditarCuerpo}><Target size={17} /> {salud ? "Editar mi plan" : "Armar mi plan"}</button>
        </section>
      )}

      <Privacidad avisar={avisar} />

      <Notificaciones avisar={avisar} />

      <AppleSalud avisar={avisar} />

      <ConexionWhoop avisar={avisar} />

      <section className="tarjeta ajuste">
        <h2>Apariencia</h2>
        <div className="opciones-tema" role="radiogroup" aria-label="Tema">
          {TEMAS.map((t) => (
            <button key={t.id} role="radio" aria-checked={tema === t.id} className={tema === t.id ? "activo" : ""} onClick={() => cambiarTema(t.id)}>
              <t.icono size={18} /> {t.texto}
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta ajuste">
        <h2>Datos de alimentos</h2>
        <p className="ajuste-texto">
          Los productos vienen de Open Food Facts, una base colaborativa; los alimentos genéricos, de USDA FoodData Central. Las comidas típicas son valores aproximados. Revisá siempre el envase si necesitás precisión.
        </p>
      </section>

      <section className="tarjeta ajuste">
        <h2>Cuenta</h2>
        <p className="ajuste-texto">Usuario: <strong>{yo.usuario || yo.nombre}</strong><br />Mail de recuperación: {usuario.email}</p>
        <Contrasena avisar={avisar} />
        <button className="boton boton-secundario" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} /> Cerrar sesión
        </button>
      </section>
    </>
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
        El grupo ve tu nombre, tu meta de calorías, tus comidas con sus fotos y macros, tu agua y tus medallas. Tu peso, altura, edad, objetivo, ayunos, favoritas y datos de WHOOP son solo tuyos.
      </p>
      <label className="interruptor">
        <input type="checkbox" checked={!!yo.comidas_privadas} onChange={cambiar} />
        <span>Mis comidas nuevas arrancan como privadas</span>
      </label>
      <p className="nota">Una comida privada no aparece en el muro, ni en los desafíos, ni en los premios del bot. También podés elegirlo en cada comida.</p>
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
          <p className="ajuste-texto">Avisos de mensajes nuevos, comidas del grupo y comentarios en tus fotos.</p>
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

function AppleSalud({ avisar }) {
  const { usuario, extras } = useDatos();
  const [conectado, setConectado] = useState(null);
  const [token, setToken] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!extras.disponible) return;
    supabase.from("tokens_salud").select("usuario_id").eq("usuario_id", usuario.id).maybeSingle()
      .then(({ data, error }) => setConectado(error ? null : Boolean(data)));
  }, [extras.disponible, usuario.id]);

  if (conectado === null) return null;

  async function crear() {
    setOcupado(true);
    const { data, error } = await supabase.rpc("crear_token_salud");
    setOcupado(false);
    if (error) return avisar("No se pudo crear la llave");
    setToken(data);
    setConectado(true);
  }

  async function copiar(texto, nombre) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(`${nombre} copiada`);
    } catch {
      avisar("Mantené apretado el texto para copiarlo");
    }
  }

  return (
    <section className="tarjeta ajuste">
      <h2>Apple Salud</h2>
      <p className="ajuste-texto">Solo en iPhone. Un Atajo manda a la app las calorías, macros y peso que tengas en Salud.</p>
      {token ? (
        <>
          <p className="ajuste-texto"><strong>Guardá esta llave ahora:</strong> no se vuelve a mostrar.</p>
          <div className="dato-copiable"><code>{token}</code><button className="boton-icono" onClick={() => copiar(token, "Llave")} aria-label="Copiar llave"><Copy size={17} /></button></div>
          <div className="dato-copiable"><code>{URL_SALUD}</code><button className="boton-icono" onClick={() => copiar(URL_SALUD, "Dirección")} aria-label="Copiar dirección"><Copy size={17} /></button></div>
          <ol className="pasos-atajo">
            <li>Abrí <strong>Atajos</strong> y creá uno nuevo.</li>
            <li>Agregá una búsqueda de muestras de Salud por cada dato: energía de la dieta, proteína, carbohidratos y grasas de hoy, agrupadas por día.</li>
            <li>Agregá <strong>Obtener contenido de URL</strong> con esa dirección, método POST y cuerpo JSON: token, calorias, proteinas, carbohidratos y grasas.</li>
            <li>En <strong>Automatización</strong>, hacé que corra todas las noches.</li>
          </ol>
        </>
      ) : (
        <button className={conectado ? "boton boton-secundario" : "boton"} onClick={crear} disabled={ocupado}>
          <HeartPulse size={17} /> {conectado ? "Crear otra llave" : "Conectar Apple Salud"}
        </button>
      )}
    </section>
  );
}
