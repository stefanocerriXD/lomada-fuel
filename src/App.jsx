import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CalendarDays, Images, MessageCircle, Plus, Settings, Trophy } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { medalla, medallasGanadas } from "./lib/medallas.js";
import { DatosProvider, useDatos } from "./lib/datos.jsx";
import { Aviso, Avatar, Esqueleto, Festejo, Hoja, resorte, vibrar } from "./componentes/Base.jsx";
import { FormularioContrasena } from "./componentes/Contrasena.jsx";
import Login from "./vistas/Login.jsx";
import Resumen from "./vistas/Resumen.jsx";
import Muro from "./vistas/Muro.jsx";
import Chat from "./vistas/Chat.jsx";
import Retos from "./vistas/Retos.jsx";
import Ajustes from "./vistas/Ajustes.jsx";
import NuevaComida from "./vistas/NuevaComida.jsx";
import Bienvenida from "./vistas/Bienvenida.jsx";

const VISTAS = [
  { id: "resumen", texto: "Resumen", icono: CalendarDays },
  { id: "muro", texto: "Muro", icono: Images },
  { id: "chat", texto: "Chat", icono: MessageCircle },
  { id: "retos", texto: "Retos", icono: Trophy },
  { id: "ajustes", texto: "Ajustes", icono: Settings },
];

const VISTAS_CELULAR = VISTAS.filter((v) => v.id !== "ajustes");
const VISTAS_VALIDAS = VISTAS.map((v) => v.id);

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
        <DatosProvider usuario={sesion.user}>
          <Principal recuperando={recuperando} onRecuperado={() => setRecuperando(false)} />
        </DatosProvider>
      ) : (
        <Login />
      )}
    </MotionConfig>
  );
}

function Cargando() {
  return (
    <div className="pantalla-centro" role="status" aria-label="Cargando">
      <motion.span
        className="cargando-emoji"
        animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        aria-hidden="true"
      >
        🍽️
      </motion.span>
    </div>
  );
}

function Principal({ recuperando, onRecuperado }) {
  const { usuario, yo, estado, salud, pesos, comidas, perfiles, reacciones, extras, cargarExtras } = useDatos();
  const [vista, setVista] = useState(() => {
    const pedida = new URLSearchParams(location.search).get("vista");
    return VISTAS_VALIDAS.includes(pedida) ? pedida : "resumen";
  });
  const entregando = useRef(false);
  const [carga, setCarga] = useState(null);
  const [festejo, setFestejo] = useState(0);
  const [aviso, setAviso] = useState("");
  const [editarCuerpo, setEditarCuerpo] = useState(false);
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

  const alGuardar = useCallback(
    (nueva) => {
      setCarga(null);
      avisar(nueva ? "¡Comida subida!" : "Cambios guardados");
      if (nueva) {
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
    const medir = () => raiz.style.setProperty("--alto-visible", `${visor?.height || window.innerHeight}px`);
    const esTexto = (el) => el?.matches?.('input:not([type="range"]):not([type="checkbox"]):not([type="file"]), textarea');
    const alEnfocar = (e) => {
      if (esTexto(e.target) && matchMedia("(pointer: coarse)").matches) raiz.dataset.teclado = "si";
    };
    const alSalir = () => delete raiz.dataset.teclado;
    medir();
    visor?.addEventListener("resize", medir);
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("focusout", alSalir);
    return () => {
      visor?.removeEventListener("resize", medir);
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("focusout", alSalir);
    };
  }, []);

  // Las medallas se revisan cada vez que cambian los datos que las habilitan.
  useEffect(() => {
    if (!estado.listo || !extras.disponible || entregando.current) return;
    const yaGanadas = extras.medallas.filter((m) => m.usuario_id === usuario.id).map((m) => m.codigo);
    const nuevas = medallasGanadas({ usuarioId: usuario.id, comidas, agua: extras.agua, reacciones, desafios: extras.desafios, perfiles, salud, pesos, yaGanadas });
    if (!nuevas.length) return;
    entregando.current = true;
    supabase
      .from("medallas")
      .insert(nuevas.map((codigo) => ({ usuario_id: usuario.id, codigo })))
      .then(async ({ error }) => {
        if (!error) {
          await cargarExtras();
          avisar(`Medalla nueva: ${medalla(nuevas[0]).nombre}`);
          setFestejo((n) => n + 1);
          vibrar(30);
        }
        entregando.current = false;
      });
  }, [estado.listo, extras, comidas, reacciones, perfiles, salud, pesos, usuario.id, cargarExtras, avisar]);

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
            <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => setVista(v.id)} id="lateral" />
          ))}
        </nav>
        <button className="perfil-lateral" onClick={() => setVista("ajustes")}>
          <Avatar perfil={yo} tam={36} />
          <span>{yo.nombre}</span>
        </button>
      </aside>

      <header className="barra-superior">
        <div className="marca">
          <img src="/icono.svg" alt="" width="30" height="30" />
          <span>Lomada Fuel</span>
        </div>
        <button className="boton-avatar" onClick={() => setVista("ajustes")} aria-label="Ajustes">
          <Settings size={19} />
          <Avatar perfil={yo} tam={34} />
        </button>
      </header>

      <main className={vista === "chat" ? "contenido contenido-chat" : "contenido"}>
        <AnimatePresence initial={false}>
          <motion.div
            key={vista}
            className="vista"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {vista === "resumen" && <Resumen onCargar={abrirCarga} onEditarCuerpo={abrirCuerpo} avisar={avisar} />}
            {vista === "muro" && <Muro onCargar={abrirCarga} avisar={avisar} />}
            {vista === "chat" && <Chat />}
            {vista === "retos" && <Retos avisar={avisar} />}
            {vista === "ajustes" && <Ajustes avisar={avisar} onEditarCuerpo={abrirCuerpo} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="barra-inferior" aria-label="Menú principal">
        {VISTAS_CELULAR.slice(0, 2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => setVista(v.id)} id="inferior" />
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
        {VISTAS_CELULAR.slice(2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => setVista(v.id)} id="inferior" />
        ))}
      </nav>

      <NuevaComida carga={carga} onCerrar={() => setCarga(null)} onGuardar={alGuardar} />
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
