import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CalendarDays, Plus, Settings, Trophy, Users } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { avisarGrupo } from "./lib/api.js";
import { medallasGanadas, nombreDeCodigo } from "./lib/medallas.js";
import { DatosProvider, useDatos } from "./lib/datos.jsx";
import { Aviso, Avatar, Esqueleto, Festejo, Hoja, resorte, vibrar } from "./componentes/Base.jsx";
import { FormularioContrasena } from "./componentes/Contrasena.jsx";
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
  { id: "retos", texto: "Retos", icono: Trophy },
  { id: "ajustes", texto: "Ajustes", icono: Settings },
];

const VISTAS_VALIDAS = VISTAS.map((v) => v.id);
const SECCIONES_GRUPO = ["chat", "imagenes"];

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
  const { usuario, yo, estado, salud, pesos, comidasLogros, aguaLogros, perfiles, reacciones, extras, cargarExtras, abrirPerfil, respuesta } = useDatos();
  const pedida = useRef(new URLSearchParams(location.search).get("vista")).current;
  const [vista, setVista] = useState(() => {
    if (SECCIONES_GRUPO.includes(pedida)) return "grupo";
    return VISTAS_VALIDAS.includes(pedida) ? pedida : "resumen";
  });
  const [seccion, setSeccion] = useState(SECCIONES_GRUPO.includes(pedida) ? pedida : "chat");
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
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("focusout", alSalir);
    return () => {
      clearTimeout(salida);
      visor?.removeEventListener("resize", medir);
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("focusout", alSalir);
    };
  }, []);

  // Las medallas se revisan cada vez que cambian los datos que las habilitan.
  useEffect(() => {
    if (!estado.listo || !extras.disponible || !comidasLogros || entregando.current) return;
    const yaGanadas = extras.medallas.filter((m) => m.usuario_id === usuario.id).map((m) => m.codigo);
    const nuevas = medallasGanadas({ usuarioId: usuario.id, comidas: comidasLogros, agua: aguaLogros, reacciones, desafios: extras.desafios, perfiles, salud, pesos, yaGanadas });
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
            avisar(`Nuevo logro: ${nombreDeCodigo(nivel)}`);
            avisarGrupo("medalla", nivel, nombreDeCodigo(nivel));
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
            <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => setVista(v.id)} id="lateral" />
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
          <span>Lomada Fuel</span>
        </div>
        <button className="boton-avatar" onClick={() => abrirPerfil(yo.id)} aria-label="Tu perfil">
          <Avatar perfil={yo} tam={36} />
        </button>
      </header>

      <main className={vista === "grupo" && seccion === "chat" ? "contenido contenido-chat" : "contenido"}>
        <AnimatePresence initial={false}>
          <motion.div
            key={vista}
            className="vista"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {vista === "resumen" && <Resumen onCargar={abrirCarga} onImportar={abrirImportar} onEditarCuerpo={abrirCuerpo} avisar={avisar} />}
            {vista === "grupo" && <Grupo seccion={seccion} onSeccion={setSeccion} onCargar={abrirCarga} avisar={avisar} />}
            {vista === "retos" && <Retos avisar={avisar} />}
            {vista === "ajustes" && <Ajustes avisar={avisar} onEditarCuerpo={abrirCuerpo} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="barra-inferior" aria-label="Menú principal">
        {VISTAS.slice(0, 2).map((v) => (
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
        {VISTAS.slice(2).map((v) => (
          <BotonVista key={v.id} datos={v} activa={vista === v.id} onClick={() => setVista(v.id)} id="inferior" />
        ))}
      </nav>

      <Perfil onEditar={() => { abrirPerfil(null); setVista("ajustes"); }} onEditarComida={(comida) => { abrirPerfil(null); abrirCarga({ comida }); }} />
      <NuevaComida carga={carga} onCerrar={() => setCarga(null)} onGuardar={alGuardar} onImportarDia={abrirImportar} />
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
