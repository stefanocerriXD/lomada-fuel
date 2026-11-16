import { useEffect, useRef } from "react";

const MAXIMO = 5;
const DOBLE = 2.5;
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const medio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Una foto que se agranda con dos dedos o con doble toque, y se mueve con un dedo cuando está agrandada.
// Sin zoom, un dedo de costado pasa de foto (onDeslizar) y hacia abajo cierra (onBajar).
export default function ImagenZoom({ src, alt, className, desactivado = false, onDeslizar, onBajar, onZoom }) {
  const caja = useRef(null);
  const img = useRef(null);
  const vista = useRef({ s: 1, x: 0, y: 0 });
  const dedos = useRef(new Map());
  const gesto = useRef(null);
  const toque = useRef(null);
  const ultimoToque = useRef(null);
  const agrandada = useRef(false);
  const avisos = useRef({ onDeslizar, onBajar, onZoom });
  avisos.current = { onDeslizar, onBajar, onZoom };

  function pintar(animado = false, extra = { x: 0, y: 0 }) {
    const el = img.current;
    if (!el) return;
    const { s, x, y } = vista.current;
    el.style.transition = animado ? "transform 0.25s ease" : "none";
    el.style.transform = `translate3d(${x + extra.x}px, ${y + extra.y}px, 0) scale(${s})`;
    const ahora = s > 1.01;
    if (ahora !== agrandada.current) {
      agrandada.current = ahora;
      avisos.current.onZoom?.(ahora);
    }
  }

  // Cuánto se puede mover sin dejar ver el fondo de los costados.
  function limitar(v) {
    const c = caja.current?.getBoundingClientRect();
    const el = img.current;
    if (!c || !el) return v;
    const proporcion = el.naturalWidth && el.naturalHeight ? el.naturalWidth / el.naturalHeight : c.width / c.height;
    const ancho = Math.min(c.width, c.height * proporcion);
    const alto = ancho / proporcion;
    const mx = Math.max(0, (ancho * v.s - c.width) / 2);
    const my = Math.max(0, (alto * v.s - c.height) / 2);
    return { s: v.s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }

  // Un punto de la pantalla relativo al centro de la foto.
  function relativo(p) {
    const c = caja.current.getBoundingClientRect();
    return { x: p.x - (c.left + c.width / 2), y: p.y - (c.top + c.height / 2) };
  }

  // Agranda (o achica) dejando quieto el punto que está debajo de los dedos.
  function escalar(s, centro, base = vista.current, inicio = centro) {
    const nuevo = Math.min(MAXIMO, Math.max(1, s));
    const px = (inicio.x - base.x) / base.s;
    const py = (inicio.y - base.y) / base.s;
    vista.current = limitar({ s: nuevo, x: centro.x - px * nuevo, y: centro.y - py * nuevo });
  }

  function reiniciar(animado = true) {
    vista.current = { s: 1, x: 0, y: 0 };
    pintar(animado);
  }

  useEffect(() => {
    reiniciar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // En la compu: rueda con Ctrl (o el gesto de pellizcar del trackpad).
  useEffect(() => {
    const el = caja.current;
    if (!el || desactivado) return undefined;
    const rueda = (e) => {
      if (!e.ctrlKey && vista.current.s <= 1) return;
      e.preventDefault();
      const centro = relativo({ x: e.clientX, y: e.clientY });
      if (e.ctrlKey) escalar(vista.current.s * Math.exp(-e.deltaY / 150), centro);
      else vista.current = limitar({ ...vista.current, x: vista.current.x - e.deltaX, y: vista.current.y - e.deltaY });
      pintar();
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desactivado]);

  function abajo(e) {
    if (desactivado) return;
    caja.current.setPointerCapture?.(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const lista = [...dedos.current.values()];
    if (lista.length === 1) {
      toque.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      gesto.current = { tipo: vista.current.s > 1.01 ? "mover" : "deslizar", desde: { x: e.clientX, y: e.clientY }, base: { ...vista.current }, eje: null };
    } else if (lista.length === 2) {
      toque.current = null;
      const m = relativo(medio(lista[0], lista[1]));
      gesto.current = { tipo: "pellizcar", dist: distancia(lista[0], lista[1]) || 1, base: { ...vista.current }, inicio: m };
      pintar();
    }
  }

  function mover(e) {
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    const lista = [...dedos.current.values()];
    if (g.tipo === "pellizcar" && lista.length >= 2) {
      escalar(g.base.s * (distancia(lista[0], lista[1]) / g.dist), relativo(medio(lista[0], lista[1])), g.base, g.inicio);
      pintar();
    } else if (g.tipo === "mover") {
      vista.current = limitar({ ...g.base, x: g.base.x + e.clientX - g.desde.x, y: g.base.y + e.clientY - g.desde.y });
      pintar();
    } else if (g.tipo === "deslizar") {
      const dx = e.clientX - g.desde.x;
      const dy = e.clientY - g.desde.y;
      if (!g.eje && Math.hypot(dx, dy) > 8) g.eje = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.eje === "x") pintar(false, { x: dx * 0.7, y: 0 });
      if (g.eje === "y") pintar(false, { x: 0, y: Math.max(0, dy) * 0.7 });
    }
  }

  function arriba(e) {
    if (!dedos.current.has(e.pointerId)) return;
    dedos.current.delete(e.pointerId);
    const g = gesto.current;
    const quedan = [...dedos.current.values()];
    if (g?.tipo === "pellizcar") {
      if (quedan.length === 1) {
        // Sigue con un dedo: mueve la foto agrandada desde donde quedó.
        gesto.current = { tipo: vista.current.s > 1.01 ? "mover" : "nada", desde: quedan[0], base: { ...vista.current } };
      } else gesto.current = null;
      if (vista.current.s < 1.05) reiniciar();
      return;
    }
    if (quedan.length) return;
    gesto.current = null;
    if (g?.tipo === "deslizar") {
      const dx = e.clientX - g.desde.x;
      const dy = e.clientY - g.desde.y;
      pintar(true);
      if (g.eje === "x" && Math.abs(dx) > 70) avisos.current.onDeslizar?.(dx < 0 ? 1 : -1);
      else if (g.eje === "y" && dy > 110) avisos.current.onBajar?.();
    }
    // Doble toque: agranda donde tocaste, o vuelve al tamaño normal.
    const t = toque.current;
    toque.current = null;
    if (!t || Date.now() - t.t > 300 || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12) return;
    const previo = ultimoToque.current;
    if (previo && t.t - previo.t < 320 && Math.hypot(t.x - previo.x, t.y - previo.y) < 40) {
      ultimoToque.current = null;
      if (vista.current.s > 1.01) reiniciar();
      else {
        const centro = relativo(t);
        escalar(DOBLE, centro, { s: 1, x: 0, y: 0 }, centro);
        pintar(true);
      }
    } else ultimoToque.current = t;
  }

  return (
    <div
      ref={caja}
      className={["imagen-zoom", className].filter(Boolean).join(" ")}
      onPointerDown={abajo}
      onPointerMove={mover}
      onPointerUp={arriba}
      onPointerCancel={arriba}
      // El deslizar de la app (cambiar de sección) no se entera de los gestos sobre la foto.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <img ref={img} src={src} alt={alt} draggable={false} />
    </div>
  );
}
