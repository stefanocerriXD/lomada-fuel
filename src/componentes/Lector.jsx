import { useState } from "react";
import { motion } from "motion/react";
import { ClipboardPaste, ImageUp } from "lucide-react";
import { leerResumen } from "../lib/importar.js";
import { leerImagen } from "../lib/ocr.js";
import { imagenPegada, leerPortapapeles } from "../lib/portapapeles.js";

const SIN_PERMISO = "No pudimos abrir lo copiado. Mantené apretado el recuadro y elegí Pegar, o subí la captura.";

// Entrada común de todo lo importado: captura, archivo o texto. Devuelve lo que pudo entender.
export default function Lector({ nota, onLeido }) {
  const [texto, setTexto] = useState("");
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState("");

  async function leerArchivo(archivo) {
    setError("");
    try {
      if (archivo.type.startsWith("image/")) {
        setProgreso(0);
        onLeido(leerResumen(await leerImagen(archivo, setProgreso)));
      } else {
        onLeido(leerResumen(await archivo.text()));
      }
    } catch {
      setError("No pudimos leerlo. Revisá tu conexión o pegá el texto.");
    } finally {
      setProgreso(null);
    }
  }

  function elegirArchivo(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (archivo) leerArchivo(archivo);
  }

  async function pegar() {
    setError("");
    try {
      const copiado = await leerPortapapeles();
      if (copiado.imagen) return leerArchivo(copiado.imagen);
      if (copiado.texto?.trim()) {
        setTexto(copiado.texto);
        return onLeido(leerResumen(copiado.texto));
      }
      setError("No hay nada copiado. Copiá una captura o el texto en tu otra app.");
    } catch {
      setError(SIN_PERMISO);
    }
  }

  function alPegar(e) {
    const imagen = imagenPegada(e.clipboardData);
    if (!imagen) return;
    e.preventDefault();
    leerArchivo(imagen);
  }

  if (progreso !== null) {
    return (
      <div className="leyendo" role="status">
        <p>Leyendo la captura…</p>
        <span className="pista-progreso gruesa"><motion.span animate={{ scaleX: progreso }} initial={false} /></span>
        <small>La primera vez puede tardar un poco.</small>
      </div>
    );
  }

  return (
    <div className="formulario">
      {nota && <p className="nota">{nota}</p>}
      <div className="entrada-importar">
        <button type="button" className="boton" onClick={pegar}>
          <ClipboardPaste size={19} /> Pegar
        </button>
        <label className="boton boton-secundario">
          <ImageUp size={19} /> Subir captura
          <input className="oculto" type="file" accept="image/*,.csv,.txt,text/csv,text/plain" onChange={elegirArchivo} aria-label="Subir captura o archivo" />
        </label>
      </div>
      <div className="separador"><span>o escribí el texto</span></div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onPaste={alPegar} rows={4} placeholder={"Calorías 1850\nProteínas 142 g\nCarbos 180 g\nGrasas 62 g"} aria-label="Texto del resumen" />
      {error && <p className="error" role="alert">{error}</p>}
      {texto.trim() && (
        <button type="button" className="boton boton-secundario" onClick={() => onLeido(leerResumen(texto))}>Leer texto</button>
      )}
    </div>
  );
}
