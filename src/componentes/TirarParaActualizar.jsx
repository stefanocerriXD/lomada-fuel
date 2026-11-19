import { useEffect, useRef } from "react";
import { vibrar } from "./Base.jsx";
import Logo from "./Logo.jsx";
import { clic } from "../lib/sonidos.js";

const UMBRAL = 70; // Cuánto hay que bajar (ya amortiguado) para que actualice.
const MAXIMO = 110;
const MINIMO_MS = 900; // Aunque llegue enseguida, el logo gira un ratito para que se note.
const VUELTA_MS = 850; // Una vuelta del plato mientras carga.
const GRADOS_POR_PX = 3;

// Deslizar hacia abajo estando arriba de todo: baja el logo y el plato gira con el dedo. Al soltar sigue girando
// desde donde quedó (sin saltos) mientras los cubiertos "comen", y al terminar frena suave y se va achicando.
export default function TirarParaActualizar({ activo = true, onActualizar }) {
  const indicador = useRef(null);
  const estado = useRef({ desde: null, distancia: 0, actualizando: false, avisado: false });
  const accion = useRef(onActualizar);
  accion.current = onActualizar;

  useEffect(() => {
    if (!activo) return undefined;
    const el = indicador.current;
    const disco = () => el?.querySelector(".logo-disco");
    let giro = null;
    let angulo = 0;
    const rotar = (grados) => {
      angulo = grados;
      const d = disco();
      if (d) d.style.transform = `rotate(${grados}deg)`;
    };
    const pintar = (distancia, girando = false) => {
      if (!el) return;
      const avance = Math.min(distancia / UMBRAL, 1);
      // Baja, aparece y crece con el dedo.
      el.style.transform = `translate(-50%, ${distancia - 64}px) scale(${0.55 + 0.45 * avance})`;
      el.style.opacity = String(distancia > 4 ? Math.min(1, avance * 1.4) : 0);
      el.classList.toggle("girando", girando);
      el.classList.toggle("listo", !girando && avance >= 1);
      if (!girando && !giro) rotar(distancia * GRADOS_POR_PX);
    };
    // Sigue girando desde el ángulo en que quedó.
    const empezarGiro = () => {
      const d = disco();
      if (!d?.animate) return;
      giro = d.animate([{ transform: `rotate(${angulo}deg)` }, { transform: `rotate(${angulo + 360}deg)` }], { duration: VUELTA_MS, iterations: Infinity });
    };
    // Frena suave hasta quedar derecho.
    const frenarGiro = async () => {
      const d = disco();
      if (!giro || !d) return;
      const vuelta = ((Number(giro.currentTime) || 0) % VUELTA_MS) / VUELTA_MS;
      const ahora = angulo + 360 * vuelta;
      giro.cancel();
      giro = null;
      const destino = Math.ceil((ahora + 90) / 360) * 360;
      const freno = d.animate([{ transform: `rotate(${ahora}deg)` }, { transform: `rotate(${destino}deg)` }], { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" });
      rotar(0);
      await freno.finished.catch(() => {});
    };
    const soltar = (animado = true) => {
      if (el) el.style.transition = animado ? "transform 0.32s cubic-bezier(0.3, 0.7, 0.4, 1), opacity 0.25s ease" : "none";
      pintar(0);
    };

    // No se activa sobre hojas, fotos ampliadas o campos de texto, ni si la página no está arriba de todo.
    const bloqueado = (objetivo) => objetivo?.closest?.(".capa, .visor-foto, .lupa, .receta-foto-grande, input, textarea, select, [contenteditable]");

    const inicio = (e) => {
      const s = estado.current;
      if (s.actualizando || e.touches.length !== 1 || window.scrollY > 0 || bloqueado(e.target)) { s.desde = null; return; }
      s.desde = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      s.distancia = 0;
      s.avisado = false;
      s.eje = null;
      if (el) el.style.transition = "none";
    };
    const mover = (e) => {
      const s = estado.current;
      if (!s.desde || s.actualizando) return;
      const dx = e.touches[0].clientX - s.desde.x;
      const dy = e.touches[0].clientY - s.desde.y;
      if (!s.eje && Math.hypot(dx, dy) > 8) s.eje = Math.abs(dy) > Math.abs(dx) * 1.3 ? "y" : "x";
      // De costado es cambiar de sección; hacia arriba es scrollear.
      if (s.eje !== "y" || dy <= 0 || window.scrollY > 0) {
        if (s.distancia) { s.distancia = 0; soltar(false); }
        return;
      }
      s.distancia = Math.min(MAXIMO, dy * 0.5);
      if (s.distancia >= UMBRAL && !s.avisado) { s.avisado = true; vibrar(10); }
      if (s.distancia < UMBRAL) s.avisado = false;
      pintar(s.distancia);
    };
    const fin = async () => {
      const s = estado.current;
      if (!s.desde) return;
      s.desde = null;
      if (s.distancia < UMBRAL) { s.distancia = 0; soltar(); return; }
      s.actualizando = true;
      clic();
      if (el) el.style.transition = "transform 0.2s ease";
      pintar(UMBRAL, true);
      empezarGiro();
      const desde = Date.now();
      try {
        await accion.current?.();
      } catch {
        // Si algo no llegó, se vuelve a intentar solo al rato.
      }
      await new Promise((listo) => setTimeout(listo, Math.max(0, MINIMO_MS - (Date.now() - desde))));
      el?.classList.remove("girando");
      await frenarGiro();
      s.actualizando = false;
      s.distancia = 0;
      soltar();
    };

    window.addEventListener("touchstart", inicio, { passive: true });
    window.addEventListener("touchmove", mover, { passive: true });
    window.addEventListener("touchend", fin);
    window.addEventListener("touchcancel", fin);
    return () => {
      giro?.cancel();
      window.removeEventListener("touchstart", inicio);
      window.removeEventListener("touchmove", mover);
      window.removeEventListener("touchend", fin);
      window.removeEventListener("touchcancel", fin);
    };
  }, [activo]);

  if (!activo) return null;
  return (
    <div ref={indicador} className="tirar-actualizar" aria-hidden="true">
      <Logo tam={40} />
    </div>
  );
}
