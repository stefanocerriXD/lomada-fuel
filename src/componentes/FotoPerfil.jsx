// Foto de perfil: elegirla, encuadrarla (mover con el dedo, pellizcar o deslizar para acercar) y verla en grande.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar, Hoja, resorte, vibrar } from "./Base.jsx";
import { useDatos } from "../lib/datos.jsx";
import { encuadre, guardarFotoPerfil, leerImagen, quitarFotoPerfil, recortar, ZOOM_MAXIMO } from "../lib/fotoPerfil.js";

const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// La hoja para encuadrar: lo que queda dentro del círculo es lo que se ve en el avatar.
export function RecortarFoto({ archivo, perfil, guardando, onCerrar, onListo }) {
  const [foto, setFoto] = useState(null); // { img, url }
  const [error, setError] = useState("");
  const [cuadro, setCuadro] = useState({ zoom: 1, dx: 0, dy: 0 });
  const [vista, setVista] = useState(null);
  const dedos = useRef(new Map());
  const gesto = useRef(null);
  const lado = Math.max(200, Math.min(300, (typeof window !== "undefined" ? window.innerWidth : 360) - 72));

  useEffect(() => {
    if (!archivo) return undefined;
    let vivo = true;
    let url = null;
    setFoto(null);
    setError("");
    setCuadro({ zoom: 1, dx: 0, dy: 0 });
    leerImagen(archivo)
      .then((f) => { url = f.url; if (vivo) setFoto(f); else URL.revokeObjectURL(f.url); })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [archivo]);

  const medida = foto ? encuadre({ w: foto.img.naturalWidth, h: foto.img.naturalHeight, lado, ...cuadro }) : null;
  const mover = useCallback((cambio) => {
    if (!foto) return;
    setCuadro((c) => {
      const n = encuadre({ w: foto.img.naturalWidth, h: foto.img.naturalHeight, lado, ...c, ...cambio(c) });
      return { zoom: n.zoom, dx: n.dx, dy: n.dy };
    });
  }, [foto, lado]);

  // La vista previa dentro del marco de tu nivel, apenas se suelta la foto.
  useEffect(() => {
    if (!foto || !medida) return undefined;
    let url = null;
    const t = setTimeout(() => {
      recortar(foto.img, medida, 192, 0.8).then((b) => { url = URL.createObjectURL(b); setVista(url); }).catch(() => {});
    }, 120);
    return () => { clearTimeout(t); if (url) setTimeout(() => URL.revokeObjectURL(url), 500); };
  }, [foto, cuadro.zoom, cuadro.dx, cuadro.dy]); // eslint-disable-line react-hooks/exhaustive-deps

  function bajar(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesto.current = null;
  }
  function moverDedo(e) {
    const antes = dedos.current.get(e.pointerId);
    if (!antes) return;
    const ahora = { x: e.clientX, y: e.clientY };
    if (dedos.current.size === 1) {
      mover((c) => ({ dx: c.dx + ahora.x - antes.x, dy: c.dy + ahora.y - antes.y }));
    } else if (dedos.current.size === 2) {
      // Pellizcar: acerca o aleja según cuánto se abren los dedos.
      const [a, b] = [...dedos.current.entries()].map(([id, p]) => (id === e.pointerId ? ahora : p));
      const d = distancia(a, b);
      if (gesto.current) {
        const factor = d / gesto.current;
        mover((c) => ({ zoom: c.zoom * factor, dx: c.dx * factor, dy: c.dy * factor }));
      }
      gesto.current = d;
    }
    dedos.current.set(e.pointerId, ahora);
  }
  function soltar(e) {
    dedos.current.delete(e.pointerId);
    gesto.current = null;
  }
  const zoomA = (z) => mover((c) => ({ zoom: z, dx: (c.dx * z) / c.zoom, dy: (c.dy * z) / c.zoom }));

  async function usar() {
    if (!foto || !medida) return;
    try {
      onListo(await recortar(foto.img, medida));
    } catch (e) {
      setError(e.message);
    }
  }

  // En un portal: abierta desde el perfil (otra hoja), si no quedaría encerrada adentro.
  return createPortal(
    <Hoja
      abierta={Boolean(archivo)}
      onCerrar={guardando ? () => {} : onCerrar}
      titulo="Tu foto de perfil"
      pie={
        <button className="boton boton-grande" onClick={usar} disabled={!foto || guardando}>
          {guardando ? "Guardando…" : "Usar esta foto"}
        </button>
      }
    >
      <div className="recorte-contenido">
        <p className="recorte-ayuda">Mové la foto con el dedo y pellizcá para acercar. Lo que queda en el círculo es lo que ven todos.</p>
        <div
          className="recorte"
          style={{ width: lado, height: lado }}
          onPointerDown={bajar}
          onPointerMove={moverDedo}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onWheel={(e) => zoomA(cuadro.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          aria-label="Encuadre de la foto"
          role="img"
        >
          {foto && medida && (
            <img
              src={foto.url}
              alt=""
              draggable={false}
              style={{ width: medida.ancho, height: medida.alto, left: lado / 2 - medida.ancho / 2 + medida.dx, top: lado / 2 - medida.alto / 2 + medida.dy }}
            />
          )}
          <span className="recorte-circulo" aria-hidden="true" />
          {!foto && !error && <span className="recorte-cargando">Abriendo la foto…</span>}
        </div>
        <label className="recorte-zoom">
          <ZoomOut size={18} aria-hidden="true" />
          <input type="range" min="1" max={ZOOM_MAXIMO} step="0.01" value={cuadro.zoom} onChange={(e) => zoomA(Number(e.target.value))} aria-label="Acercar la foto" disabled={!foto} />
          <ZoomIn size={18} aria-hidden="true" />
        </label>
        <div className="recorte-vista" aria-label="Así se ve">
          <Avatar perfil={{ ...perfil, foto: vista }} tam={64} />
          <Avatar perfil={{ ...perfil, foto: vista }} tam={36} />
          <small>Así se ve con tu marco</small>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </Hoja>,
    document.body,
  );
}

// La foto en grande, al tocar el avatar. En la tuya, para cambiarla o sacarla.
export function VerFotoPerfil({ perfil, abierta, propio, onCerrar, onCambiar, onQuitar }) {
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    if (!abierta) return undefined;
    setConfirmar(false);
    const tecla = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierta, onCerrar]);

  return createPortal(
    <AnimatePresence>
      {abierta && perfil && (
        <motion.div className="foto-perfil-capa" role="dialog" aria-modal="true" aria-label={`Foto de ${perfil.nombre}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar}>
          <button className="boton-icono foto-perfil-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={22} /></button>
          <motion.div className="foto-perfil-grande" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} transition={resorte} onClick={(e) => e.stopPropagation()}>
            {perfil.foto ? <img src={perfil.foto} alt={`Foto de perfil de ${perfil.nombre}`} /> : <Avatar perfil={perfil} tam={200} />}
          </motion.div>
          <div className="foto-perfil-pie" onClick={(e) => e.stopPropagation()}>
            <strong>{perfil.nombre}</strong>
            {perfil.usuario && <small>@{perfil.usuario}</small>}
            {propio && (
              <div className="foto-perfil-acciones">
                <button className="boton-chico acento" onClick={onCambiar}><Camera size={15} aria-hidden="true" /> {perfil.foto ? "Cambiar foto" : "Poner foto"}</button>
                {perfil.foto && (
                  <button className={confirmar ? "boton-chico peligro" : "boton-chico"} onClick={() => (confirmar ? onQuitar() : setConfirmar(true))}>
                    <Trash2 size={15} aria-hidden="true" /> {confirmar ? "¿Sacarla?" : "Sacar"}
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Todo junto para tu perfil: elegir del celu, encuadrar y guardar. Devuelve qué abrir y lo que hay que dibujar.
export function useFotoPerfil(avisar) {
  const { usuario, yo, cargarPerfiles } = useDatos();
  const entrada = useRef(null);
  const [archivo, setArchivo] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const elegir = useCallback(() => entrada.current?.click(), []);
  async function listo(blob) {
    setGuardando(true);
    try {
      await guardarFotoPerfil({ usuarioId: usuario.id, blob, anterior: yo.foto_path });
      await cargarPerfiles();
      setArchivo(null);
      vibrar(14);
      avisar?.("Foto de perfil lista");
    } catch (e) {
      avisar?.(e.message);
    } finally {
      setGuardando(false);
    }
  }
  async function quitar() {
    try {
      await quitarFotoPerfil({ usuarioId: usuario.id, anterior: yo.foto_path });
      await cargarPerfiles();
      avisar?.("Foto de perfil sacada");
    } catch (e) {
      avisar?.(e.message);
    }
  }

  const elementos = (
    <>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        aria-label="Elegir foto de perfil"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setArchivo(f); }}
      />
      <RecortarFoto archivo={archivo} perfil={yo} guardando={guardando} onCerrar={() => setArchivo(null)} onListo={listo} />
    </>
  );
  return { elegir, quitar, elementos };
}
