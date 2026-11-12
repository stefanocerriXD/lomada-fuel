import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CalendarDays, Plus, Settings, Trophy, Users } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { avisarGrupo } from "./lib/api.js";
import { medallasGanadas, nombreDeCodigo } from "./lib/medallas.js";
import { DatosProvider, GRUPO_BASE, useDatos } from "./lib/datos.jsx";
import SinGrupo from "./componentes/SinGrupo.jsx";
import SelectorGrupo from "./componentes/SelectorGrupo.jsx";
import { Aviso, Avatar, Esqueleto, Festejo, Hoja, resorte, vibrar } from "./componentes/Base.jsx";
import { FormularioContrasena } from "./componentes/Contrasena.jsx";
import NuevoLogro from "./componentes/NuevoLogro.jsx";
import InstalarApp from "./componentes/InstalarApp.jsx";
import Bocha from "./componentes/Bocha.jsx";
import Fiesta from "./componentes/Fiesta.jsx";
import Login from "./vistas/Login.jsx";
import Resumen from "./vistas/Resumen.jsx";
import Grupo from "./vistas/Grupo.jsx";
import Perfil from "./vistas/Perfil.jsx";
import Retos from "./vistas/Retos.jsx";
import Ajustes from "./vistas/Ajustes.jsx";
import NuevaComida from "./vistas/NuevaComida.jsx";
import Bienvenida from "./vistas/Bienvenida.jsx";
import Importar from "./vistas/Importar.jsx";

const VISTAS = [
  { id: "resumen", texto: "Resumen", icono: CalendarDays },
  { id: "grupo", texto: "Grupo", icono: Users },
  { id: "retos", texto: "Logros", icono: Trophy },
  { id: "ajustes", texto: "Ajustes", icono: Settings },
];

const VISTAS_VALIDAS = VISTAS.map((v) => v.id);
const SECCIONES_GRUPO = ["chat", "imagenes"];
// Al deslizar se recorren en este orden.
const PAGINAS = [["resumen"], ["grupo", "chat"], ["grupo", "imagenes"], ["retos"], ["ajustes"]];
const paginaDe = (vista, seccion) => PAGINAS.findIndex(([v, s]) => v === vista && (!s || s === seccion));
const BORDE_PX = 20;
const DISTANCIA_PX = 70;
const GESTO_MS = 700;

// Una tira que se mueve de costado, como la de días, tiene prioridad sobre cambiar de sección.
function seMueveDeCostado(elemento) {
  for (let el = elemento; el && el !== document.body; el = el.parentElement) {
    if (el.matches("input, textarea, select")) return true;
    // Sobre un mensaje, deslizar es para responderlo.
    if (el.matches(".burbuja")) return true;
    if (el.scrollWidth > el.clientWidth + 2 && ["auto", "scroll"].includes(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}

const FRASES_COMIDA = ["¡Comida subida!", "Arriba. Quedó publicada", "Anotado. Sin juzgar", "Publicada. Que tiemble el grupo", "Listo, gordito"];
const frase = () => FRASES_COMIDA[Math.floor(Math.random() * FRASES_COMIDA.length)];

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      setSesion(nueva);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {cargando ? (
        <Cargando />
      ) : sesion ? (
        <ConGrupo usuario={sesion.user}>
          <Principal recuperando={recuperando} onRecuperado={() => setRecuperando(false)} />
        </ConGrupo>
      ) : (
        <Login />
      )}
    </MotionConfig>
  );
}

const LOMADA = "00000000-0000-4000-8000-00000000a001";

// Cada uno ve solo su grupo. Si la base todavía no tiene grupos, es la Lomada de siempre.
// Cada uno puede estar en varios grupos y mira uno a la vez.
const aGrupo = (g) => ({ id: g.id, nombre: g.nombre, conBocha: g.con_bocha });

function ConGrupo({ usuario, children }) {
  const [grupo, setGrupo] = useState(undefined);
  const [misGrupos, setMisGrupos] = useState([]);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("perfiles").select("grupo_id").eq("id", usuario.id).maybeSingle();
    if (error || !data || data.grupo_id === undefined) return setGrupo(GRUPO_BASE);
    const { data: lista } = await supabase.from("grupos").select("id, nombre, con_bocha").order("nombre");
    const grupos = (lista || []).map(aGrupo);
    setMisGrupos(grupos);
    if (!data.grupo_id) {
      // Sin grupo a la vista pero con alguno propio: se mira el primero.
      if (grupos.length && !(await supabase.rpc("cambiar_grupo", { p_grupo: grupos[0].id })).error) return setGrupo(grupos[0]);
      return setGrupo(null);
    }
    setGrupo(grupos.find((g) => g.id === data.grupo_id) || { id: data.grupo_id, nombre: "", conBocha: data.grupo_id === LOMADA });
  }, [usuario.id]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarGrupo = useCallback(async (id) => {
    const { error } = await supabase.rpc("cambiar_grupo", { p_grupo: id });
    if (error) return false;
    setGrupo(undefined);
    await cargar();
    return true;
  }, [cargar]);

  if (grupo === undefined) return <Cargando />;
  if (grupo === null) return <SinGrupo onAdentro={cargar} />;
  return (
    <DatosProvider key={grupo.id || "lomada"} usuario={usuario} grupo={grupo} misGrupos={misGrupos} cambiarGrupo={cambiarGrupo} recargarGrupos={cargar}>
      {children}
    </DatosProvider>
  );
}

