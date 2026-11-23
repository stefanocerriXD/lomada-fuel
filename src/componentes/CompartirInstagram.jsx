import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, LoaderCircle, Share2 } from "lucide-react";
import { armarImagenDia, armarImagenFiesta, armarImagenInstagram, FORMATOS, PLANTILLAS_DIA } from "../lib/imagenInstagram.js";
import { Hoja, vibrar } from "./Base.jsx";

// La plantilla del día que eligió la última vez (en este celu).
const CLAVE_PLANTILLA = "lomada-plantilla-dia";
const plantillaGuardada = () => {
  try {
    const p = localStorage.getItem(CLAVE_PLANTILLA);
    return PLANTILLAS_DIA.some(([id]) => id === p) ? p : "grilla";
  } catch {
    return "grilla";
  }
};

const puedeCompartir = (archivo) => {
  try {
    return Boolean(navigator.canShare?.({ files: [archivo] }));
  } catch {
    return false;
  }
};

// En iPhone una descarga abre un link con vista previa: para guardar en Fotos se usa el menú de compartir,
// que trae "Guardar imagen" arriba de todo. En Android la descarga va directo a la galería.
const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// La imagen se arma al abrir la hoja: así el botón Compartir abre el menú del celu en el mismo toque.
// Con `comida` arma la de una comida; con `dia` ({ comidas, fotos, fecha, total, meta }) la del día entero;
// con `fiesta` ({ fotos, vasos, kcal, fecha }) la de la noche: una foto o todas, con los vasos o sin.
export default function CompartirInstagram({ abierta, onCerrar, comida, foto, dia, fiesta }) {
  const [formato, setFormato] = useState("historia");
  const [plantilla, setPlantilla] = useState(plantillaGuardada);
  const fotosNoche = fiesta?.fotos || [];
  const [modo, setModo] = useState("una");
  const [indice, setIndice] = useState(0);
  const [conVasos, setConVasos] = useState(true);
  const [archivo, setArchivo] = useState(null);
  const [vista, setVista] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierta) return undefined;
    let activo = true;
    setArchivo(null);
    setError("");
    (fiesta
      ? armarImagenFiesta({ ...fiesta, formato, modo: fotosNoche.length > 1 ? modo : "una", indice, conVasos })
      : dia ? armarImagenDia({ ...dia, formato, plantilla }) : armarImagenInstagram({ comida, foto, formato }))
      .then((f) => activo && setArchivo(f))
      .catch(() => activo && setError("No pudimos armar la imagen. Probá de nuevo."));
    return () => { activo = false; };
  }, [abierta, comida, foto, dia, fiesta, formato, plantilla, modo, indice, conVasos]); // eslint-disable-line react-hooks/exhaustive-deps

  function elegirPlantilla(id) {
    setPlantilla(id);
    try {
      localStorage.setItem(CLAVE_PLANTILLA, id);
    } catch {
      // Sin guardar, la próxima arranca en grilla.
    }
  }

  useEffect(() => {
    if (!archivo) return undefined;
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  function descargar() {
    const a = document.createElement("a");
    a.href = vista;
    a.download = archivo.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function compartir() {
    if (!archivo) return;
    if (!puedeCompartir(archivo)) return descargar();
    try {
      await navigator.share({ files: [archivo] });
      vibrar(14);
    } catch (e) {
      if (e?.name !== "AbortError") descargar();
    }
  }

  function guardar() {
    if (!archivo) return;
    if (esIphone() && puedeCompartir(archivo)) return compartir();
    descargar();
  }

  return createPortal(
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo={fiesta ? "Compartir tu noche" : dia ? "Compartir tu día" : "Compartir en Instagram"}>
      <div className="compartir-ig">
        <div className="segmentos" role="radiogroup" aria-label="Formato">
          {Object.entries(FORMATOS).map(([id, f]) => (
            <button key={id} type="button" role="radio" aria-checked={formato === id} className={formato === id ? "activo" : ""} onClick={() => setFormato(id)}>
              {f.nombre}
            </button>
          ))}
        </div>
        {dia && (
          <div className="segmentos tres" role="radiogroup" aria-label="Plantilla">
            {PLANTILLAS_DIA.map(([id, nombre]) => (
              <button key={id} type="button" role="radio" aria-checked={plantilla === id} className={plantilla === id ? "activo" : ""} onClick={() => elegirPlantilla(id)}>
                {nombre}
              </button>
            ))}
          </div>
        )}
        {fiesta && fotosNoche.length > 1 && (
          <div className="segmentos" role="radiogroup" aria-label="Qué fotos van">
            <button type="button" role="radio" aria-checked={modo === "una"} className={modo === "una" ? "activo" : ""} onClick={() => setModo("una")}>Una foto</button>
            <button type="button" role="radio" aria-checked={modo === "todas"} className={modo === "todas" ? "activo" : ""} onClick={() => setModo("todas")}>Todas ({fotosNoche.length})</button>
          </div>
        )}
        {fiesta && fotosNoche.length > 1 && modo === "una" && (
          <div className="elegir-foto-noche" role="radiogroup" aria-label="Qué foto">
            {fotosNoche.map((url, i) => (
              <button key={url} type="button" role="radio" aria-checked={indice === i} className={indice === i ? "activo" : ""} onClick={() => setIndice(i)} aria-label={`Foto ${i + 1}`}>
                <img src={url} alt="" />
              </button>
            ))}
          </div>
        )}
        {fiesta && fiesta.vasos?.length > 0 && (
          <label className="interruptor">
            <input type="checkbox" checked={conVasos} onChange={(e) => setConVasos(e.target.checked)} />
            <span>Mostrar los vasos<small className="interruptor-detalle">{conVasos ? "Cuántos y qué tomaste." : "Solo las fotos."}</small></span>
          </label>
        )}
        <div className={`compartir-ig-vista ig-${formato}`}>
          {archivo && vista ? <img src={vista} alt={fiesta ? "Imagen para Instagram de la noche de fiesta" : dia ? "Imagen para Instagram con las fotos del día, las calorías y los macros" : "Imagen para Instagram con la comida, sus calorías y macros"} /> : !error && <LoaderCircle className="girando" size={28} aria-label="Armando la imagen" />}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <button type="button" className="boton" onClick={compartir} disabled={!archivo}><Share2 size={18} /> Compartir</button>
        <button type="button" className="boton-texto" onClick={guardar} disabled={!archivo}><Download size={15} /> Guardar en Fotos</button>
        <p className="nota">En el menú elegí Instagram (historia, publicación o mensaje). Para guardarla, tocá Guardar en Fotos y en el menú, Guardar imagen. También podés mantener apretada la imagen.</p>
      </div>
    </Hoja>,
    document.body,
  );
}
