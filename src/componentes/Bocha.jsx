import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { aplicarTema, leerTema } from "../lib/tema.js";
import { prepararSonidos, risa, splat } from "../lib/sonidos.js";

// Cuánto molesta cada castigo. El Bocha Evo arranca con la pantalla ya llena y vuelve mucho más seguido.
const MODOS = {
  dia: { iniciales: 2, maximo: 8, cada: [45000, 90000], tamano: [70, 150], tiros: 1 },
  evo: { iniciales: 14, maximo: 32, cada: [18000, 35000], tamano: [110, 260], tiros: 3 },
};
const AUSENCIA_PARA_VOLVER = 5 * 60 * 1000;
// Cuántos píxeles hay que frotar para sacar una mancha entera. Las del Bocha Evo cuestan el doble.
const FROTAR = { dia: 380, evo: 760 };
const azar = (a, b) => a + Math.random() * (b - a);

// Cada mancha es un salpicón distinto: un centro irregular con puntas y gotitas alrededor.
function salpicon() {
  const puntos = 16;
  const borde = Array.from({ length: puntos }, (_, i) => {
    const angulo = (i / puntos) * Math.PI * 2;
    const largo = Math.random() < 0.25 ? azar(38, 47) : azar(24, 32);
    return [50 + Math.cos(angulo) * largo, 50 + Math.sin(angulo) * largo];
  });
  const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${medio(borde[puntos - 1], borde[0]).map((n) => n.toFixed(1)).join(" ")}`;
  borde.forEach((p, i) => {
    const m = medio(p, borde[(i + 1) % puntos]);
    d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  });
  const gotas = Array.from({ length: Math.round(azar(4, 8)) }, () => {
    const angulo = azar(0, Math.PI * 2);
    const distancia = azar(40, 49);
    return { x: 50 + Math.cos(angulo) * distancia, y: 50 + Math.sin(angulo) * distancia, r: azar(1.5, 4.5) };
  });
  return { d: d + " Z", gotas };
}

function nuevaMancha([min, max]) {
  return { id: crypto.randomUUID(), x: azar(-8, 82), y: azar(4, 84), tam: azar(min, max), giro: azar(0, 360), suciedad: 1, ...salpicon() };
}

// La caca pegada en la pantalla: no se puede tocar, pero tapa lo que hay abajo.
function Mancha({ mancha }) {
  return (
    <motion.svg
      className="mancha-caca"
      data-mancha={mancha.id}
      viewBox="0 0 100 100"
      style={{ left: `${mancha.x}%`, top: `${mancha.y}%`, width: mancha.tam, height: mancha.tam, rotate: mancha.giro }}
      initial={{ scale: 0.15, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.12 + mancha.suciedad * 0.88 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 520, damping: 16 }}
      aria-hidden="true"
    >
      <path d={mancha.d} fill="#4a2c10" />
      <path d={mancha.d} fill="#6b4119" transform="translate(12 12) scale(0.76)" />
      {mancha.gotas.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r={g.r} fill="#4a2c10" />)}
      <ellipse cx="40" cy="38" rx="9" ry="5" fill="#fff" opacity="0.18" transform="rotate(-30 40 38)" />
      <circle cx="58" cy="60" r="3" fill="#8a5a2b" opacity="0.8" />
      <circle cx="46" cy="55" r="2" fill="#8a5a2b" opacity="0.7" />
    </motion.svg>
  );
}

// El Bocha se asoma por un borde, se ríe y tira caca. Con el Bocha Evo, la app se pone marrón y no hay chat.
export default function Bocha() {
  const { castigo, fotos, imagenesBocha } = useDatos();
  const modo = castigo?.evo ? "evo" : castigo?.diario ? "dia" : null;
  const config = modo ? MODOS[modo] : null;
  const imagen = modo ? fotos[modo === "evo" ? imagenesBocha.evo : imagenesBocha.dia] || fotos[imagenesBocha.dia] : null;
  const [manchas, setManchas] = useState([]);
  const [cartel, setCartel] = useState(false);
  const [asomado, setAsomado] = useState(null);
  const [limpiando, setLimpiando] = useState(false);
  const ultimo = useRef(null);
  const ocultaDesde = useRef(null);

  useEffect(() => prepararSonidos(), []);

  // Arranca con algunas manchas y el cartel; sin castigo, se limpia todo.
  useEffect(() => {
    if (!config) {
      setManchas([]);
      setCartel(false);
      return;
    }
    setManchas(Array.from({ length: config.iniciales }, () => nuevaMancha(config.tamano)));
    setCartel(true);
  }, [modo]); // eslint-disable-line react-hooks/exhaustive-deps

  // El Bocha Evo pinta la app de marrón hasta que termina la semana.
  useEffect(() => {
    if (modo !== "evo") return undefined;
    document.documentElement.dataset.tema = "caca";
    return () => aplicarTema(leerTema());
  }, [modo]);

  // Al volver a la app después de un rato, el Bocha te saluda otra vez.
  useEffect(() => {
    if (!modo) return undefined;
    const alCambiar = () => {
      if (document.visibilityState === "hidden") ocultaDesde.current = Date.now();
      else if (ocultaDesde.current && Date.now() - ocultaDesde.current > AUSENCIA_PARA_VOLVER) setCartel(true);
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, [modo]);

  const tirar = useCallback(
    (cantidad) => {
      for (let i = 0; i < cantidad; i += 1) {
        setTimeout(() => {
          splat(modo === "evo" ? 1.2 : 1);
          setManchas((prev) => [...prev, nuevaMancha(config.tamano)].slice(-config.maximo));
        }, i * 260);
      }
    },
    [config, modo],
  );

  // Cada tanto se asoma por un borde.
  useEffect(() => {
    if (!config || cartel) return undefined;
    let reloj;
    const programar = () => {
      reloj = setTimeout(() => {
        if (document.visibilityState === "visible") {
          setAsomado(["izquierda", "derecha", "abajo"][Math.floor(azar(0, 3))]);
          risa({ evo: modo === "evo" });
          setTimeout(() => tirar(config.tiros), 900);
          setTimeout(() => setAsomado(null), 2300);
        }
        programar();
      }, azar(...config.cada));
    };
    programar();
    return () => clearTimeout(reloj);
  }, [config, cartel, modo, tirar]);

  // Frotar con el dedo: cada mancha que tocás pierde suciedad según cuánto la frotás.
  function frotar(e) {
    const previo = ultimo.current;
    ultimo.current = { x: e.clientX, y: e.clientY };
    if (!previo) return;
    const recorrido = Math.hypot(e.clientX - previo.x, e.clientY - previo.y);
    if (!recorrido) return;
    const tocadas = new Set(document.elementsFromPoint(e.clientX, e.clientY).map((el) => el.closest?.("[data-mancha]")?.dataset.mancha).filter(Boolean));
    if (!tocadas.size) return;
    setManchas((prev) => prev.map((m) => (tocadas.has(m.id) ? { ...m, suciedad: m.suciedad - recorrido / FROTAR[modo] } : m)).filter((m) => m.suciedad > 0));
  }

  // Sin manchas no hay nada que limpiar.
  useEffect(() => {
    if (limpiando && !manchas.length) setLimpiando(false);
  }, [limpiando, manchas.length]);

  if (!modo) return null;

  function cerrarCartel() {
    setCartel(false);
    risa({ evo: modo === "evo" });
    setTimeout(() => tirar(modo === "evo" ? 4 : 2), 700);
  }

  return (
    <>
      <div
        className={limpiando ? "capa-manchas limpiando" : "capa-manchas"}
        aria-hidden="true"
        onPointerDown={(e) => { ultimo.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={limpiando ? frotar : undefined}
        onPointerUp={() => { ultimo.current = null; }}
        onPointerCancel={() => { ultimo.current = null; }}
      >
        <AnimatePresence>{manchas.map((m) => <Mancha key={m.id} mancha={m} />)}</AnimatePresence>
      </div>

      {manchas.length > 0 && !cartel && (
        <button className={limpiando ? "boton-limpiar activo" : "boton-limpiar"} onClick={() => setLimpiando(!limpiando)} aria-pressed={limpiando}>
          {limpiando ? <><X size={16} /> Listo</> : <><Sparkles size={16} /> Limpiar</>}
        </button>
      )}
      {limpiando && <p className="aviso-limpiar">Frotá las manchas con el dedo para limpiarlas</p>}

      <AnimatePresence>
        {asomado && imagen && (
          <motion.img
            key={asomado}
            className={`bocha-asomado ${asomado}`}
            src={imagen}
            alt=""
            initial={asomado === "abajo" ? { y: "100%" } : { x: asomado === "izquierda" ? "-100%" : "100%" }}
            animate={asomado === "abajo" ? { y: "35%" } : { x: asomado === "izquierda" ? "-35%" : "35%" }}
            exit={asomado === "abajo" ? { y: "100%" } : { x: asomado === "izquierda" ? "-100%" : "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartel && (
          <motion.div
            className={`cartel-bocha ${modo}`}
            role="dialog"
            aria-modal="true"
            aria-label={modo === "evo" ? "Bocha Evo" : "La maldición del Bocha"}
            onClick={cerrarCartel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {imagen && <motion.img src={imagen} alt="" initial={{ scale: 0.6, y: 60 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 180, damping: 14 }} />}
            <strong>{modo === "evo" ? "BOCHA EVO" : "Te cayó la maldición del Bocha"}</strong>
            <span>
              {modo === "evo"
                ? "Fuiste el que más cacas juntó la semana pasada. Hasta el lunes: pantalla llena de caca y sin chat."
                : "Ayer no subiste ninguna foto. Subí la de hoy para sacártelo de encima."}
            </span>
            <small>Tocá para seguir</small>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