function Cargando() {
  return (
    <div className="pantalla-centro" role="status" aria-label="Cargando">
      <motion.span
        className="cargando-icono"
        animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        aria-hidden="true"
      >
        <img src="/icono.svg" alt="" width="64" height="64" />
      </motion.span>
    </div>
  );
}

function Principal({ recuperando, onRecuperado }) {
  const { usuario, grupo, misGrupos, yo, estado, salud, pesos, comidasLogros, aguaLogros, perfiles, reacciones, extras, cargarExtras, abrirPerfil, respuesta } = useDatos();
  const pedida = useRef(new URLSearchParams(location.search).get("vista")).current;
  const [vista, setVista] = useState(() => {
    if (SECCIONES_GRUPO.includes(pedida)) return "grupo";
    return VISTAS_VALIDAS.includes(pedida) ? pedida : "resumen";
  });
  const [seccion, setSeccion] = useState(SECCIONES_GRUPO.includes(pedida) ? pedida : "chat");
  const [sentido, setSentido] = useState(0);
  const [logroNuevo, setLogroNuevo] = useState(null);
  const toque = useRef(null);
  const terminarLogro = useCallback(() => setLogroNuevo(null), []);

  // La animación entra por el lado hacia el que se va.
  const irA = useCallback((proxima, proximaSeccion) => {
    setSeccion((actual) => {
      const nueva = proximaSeccion || actual;
      setVista((v) => {
        setSentido(Math.sign(paginaDe(proxima, nueva) - paginaDe(v, actual)));
        return proxima;
      });
      return nueva;
    });
  }, []);

  function alEmpezarToque(e) {
    const t = e.touches[0];
    const enElBorde = t.clientX < BORDE_PX || t.clientX > innerWidth - BORDE_PX;
    toque.current = e.touches.length > 1 || enElBorde || seMueveDeCostado(e.target) ? null : { x: t.clientX, y: t.clientY, cuando: Date.now() };
  }

  function alTerminarToque(e) {
    const inicio = toque.current;
    toque.current = null;
    if (!inicio) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.x;
    const dy = t.clientY - inicio.y;
    if (Math.abs(dx) < DISTANCIA_PX || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - inicio.cuando > GESTO_MS) return;
    const destino = PAGINAS[paginaDe(vista, seccion) + (dx < 0 ? 1 : -1)];
    if (!destino) return;
    vibrar(6);
    irA(destino[0], destino[1]);
  }
  const entregando = useRef(false);
  const [carga, setCarga] = useState(null);
  const [festejo, setFestejo] = useState(0);
  const [aviso, setAviso] = useState("");
  const [editarCuerpo, setEditarCuerpo] = useState(false);
  const [importar, setImportar] = useState(null);
  const [bienvenidaVista, setBienvenidaVista] = useState(() => {
    try {
      return localStorage.getItem("comidas-bienvenida") === "vista";
    } catch {
      return false;
    }
  });
  const tiempoAviso = useRef(null);

  const avisar = useCallback((texto) => {
    setAviso(texto);
    clearTimeout(tiempoAviso.current);
    tiempoAviso.current = setTimeout(() => setAviso(""), 2600);
  }, []);

  const abrirCarga = useCallback((datos = {}) => setCarga(datos), []);
  const [fiesta, setFiesta] = useState(false);

  // Responder una foto lleva al chat desde cualquier pantalla.
  useEffect(() => {
    if (!respuesta) return;
    abrirPerfil(null);
    setVista("grupo");
    setSeccion("chat");
  }, [abrirPerfil, respuesta]);

  const abrirImportar = useCallback((fecha, filas) => {
    setCarga(null);
    setImportar({ fecha, filas });
  }, []);

  const alGuardar = useCallback(
    (nueva) => {
      setCarga(null);
      avisar(nueva === "borrada" ? "Comida borrada" : nueva ? frase() : "Cambios guardados");
      if (nueva === true) {
        setFestejo((n) => n + 1);
        vibrar(25);
      }
    },
    [avisar],
  );

  const cerrarCuerpo = useCallback(() => {
    setEditarCuerpo(false);
    setBienvenidaVista(true);
    try {
      localStorage.setItem("comidas-bienvenida", "vista");
    } catch {
      // Sin almacenamiento, solo se vuelve a ofrecer en la próxima visita.
    }
  }, []);

  const abrirCuerpo = useCallback(() => setEditarCuerpo(true), []);

  // En el celular el teclado tapa la barra inferior: se esconde y el chat usa el alto visible.
  useEffect(() => {
    const raiz = document.documentElement;
    const visor = window.visualViewport;
    const esTexto = (el) => el?.matches?.('input:not([type="range"]):not([type="checkbox"]):not([type="file"]), textarea');
    const medir = () => {
      raiz.style.setProperty("--alto-visible", `${visor?.height || window.innerHeight}px`);
      raiz.style.setProperty("--arriba-visible", `${visor?.offsetTop || 0}px`);
      // Un campo que desaparece abierto no siempre avisa que perdió el foco.
      if (raiz.dataset.teclado && !esTexto(document.activeElement)) delete raiz.dataset.teclado;
    };
    let salida;
    const alEnfocar = (e) => {
      // Pasar de un campo a un botón no cancela la salida: ahí el teclado sí se cierra.
      if (!esTexto(e.target) || !matchMedia("(pointer: coarse)").matches) return;
      clearTimeout(salida);
      raiz.dataset.teclado = "si";
    };
    // Con una pausa, para que lo que se tocó no se mueva antes de terminar el toque.
    const alSalir = () => {
      clearTimeout(salida);
      salida = setTimeout(() => {
        delete raiz.dataset.teclado;
        medir();
      }, 200);
    };
    medir();
    visor?.addEventListener("resize", medir);
    visor?.addEventListener("scroll", medir);
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("focusout", alSalir);
    return () => {
      clearTimeout(salida);
      visor?.removeEventListener("resize", medir);
      visor?.removeEventListener("scroll", medir);
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("focusout", alSalir);
    };
  }, []);

  // Las medallas se revisan cada vez que cambian los datos que las habilitan.
  useEffect(() => {
    if (!estado.listo || !extras.disponible || !comidasLogros || entregando.current) return;
    const yaGanadas = extras.medallas.filter((m) => m.usuario_id === usuario.id).map((m) => m.codigo);
    const nuevas = medallasGanadas({ usuarioId: usuario.id, comidas: comidasLogros, agua: aguaLogros, reacciones, desafios: [], perfiles, salud, pesos, yaGanadas });
    if (!nuevas.length) return;
    entregando.current = true;
    supabase
      .from("medallas")
      .insert(nuevas.map((codigo) => ({ usuario_id: usuario.id, codigo })))
      .then(async ({ error }) => {
        if (!error) {
          await cargarExtras();
          const nivel = [...nuevas].reverse().find((c) => nombreDeCodigo(c));
          if (nivel) {
            setLogroNuevo(nivel);
            // El primer nivel de cada logro se festeja solo en tu celular; al grupo se le avisa desde el segundo.
            if (Number(nivel.split(":")[1]) >= 2) avisarGrupo("medalla", nivel, nombreDeCodigo(nivel));
          }
          setFestejo((n) => n + 1);
          vibrar(30);
        }
        entregando.current = false;
      });
  }, [estado.listo, extras, comidasLogros, aguaLogros, reacciones, perfiles, salud, pesos, usuario.id, cargarExtras, avisar]);

  // Resultado de la autorización de WHOOP, que vuelve a la app con un parámetro en la dirección.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("vista")) history.replaceState(null, "", location.pathname);
    const resultado = params.get("whoop");
    if (!resultado) return;
    history.replaceState(null, "", location.pathname);
    setVista("ajustes");
    avisar(
      { conectado: "WHOOP conectado", cancelado: "No se conectó WHOOP" }[resultado] || "No pudimos conectar WHOOP",
    );
  }, [avisar]);

  if (!estado.listo) return <Esqueleto />;

  if (estado.error) {
    return (
      <div className="pantalla-centro">
        <div className="tarjeta error-pantalla">
          <h1>No pudimos cargar tus datos</h1>
          <p>{estado.error}</p>
          <button className="boton" onClick={() => location.reload()}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="marco">
      <aside className="lateral">
        <div className="marca">
          <img src="/icono.svg" alt="" width="36" height="36" />
          <span>Lomada Fuel</span>
        </div>
        <button className="boton boton-grande" onClick={() => abrirCarga()}>
          <Plus size={20} /> Subir comida
        </button>
        <nav aria-label="Menú principal">
          {VISTAS.map((v) => (
            <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => irA(v.id)} id="lateral" />
          ))}
        </nav>
        <button className="perfil-lateral" onClick={() => abrirPerfil(yo.id)}>
          <Avatar perfil={yo} tam={36} />
          <span>{yo.nombre}</span>
        </button>
      </aside>

      <header className="barra-superior">
        <div className="marca">
          <img src="/icono.svg" alt="" width="30" height="30" />
          {misGrupos.length > 1 ? <SelectorGrupo /> : <span>Lomada Fuel</span>}
        </div>
        <button className="boton-avatar" onClick={() => abrirPerfil(yo.id)} aria-label="Tu perfil">
          <Avatar perfil={yo} tam={36} />
        </button>
      </header>

      <InstalarApp />
      <main className={vista === "grupo" && seccion === "chat" ? "contenido contenido-chat" : "contenido"} onTouchStart={alEmpezarToque} onTouchEnd={alTerminarToque}>
        <AnimatePresence initial={false}>
          <motion.div
            key={vista}
            className="vista"
            initial={{ opacity: 0, x: sentido * 44 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {vista === "resumen" && <Resumen onCargar={abrirCarga} onImportar={abrirImportar} onEditarCuerpo={abrirCuerpo} onFiesta={() => setFiesta(true)} avisar={avisar} />}
            {vista === "grupo" && <Grupo seccion={seccion} onSeccion={(s) => irA("grupo", s)} onCargar={abrirCarga} avisar={avisar} sentido={sentido} />}
            {vista === "retos" && <Retos />}
            {vista === "ajustes" && <Ajustes avisar={avisar} onEditarCuerpo={abrirCuerpo} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="barra-inferior" aria-label="Menú principal">
        {VISTAS.slice(0, 2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => irA(v.id)} id="inferior" />
        ))}
        <motion.button
          className="boton-subir"
          onClick={() => abrirCarga()}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={resorte}
          aria-label="Subir comida"
        >
          <Plus size={28} strokeWidth={2.6} />
        </motion.button>
        {VISTAS.slice(2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => irA(v.id)} id="inferior" />
        ))}
      </nav>

      <Perfil onEditar={() => { abrirPerfil(null); setVista("ajustes"); }} onEditarComida={(comida) => { abrirPerfil(null); abrirCarga({ comida }); }} />
      <NuevaComida carga={carga} onCerrar={() => setCarga(null)} onGuardar={alGuardar} onImportarDia={abrirImportar} onFiesta={() => { setCarga(null); setFiesta(true); }} avisar={avisar} />
      <Fiesta abierta={fiesta} onCerrar={() => setFiesta(false)} avisar={avisar} />
      <Importar
        pedido={importar}
        onCerrar={() => setImportar(null)}
        onGuardar={(fotos) => {
          setImportar(null);
          avisar(fotos ? `Importado, con ${fotos === 1 ? "1 foto" : `${fotos} fotos`}` : "Día importado");
          setFestejo((n) => n + 1);
        }}
      />
      <Bienvenida
        abierta={editarCuerpo || (salud === null && !bienvenidaVista && !recuperando)}
        onCerrar={cerrarCuerpo}
        onGuardar={() => {
          cerrarCuerpo();
          setFestejo((n) => n + 1);
          avisar("¡Plan listo!");
        }}
      />
      <Hoja abierta={recuperando} onCerrar={onRecuperado} titulo="Creá tu nueva contraseña">
        <FormularioContrasena
          onListo={() => {
            onRecuperado();
            avisar("Contraseña actualizada");
          }}
        />
      </Hoja>
      <Festejo key={festejo} activo={festejo > 0} />
      <NuevoLogro codigo={logroNuevo} onTerminar={terminarLogro} />
      {grupo.conBocha && <Bocha />}
      <Aviso texto={aviso} />
    </div>
  );
}

function BotonVista({ datos, activa, onClick, id }) {
  const Icono = datos.icono;
  return (
    <button className={activa ? "item-menu activo" : "item-menu"} onClick={onClick} aria-current={activa ? "page" : undefined}>
      {activa && <motion.span className="item-fondo" layoutId={`fondo-${id}`} transition={resorte} />}
      <Icono size={21} strokeWidth={activa ? 2.4 : 2} />
      <span>{datos.texto}</span>
    </button>
  );
}
