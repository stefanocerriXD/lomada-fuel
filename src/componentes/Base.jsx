import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { NIVEL_MAXIMO } from "../lib/medallas.js";

export const resorte = { type: "spring", stiffness: 420, damping: 34 };

export function vibrar(ms = 10) {
  try {
    // El navegador solo permite vibrar después de que la persona tocó la pantalla.
    if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(ms);
  } catch {
    // No todos los celulares lo permiten.
  }
}

// El marco del avatar mejora con el nivel general: uno nuevo cada 3 niveles al principio, más espaciados arriba.
// [desde qué nivel, clave, nombre, emoji]
export const MARCOS = [
  [3, "cobre", "Cobre", "🟤"],
  [6, "bronce", "Bronce", "🥉"],
  [9, "plata", "Plata", "🥈"],
  [12, "oro", "Oro", "🥇"],
  [15, "esmeralda", "Esmeralda", "💚"],
  [18, "zafiro", "Zafiro", "💙"],
  [21, "rubi", "Rubí", "❤️"],
  [24, "fuego", "Fuego", "🔥"],
  [27, "hielo", "Hielo", "❄️"],
  [30, "rayo", "Rayo", "⚡"],
  [33, "neon", "Neón", "💡"],
  [36, "diamante", "Diamante", "💎"],
  [40, "galaxia", "Galaxia", "🌌"],
  [45, "magma", "Magma", "🌋"],
  [50, "aurora", "Aurora", "🌈"],
  [60, "legendario", "Legendario", "👑"],
  [75, "mitico", "Mítico", "🐉"],
  [90, "inmortal", "Inmortal", "☀️"],
  // El final: todos los logros al máximo.
  [NIVEL_MAXIMO, "lomada", "LOMADA LEGENDARY", "🔥"],
];
export const marcoDe = (nivel) => MARCOS.filter(([desde]) => (nivel || 0) >= desde).pop()?.[1] || null;
export const datosMarco = (clave) => MARCOS.find((m) => m[1] === clave) || null;
export const proximoMarco = (nivel) => MARCOS.find(([desde]) => (nivel || 0) < desde) || null;

