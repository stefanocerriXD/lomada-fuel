import { useEffect, useRef, useState } from "react";
import { Mic, SendHorizontal, Trash2 } from "lucide-react";
import { vibrar } from "./Base.jsx";

const MAXIMO_S = 120;

// El iPhone graba en mp4 y Chrome en webm: se usa lo que el navegador sepa hacer.
function formato() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const tipo of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return "";
}

export const extensionAudio = (tipo) => (tipo.includes("mp4") ? "m4a" : "webm");

// Botón de micrófono: tocar empieza a grabar; después se manda o se descarta.
export default function Grabador({ onListo, onError, deshabilitado, onGrabando }) {
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const grabador = useRef(null);
  const partes = useRef([]);
  const reloj = useRef(null);
  const descartar = useRef(false);

  useEffect(() => () => detener(true), []);

  if (formato() === null) return null;

  async function empezar() {
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = formato();
      const g = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined);
      partes.current = [];
      descartar.current = false;
      g.ondataavailable = (e) => e.data.size && partes.current.push(e.data);
      g.onstop = () => {
        flujo.getTracks().forEach((t) => t.stop());
        clearInterval(reloj.current);
        setGrabando(false);
        onGrabando?.(false);
        if (descartar.current || !partes.current.length) return;
        const blob = new Blob(partes.current, { type: g.mimeType || tipo || "audio/webm" });
        onListo(blob);
      };
      g.start();
      grabador.current = g;
      setSegundos(0);
      setGrabando(true);
      onGrabando?.(true);
      vibrar(12);
      reloj.current = setInterval(() => {
        setSegundos((s) => {
          if (s + 1 >= MAXIMO_S) detener(false);
          return s + 1;
        });
      }, 1000);
    } catch {
      onError("Para mandar audios, permití el micrófono.");
    }
  }

  function detener(tirar) {
    descartar.current = tirar;
    clearInterval(reloj.current);
    if (grabador.current?.state === "recording") grabador.current.stop();
    grabador.current = null;
  }

  if (!grabando) {
    return (
      <button type="button" className="boton-enviar microfono" onClick={empezar} disabled={deshabilitado} aria-label="Grabar audio">
        <Mic size={20} />
      </button>
    );
  }

  return (
    <div className="grabando" role="status">
      <button type="button" className="boton-icono" onClick={() => detener(true)} aria-label="Descartar audio"><Trash2 size={19} /></button>
      <span className="grabando-punto" aria-hidden="true" />
      <span className="grabando-tiempo">{Math.floor(segundos / 60)}:{String(segundos % 60).padStart(2, "0")}</span>
      <span className="grabando-texto">Grabando…</span>
      <button type="button" className="boton-enviar" onClick={() => detener(false)} aria-label="Mandar audio"><SendHorizontal size={20} /></button>
    </div>
  );
}
