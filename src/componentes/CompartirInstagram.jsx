import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, LoaderCircle, Share2 } from "lucide-react";
import { armarImagenDia, armarImagenInstagram, FORMATOS } from "../lib/imagenInstagram.js";
import { Hoja, vibrar } from "./Base.jsx";

const puedeCompartir = (archivo) => {
  try {
    return Boolean(navigator.canShare?.({ files: [archivo] }));
  } catch {
    return false;
  }
};

// La imagen se arma al abrir la hoja: así el botón Compartir abre el menú del celu en el mismo toque.
// Con `comida` arma la de una comida; con `dia` ({ comidas, fotos, fecha, total, meta }) la del día entero.
export default function CompartirInstagram({ abierta, onCerrar, comida, foto, dia }) {
  const [formato, setFormato] = useState("historia");
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierta) return undefined;
    let activo = true;
    setArchivo(null);
    setError("");
    (dia ? armarImagenDia({ ...dia, formato }) : armarImagenInstagram({ comida, foto, formato }))
      .then((f) => activo && setArchivo(f))
      .catch(() => activo && setError("No pudimos armar la imagen. Probá de nuevo."));
    return () => { activo = false; };
  }, [abierta, comida, foto, dia, formato]);

  useEffect(() => {
    if (!archivo) return undefined;
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function guardar() {
    const a = document.createElement("a");
    a.href = vista;
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function compartir() {
    if (!archivo) return;
    if (!puedeCompartir(archivo)) return guardar();
    try {
      await navigator.share({ files: [archivo] });
      vibrar(14);
    } catch (e) {
      if (e?.name !== "AbortError") guardar();
    }
  }

  return createPortal(
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={dia ? "Compartir tu día" : "Compartir en Instagram"}>
      <div className="compartir-ig">
        <div className="segmentos" role="radiogroup" aria-label="Formato">
          {Object.entries(FORMATOS).map(([id, f]) => (
            <button key={id} type="button" role="radio" aria-checked={formato === id} className={formato === id ? "activo" : ""} onClick={() => setFormato(id)}>
              {f.nombre}
            </button>
          ))}
        </div>
        <div className={`compartir-ig-vista ig-${formato}`}>
          {archivo && vista ? <img src={vista} alt={dia ? "Imagen para Instagram con las fotos del día, las calorías y los macros" : "Imagen para Instagram con la comida, sus calorías y macros"} /> : !error && <LoaderCircle className="girando" size={28} aria-label="Armando la imagen" />}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <button type="button" className="boton" onClick={compartir} disabled={!archivo}><Share2 size={18} /> Compartir</button>
        <button type="button" className="boton-texto" onClick={guardar} disabled={!archivo}><Download size={15} /> Guardar imagen</button>
        <p className="nota">En el menú elegí Instagram (historia, publicación o mensaje). Si no aparece, guardala y subila desde Instagram.</p>
      </div>
    </Hoja>,
    document.body,
  );
}