// Siluetas con puntas: cada punta tiene su largo (en % del radio), así las llamas no son todas iguales.
export function puntas(largos, interior) {
  const n = largos.length;
  const puntos = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? largos[i / 2] : interior;
    const a = (Math.PI * i) / n - Math.PI / 2;
    puntos.push(`${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${puntos.join(", ")})`;
}
const repetir = (n, largo) => Array.from({ length: n }, () => largo);
const FORMAS = {
  esmeralda: puntas(repetir(8, 50), 47),
  rubi: puntas(repetir(6, 50), 45),
  fuego: puntas([50, 43, 48, 42, 50, 44, 47, 42, 49, 43, 47, 42, 48, 44], 37),
  hielo: puntas([50, 42, 50, 42, 50, 42, 50, 42], 36.5),
  rayo: puntas(repetir(10, 50), 37.5),
  magma: puntas([50, 44, 48, 45, 50, 43, 47, 45, 49, 44, 46, 45], 38),
  mitico: puntas([50, 44, 48, 43, 50, 45, 47, 43, 50, 44, 48, 43, 50, 45, 47, 43], 37.5),
  inmortal: puntas(repetir(24, 50), 40),
  lomada: puntas([50, 40, 47, 38, 50, 41, 46, 38, 50, 40, 47, 39, 50, 41, 46, 38], 34),
};
// Cuánto lugar deja el marco alrededor de la cara (en % del tamaño).
const HUECO = { esmeralda: 9, rubi: 10, fuego: 17, hielo: 17, rayo: 16, magma: 16, mitico: 16, inmortal: 13, lomada: 20, galaxia: 10, neon: 11 };

export function Avatar({ perfil, tam = 40 }) {
  const marco = marcoDe(perfil?.nivel);
  const forma = marco && FORMAS[marco];
  const hueco = marco ? (HUECO[marco] ?? 8.5) : 0;
  const deco = tam >= 28;
  return (
    <span
      className={marco ? `avatar con-marco marco-${marco}${forma ? " con-forma" : ""}` : "avatar"}
      style={{
        width: tam,
        height: tam,
        fontSize: tam * (marco ? 0.42 * (1 - hueco / 60) : 0.42),
        "--avatar": perfil?.color || "#E4572E",
        "--borde-marco": `${Math.max(2, tam * 0.085)}px`,
        ...(marco ? { "--hueco": `${(tam * hueco) / 100}px` } : {}),
        ...(forma ? { "--forma": forma } : {}),
      }}
      aria-hidden="true"
    >
      <span className="avatar-letra">{(perfil?.nombre || "").trim().charAt(0).toUpperCase() || "L"}</span>
      {deco && marco === "zafiro" && <span className="avatar-orbita" />}
      {deco && (marco === "galaxia" || marco === "mitico") && <span className="avatar-estrellas" />}
      {deco && ["legendario", "mitico"].includes(marco) && <span className="avatar-corona">👑</span>}
      {deco && marco === "inmortal" && <span className="avatar-halo" />}
      {deco && marco === "lomada" && <img className="avatar-lomada" src="/lomada.svg" alt="" />}
      {deco && marco === "lomada" && <span className="avatar-brasas"><i /><i /><i /></span>}
      {deco && ["oro", "diamante", "hielo", "aurora"].includes(marco) && <span className="avatar-chispa">✦</span>}
      {perfil?.fiesta?.gol && perfil.fiesta.modo === "resaca" && !["legendario", "mitico"].includes(marco) && <span className="avatar-corona avatar-gol">👑</span>}
      {perfil?.calavera ? <span className="avatar-caca calavera">💀</span> : perfil?.caca && <span className={`avatar-caca ${perfil.caca}`}>💩</span>}
    </span>
  );
}

// El logo de la Lomada prendido fuego: el premio de LOMADA LEGENDARY.
const LLAMAS_LOGO = puntas([50, 39, 46, 37, 50, 40, 45, 37, 49, 39, 46, 37, 50, 40, 45, 38, 49, 39, 46, 37], 33);
export function LogoLegendario({ tam = 120 }) {
  return (
    <span className="logo-legendario" style={{ width: tam, height: tam, "--forma": LLAMAS_LOGO }} aria-hidden="true">
      <span className="ll-brillo" />
      <span className="ll-llamas" />
      <span className="ll-llamas atras" />
      <img className="ll-logo" src="/lomada.svg" alt="" />
      <span className="ll-brasas">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</span>
    </span>
  );
}

// Una sola línea que se corre de costado: nunca sale volando si la pantalla cambia de alto o de posición.
export function Indicador({ indice, total }) {
  return <motion.span className="selector-fondo" style={{ width: `${100 / total}%` }} initial={false} animate={{ x: `${indice * 100}%` }} transition={resorte} aria-hidden="true" />;
}

export function Numero({ valor, decimales = 0 }) {
  const quieto = useReducedMotion();
  const [visible, setVisible] = useState(valor);
  const previo = useRef(valor);

  useEffect(() => {
    if (quieto) return setVisible(valor);
    const control = animate(previo.current, valor, { duration: 0.7, ease: [0.16, 1, 0.3, 1], onUpdate: setVisible });
    previo.current = valor;
    return () => control.stop();
  }, [valor, quieto]);

  return <>{Number(visible).toLocaleString("es-AR", { maximumFractionDigits: decimales, minimumFractionDigits: decimales })}</>;
}

export function Anillo({ valor, meta, tam = 168, children }) {
  const grosor = tam * 0.085;
  const radio = (tam - grosor) / 2;
  const avance = meta > 0 ? Math.min(valor / meta, 1) : 0;
  return (
    <div className="anillo" style={{ width: tam, height: tam }}>
      <svg viewBox={`0 0 ${tam} ${tam}`} width={tam} height={tam} aria-hidden="true">
        <circle cx={tam / 2} cy={tam / 2} r={radio} fill="none" stroke="var(--pista)" strokeWidth={grosor} />
        <motion.circle
          cx={tam / 2}
          cy={tam / 2}
          r={radio}
          fill="none"
          stroke="var(--acento)"
          strokeWidth={grosor}
          strokeLinecap="round"
          transform={`rotate(-90 ${tam / 2} ${tam / 2})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: avance, opacity: avance > 0 ? 1 : 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="anillo-centro">{children}</div>
    </div>
  );
}

const SERIES = [
  { id: "p", texto: "Proteínas", kcalPorGramo: 4 },
  { id: "c", texto: "Carbos", kcalPorGramo: 4 },
  { id: "g", texto: "Grasas", kcalPorGramo: 9 },
];

export function BarraMacros({ total, compacta = false }) {
  const partes = SERIES.map((s) => ({ ...s, gramos: total[s.id] || 0, kcal: (total[s.id] || 0) * s.kcalPorGramo }));
  const suma = partes.reduce((t, p) => t + p.kcal, 0);
  const descripcion = partes.map((p) => `${p.texto} ${Math.round(p.gramos)} g`).join(", ");
  return (
    <div className="macros">
      <div className={compacta ? "barra-macros compacta" : "barra-macros"} role="img" aria-label={descripcion}>
        {suma === 0 ? (
          <span className="barra-vacia" />
        ) : (
          partes
            .filter((p) => p.kcal > 0)
            .map((p) => (
              <motion.span
                key={p.id}
                className={`segmento s-${p.id}`}
                title={`${p.texto}: ${Math.round(p.gramos)} g (${Math.round((p.kcal / suma) * 100)}% de las calorías)`}
                initial={{ flexGrow: 0 }}
                animate={{ flexGrow: p.kcal / suma }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            ))
        )}
      </div>
      <ul className="leyenda">
        {partes.map((p) => (
          <li key={p.id}>
            <span className={`punto s-${p.id}`} />
            {!compacta && <span className="leyenda-nombre">{p.texto}</span>}
            {compacta && <span className="leyenda-nombre">{p.texto[0]}</span>}
            <strong>{Math.round(p.gramos)} g</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hoja({ abierta, onCerrar, titulo, pie, children, ancha = false }) {
  const arrastre = useDragControls();

  useEffect(() => {
    if (!abierta) return;
    const tecla = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    // Evita que el fondo se mueva mientras se desliza la hoja.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [abierta, onCerrar]);

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div className="capa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar}>
          <motion.div
            className={ancha ? "hoja ancha" : "hoja"}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={resorte}
            drag="y"
            dragControls={arrastre}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.75 }}
            onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 600) && onCerrar()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hoja-asa" onPointerDown={(e) => arrastre.start(e)} aria-hidden="true"><i /></div>
            <header className="hoja-cabecera" onPointerDown={(e) => arrastre.start(e)}>
              <h2>{titulo}</h2>
              <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
                <X size={20} />
              </button>
            </header>
            <div className="hoja-cuerpo">{children}</div>
            {pie && <footer className="hoja-pie">{pie}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Vacio({ icono: Icono, titulo, texto, children }) {
  return (
    <motion.div className="vacio" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <motion.span
        className="vacio-icono"
        animate={{ y: [0, -7, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        aria-hidden="true"
      >
        <Icono size={40} strokeWidth={1.7} />
      </motion.span>
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children}
    </motion.div>
  );
}

const PARTICULAS = ["#c43d15", "#f0a33a", "#2f6fd0", "#3fa45b", "#b8388e"];

export function Festejo({ activo }) {
  const quieto = useReducedMotion();
  if (!activo || quieto) return null;
  return (
    <div className="festejo" aria-hidden="true">
      {Array.from({ length: 20 }, (_, i) => {
        const angulo = (i / 20) * Math.PI * 2;
        const distancia = 120 + (i % 4) * 45;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: Math.cos(angulo) * distancia, y: Math.sin(angulo) * distancia + 60, opacity: 0, scale: 1.2, rotate: i * 37 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
            style={{ background: PARTICULAS[i % PARTICULAS.length] }}
          />
        );
      })}
    </div>
  );
}

export function Aviso({ texto }) {
  return (
    <AnimatePresence>
      {texto && (
        <motion.div
          className="aviso"
          role="status"
          initial={{ opacity: 0, y: 24, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 24, x: "-50%" }}
          transition={resorte}
        >
          {texto}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Esqueleto() {
  return (
    <div className="esqueleto" role="status" aria-label="Cargando">
      <i className="e-titulo" />
      <i className="e-tira" />
      <i className="e-heroe" />
      <i className="e-fila" />
      <i className="e-fila" />
    </div>
  );
}

// Globito rojo con los mensajes sin leer.
export function Insignia({ n }) {
  return (
    <motion.span className="insignia" aria-hidden="true" key={n > 99 ? "99+" : n} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={resorte}>
      {n > 99 ? "99+" : n}
    </motion.span>
  );
}
