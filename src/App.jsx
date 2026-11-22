import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { borrarFotosGuardadas } from "./lib/fotosGuardadas.js";
import { EVENTO_IR } from "./lib/navegar.js";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CalendarDays, Plus, Settings, Trophy, Users } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { avisarGrupo } from "./lib/api.js";
import { medallasGanadas, nivelesGuardados, nivelGeneral, nombreDeCodigo } from "./lib/medallas.js";
import { DatosProvider, GRUPO_BASE, useDatos } from "./lib/datos.jsx";
import SinGrupo from "./componentes/SinGrupo.jsx";
import SelectorGrupo from "./componentes/SelectorGrupo.jsx";
import SubidaNivel from "./componentes/SubidaNivel.jsx";
import { Aviso, Avatar, datosMarco, Festejo, Hoja, Insignia, marcoDe, resorte, vibrar } from "./componentes/Base.jsx";
import { FormularioContrasena } from "./componentes/Contrasena.jsx";
import NuevoLogro from "./componentes/NuevoLogro.jsx";
import InstalarApp from "./componentes/InstalarApp.jsx";
import Bocha from "./componentes/Bocha.jsx";
import HojaFestejo from "./componentes/MarcaFiesta.jsx";
import Login from "./vistas/Login.jsx";
import Resumen from "./vistas/Resumen.jsx";
import Grupo from "./vistas/Grupo.jsx";
// Lo que no se ve al abrir la app se baja aparte, después: el primer arranque es más liviano.
const Perfil = perezosa(() => import("./vistas/Perfil.jsx"));
const Retos = perezosa(() => import("./vistas/Retos.jsx"));
const Ajustes = perezosa(() => import("./vistas/Ajustes.jsx"));
const NuevaComida = perezosa(() => import("./vistas/NuevaComida.jsx"));
const Bienvenida = perezosa(() => import("./vistas/Bienvenida.jsx"));
const Importar = perezosa(() => import("./vistas/Importar.jsx"));
const Fiesta = perezosa(() => import("./componentes/Fiesta.jsx"));
const InformeSemanal = perezosa(() => import("./componentes/InformeSemanal.jsx"));
import { EVENTO_ACTUALIZACIONES, hayNovedades } from "./data/actualizaciones.js";
import TirarParaActualizar from "./componentes/TirarParaActualizar.jsx";
import Logo from "./componentes/Logo.jsx";
import { alivio, campanita, cerrar, ding, pestana, pop, prepararSonidos } from "./lib/sonidos.js";
import { FOTOS_POR_DIA, fotosDelDia } from "./lib/multas.js";
import { EVENTO_PEDIDOS, pedidosPendientes } from "./lib/grupos.js";
import { fechaLocal } from "./lib/fechas.js";
import { quitarSplash } from "./lib/splash.js";
import { perezosa } from "./lib/perezosa.js";
import Recuperable, { CargandoSeccion } from "./componentes/Recuperable.jsx";

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
    // Fotos ampliadas y hojas abiertas: el gesto es de ellas (pasar de foto, agrandar, cerrar).
    if (el.matches(".visor-foto, .imagen-zoom, .lupa, .receta-foto-grande, .capa")) return true;
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

  // Los sonidos se destraban con el primer toque (el navegador no deja sonar antes).
  useEffect(() => prepararSonidos(), []);
  // Cerrar con la cruz (cualquier botón "Cerrar…"): un "pff" corto.
  useEffect(() => {
    const alTocar = (e) => {
      if (e.target.closest?.('button[aria-label^="Cerrar"]')) cerrar();
    };
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      if (evento === "SIGNED_OUT") borrarFotosGuardadas();
      setSesion(nueva);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  // Sin sesión, el login ya está para mostrar: se va el logo de carga.
  useEffect(() => {
    if (!cargando && !sesion) quitarSplash();
  }, [cargando, sesion]);

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

  // Quien estaba sin grupo y entra (lo aceptaron o creó el suyo): campanita.
  const grupoAntes = useRef(undefined);
  useEffect(() => {
    if (grupoAntes.current === null && grupo) campanita();
    if (grupo !== undefined) grupoAntes.current = grupo;
  }, [grupo]);

  useEffect(() => {
    if (grupo === null) quitarSplash();
  }, [grupo]);

  if (grupo === undefined) return <Cargando />;
  if (grupo === null) return <SinGrupo onAdentro={cargar} />;
  return (
    <DatosProvider key={grupo.id || "lomada"} usuario={usuario} grupo={grupo} misGrupos={misGrupos} cambiarGrupo={cambiarGrupo} recargarGrupos={cargar}>
      {children}
    </DatosProvider>
  );
}

// El mismo movimiento que la pantalla de carga de index.html: los cubiertos entran y el disco gira con una pausa.
function Cargando() {
  return (
    <div className="pantalla-centro pantalla-carga" role="status" aria-label="Cargando">
      <span className="carga-logo" aria-hidden="true"><Logo tam={96} /></span>
    </div>
  );
}

function Principal({ recuperando, onRecuperado }) {
  const { usuario, grupo, misGrupos, yo, estado, salud, pesos, comidas, comidasLogros, aguaLogros, registrosLogros, actualizarTodo, perfiles, reacciones, extras, cargarExtras, abrirPerfil, respuesta, sinLeer, recetaAlChat } = useDatos();
  // Con los datos listos (o un error para mostrar) se va el logo de carga.
  useEffect(() => {
    if (estado.listo || estado.error) quitarSplash();
  }, [estado.listo, estado.error]);
  // Puntito en Ajustes cuando hay actualizaciones que no viste.
  const [novedad, setNovedad] = useState(hayNovedades);
  useEffect(() => {
    const ver = () => setNovedad(hayNovedades());
    window.addEventListener(EVENTO_ACTUALIZACIONES, ver);
    return () => window.removeEventListener(EVENTO_ACTUALIZACIONES, ver);
  }, []);
  // Y cuando alguien pide entrar a un grupo que administro.
  const [pedidosGrupo, setPedidosGrupo] = useState(0);
  useEffect(() => {
    const cargar = () => pedidosPendientes().then(setPedidosGrupo);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    cargar();
    window.addEventListener(EVENTO_PEDIDOS, cargar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener(EVENTO_PEDIDOS, cargar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);
  const puntoAjustes = novedad || pedidosGrupo > 0;
  // Alguien nuevo pide entrar a un grupo mío: campanita.
  const pedidosAntes = useRef(null);
  useEffect(() => {
    if (pedidosAntes.current !== null && pedidosGrupo > pedidosAntes.current) campanita();
    pedidosAntes.current = pedidosGrupo;
  }, [pedidosGrupo]);
  // La foto del día que te salva de la caca: alivio (después del ding de publicar).
  const salvadoHoy = extras.multasActivas && fotosDelDia(comidas, usuario.id, fechaLocal()) >= FOTOS_POR_DIA;
  const salvadoAntes = useRef(null);
  useEffect(() => {
    if (salvadoAntes.current === false && salvadoHoy) setTimeout(alivio, 700);
    salvadoAntes.current = salvadoHoy;
  }, [salvadoHoy]);
  const pedida = useRef(new URLSearchParams(location.search).get("vista")).current;
  const [vista, setVista] = useState(() => {
    if (SECCIONES_GRUPO.includes(pedida)) return "grupo";
    if (pedida === "mejoras") return "ajustes";
    return VISTAS_VALIDAS.includes(pedida) ? pedida : "resumen";
  });
  const [seccion, setSeccion] = useState(SECCIONES_GRUPO.includes(pedida) ? pedida : "chat");
  const [sentido, setSentido] = useState(0);
  const [logroNuevo, setLogroNuevo] = useState(null);
  const toque = useRef(null);
  const terminarLogro = useCallback(() => setLogroNuevo(null), []);
  const [pedidoAjustes, setPedidoAjustes] = useState(() => (pedida === "mejoras" ? { vista: "ajustes", seccion: "mejoras", vez: 0 } : null));

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

  // Links internos (de una comida a su receta): cierra lo que esté abierto y va a la sección.
  useEffect(() => {
    const ir = (e) => {
      abrirPerfil(null);
      setCarga(null);
      irA(e.detail.vista, e.detail.vista === "grupo" ? e.detail.seccion : undefined);
      if (e.detail.vista === "ajustes") setPedidoAjustes({ ...e.detail, vez: Date.now() });
      scrollTo(0, 0);
    };
    window.addEventListener(EVENTO_IR, ir);
    return () => window.removeEventListener(EVENTO_IR, ir);
  }, [irA, abrirPerfil]);

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
  // El día que se está mirando en el Resumen: el + carga ahí.
  const [diaResumen, setDiaResumen] = useState(null);
  const abrirCargaDelDia = useCallback(() => abrirCarga(diaResumen && diaResumen !== fechaLocal() ? { fecha: diaResumen } : {}), [abrirCarga, diaResumen]);
  const [fiesta, setFiesta] = useState(pedida === "fiesta");

  // Responder una foto lleva al chat desde cualquier pantalla.
  useEffect(() => {
    if (!respuesta) return;
    abrirPerfil(null);
    setVista("grupo");
    setSeccion("chat");
  }, [abrirPerfil, respuesta]);

  // Compartir una receta lleva al chat con el mensaje escrito, desde cualquier pantalla.
  useEffect(() => {
    if (!recetaAlChat) return;
    abrirPerfil(null);
    setCarga(null);
    setVista("grupo");
    setSeccion("chat");
  }, [abrirPerfil, recetaAlChat]);

  const abrirImportar = useCallback((fecha, filas) => {
    setCarga(null);
    setImportar({ fecha, filas });
  }, []);

  const alGuardar = useCallback(
    (nueva) => {
      setCarga(null);
      avisar(nueva === "borrada" ? "Comida borrada" : nueva === "planeada" ? "Guardada. Cuando la comas, sumale la foto" : nueva ? frase() : "Cambios guardados");
      if (nueva === true) {
        setFestejo((n) => n + 1);
        vibrar(25);
        ding();
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
    const nuevas = medallasGanadas({ usuarioId: usuario.id, comidas: comidasLogros, agua: aguaLogros, reacciones, desafios: [], perfiles, salud, pesos, yaGanadas, registros: registrosLogros });
    if (!nuevas.length) return;
    entregando.current = true;
    supabase
      .from("medallas")
      .insert(nuevas.map((codigo) => ({ usuario_id: usuario.id, codigo })))
      .then(async ({ error }) => {
        if (!error) {
          await cargarExtras();
          const nivel = [...nuevas].reverse().find((c) => nombreDeCodigo(c));
          if (nivel) setLogroNuevo(nivel);
          // Los logros se festejan solo en tu celular. Al grupo se le avisa solo cuando cambiás de categoría (Plata, Oro… LOMADA LEGENDARY).
          const antes = marcoDe(nivelGeneral(nivelesGuardados(yaGanadas)).nivel);
          const ahora = marcoDe(nivelGeneral(nivelesGuardados([...yaGanadas, ...nuevas])).nivel);
          const marco = ahora !== antes && datosMarco(ahora);
          if (marco && nivel) avisarGrupo("medalla", nivel, `Llegó a ${marco[2]} ${marco[3]}`);
          setFestejo((n) => n + 1);
          vibrar(30);
        }
        entregando.current = false;
      });
  }, [estado.listo, extras, comidasLogros, aguaLogros, registrosLogros, reacciones, perfiles, salud, pesos, usuario.id, cargarExtras, avisar]);

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

  if (!estado.listo) return <Cargando />;

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
          <Logo tam={40} />
          <span>Lomada Fuel</span>
        </div>
        <button className="boton boton-grande" onClick={() => { pop(); abrirCarga(); }}>
          <Plus size={20} /> Subir comida
        </button>
        <nav aria-label="Menú principal">
          {VISTAS.map((v) => (
            <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => { pestana(VISTAS.indexOf(v)); irA(v.id); }} id="lateral" insignia={v.id === "grupo" ? sinLeer : 0} punto={v.id === "ajustes" && puntoAjustes} />
          ))}
        </nav>
        <button className="perfil-lateral" onClick={() => abrirPerfil(yo.id)}>
          <Avatar perfil={yo} tam={36} />
          <span>{yo.nombre}</span>
        </button>
      </aside>

      <header className="barra-superior">
        <div className="marca">
          <Logo tam={34} />
          {misGrupos.length > 1 ? <SelectorGrupo /> : <span>Lomada Fuel</span>}
        </div>
        <button className="boton-avatar" onClick={() => abrirPerfil(yo.id)} aria-label="Tu perfil">
          <Avatar perfil={yo} tam={36} />
        </button>
      </header>

      <InstalarApp />
      <TirarParaActualizar activo={!(vista === "grupo" && seccion === "chat")} onActualizar={actualizarTodo} />
      <main className={vista === "grupo" && seccion === "chat" ? "contenido contenido-chat" : "contenido"} onTouchStart={alEmpezarToque} onTouchEnd={alTerminarToque}>
        <AnimatePresence initial={false}>
          <motion.div
            key={vista}
            className="vista"
            initial={{ opacity: 0, x: sentido * 44 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            {vista === "resumen" && <Resumen onCargar={abrirCarga} onImportar={abrirImportar} onEditarCuerpo={abrirCuerpo} onFiesta={() => setFiesta(true)} onDia={setDiaResumen} avisar={avisar} />}
            {vista === "grupo" && <Grupo seccion={seccion} onSeccion={(s) => irA("grupo", s)} onCargar={abrirCarga} avisar={avisar} sentido={sentido} />}
            <Recuperable>
            <Suspense fallback={<CargandoSeccion />}>
              {vista === "retos" && <Retos />}
              {vista === "ajustes" && <Ajustes avisar={avisar} onEditarCuerpo={abrirCuerpo} pedido={pedidoAjustes} />}
            </Suspense>
            </Recuperable>
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="barra-inferior" aria-label="Menú principal">
        {VISTAS.slice(0, 2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => { pestana(VISTAS.indexOf(v)); irA(v.id); }} id="inferior" insignia={v.id === "grupo" ? sinLeer : 0} punto={v.id === "ajustes" && puntoAjustes} />
        ))}
        <motion.button
          className="boton-subir"
          onClick={() => { pop(); vista === "resumen" ? abrirCargaDelDia() : abrirCarga(); }}
          whileTap={{ scale: 0.88 }}
          whileHover={{ scale: 1.06 }}
          transition={resorte}
          aria-label="Subir comida"
        >
          <Plus size={28} strokeWidth={2.6} />
        </motion.button>
        {VISTAS.slice(2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => { pestana(VISTAS.indexOf(v)); irA(v.id); }} id="inferior" insignia={v.id === "grupo" ? sinLeer : 0} punto={v.id === "ajustes" && puntoAjustes} />
        ))}
      </nav>

      <Recuperable>
      <Suspense fallback={null}>
      <Perfil onEditar={() => { abrirPerfil(null); setVista("ajustes"); }} onEditarComida={(comida) => { abrirPerfil(null); abrirCarga({ comida }); }} avisar={avisar} />
      <NuevaComida carga={carga} onCerrar={() => setCarga(null)} onGuardar={alGuardar} onImportarDia={abrirImportar} onFiesta={() => { setCarga(null); setFiesta(true); }} onPostre={(comida, extra) => setCarga({ comida, postre: true, extra })} avisar={avisar} />
      <Fiesta abierta={fiesta} onCerrar={() => setFiesta(false)} avisar={avisar} />
      <HojaFestejo />
      <InformeSemanal abiertoAlInicio={pedida === "informe"} />
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
      </Suspense>
      </Recuperable>
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
      <SubidaNivel ocupado={Boolean(logroNuevo)} />
      {grupo.conBocha && <Bocha />}
      <Aviso texto={aviso} />
    </div>
  );
}

function BotonVista({ datos, activa, onClick, id, insignia = 0, punto = false }) {
  const Icono = datos.icono;
  return (
    <button className={activa ? "item-menu activo" : "item-menu"} onClick={onClick} aria-current={activa ? "page" : undefined} aria-label={insignia ? `${datos.texto}, ${insignia} ${insignia === 1 ? "mensaje sin leer" : "mensajes sin leer"}` : undefined}>
      {activa && <motion.span className="item-fondo" layoutId={`fondo-${id}`} transition={resorte} />}
      {insignia > 0 && <Insignia n={insignia} />}
      {!insignia && punto && <span className="punto-novedad" aria-hidden="true" />}
      <Icono size={21} strokeWidth={activa ? 2.4 : 2} />
      <span>{datos.texto}</span>
    </button>
  );
}

