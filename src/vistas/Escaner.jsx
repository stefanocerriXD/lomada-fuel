import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, CameraOff, LoaderCircle, ScanText } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { ia, reconocerFoto } from "../lib/api.js";
import { leerTexto } from "../lib/ocr.js";
import { aPor100, leerEtiqueta } from "../lib/etiqueta.js";
import { buscarProductoPropio, guardarProducto } from "../lib/productosPropios.js";

// 1) Escanear el código: primero lo que ya cargó el grupo, después la base de productos.
// 2) Si no está, una foto de la tabla nutricional completa los valores sola.
export default function Escaner({ onAlimento, buscar }) {
  const { comidas, comidasLogros } = useDatos();
  const [camara, setCamara] = useState(true);
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [faltante, setFaltante] = useState(null);
  const [leyendo, setLeyendo] = useState(null);
  const [etiqueta, setEtiqueta] = useState(null);
  const video = useRef(null);

  async function consultar(valor) {
    setBuscando(true);
    setEstado("");
    setFaltante(null);
    setEtiqueta(null);
    try {
      const propio = buscarProductoPropio(valor, [...(comidasLogros || []), ...comidas]);
      const alimento = propio || (await buscar(valor));
      if (alimento) onAlimento(alimento);
      else setFaltante(valor);
    } catch (err) {
      setEstado(err.message);
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    if (!camara) return;
    let controles;
    let cancelado = false;
    (async () => {
      try {
        // Se carga recién acá: pesa bastante y la mayoría de las veces no se usa.
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const pistas = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
        const lector = new BrowserMultiFormatReader(pistas);
        if (cancelado) return;
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (resultado, _error, control) => {
            if (!resultado) return;
            control.stop();
            setCamara(false);
            const leido = resultado.getText();
            setCodigo(leido);
            consultar(leido);
          },
        );
        if (cancelado) controles.stop();
      } catch {
        setCamara(false);
        setEstado("No pudimos abrir la cámara. Escribí el número del código.");
      }
    })();
    return () => {
      cancelado = true;
      controles?.stop();
    };
  }, [camara]); // eslint-disable-line react-hooks/exhaustive-deps

  function enviar(e) {
    e.preventDefault();
    const limpio = codigo.replace(/\D/g, "");
    if (limpio) consultar(limpio);
  }

  // Primero Gemini (lee tablas muy bien); sin clave o sin cupo, el lector de texto del celu.
  async function leerFoto(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setCamara(false);
    setEstado("");
    setEtiqueta(null);
    setLeyendo({ progreso: 0 });
    let datos = null;
    if (!ia.apagada) {
      try {
        const r = await reconocerFoto(archivo, "etiqueta");
        if (r.esEtiqueta && r.valores.kcal > 0) datos = { ...r, origen: "ia" };
      } catch {
        // Se prueba con el lector del celu.
      }
    }
    if (!datos) {
      try {
        const leido = leerEtiqueta(await leerTexto(archivo, (progreso) => setLeyendo({ progreso })));
        if (leido.encontrados >= 2) datos = { ...leido, nombre: "", marca: "", origen: "texto" };
      } catch {
        // Queda para cargar a mano.
      }
    }
    setLeyendo(null);
    setEtiqueta(datos || { base: "porcion", porcionG: null, valores: {}, nombre: "", marca: "", origen: "nada" });
  }

  const codigoDelProducto = faltante || null;

  return (
    <motion.div className="tarjeta-interna" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
      {etiqueta ? (
        <FormEtiqueta
          inicial={etiqueta}
          codigo={codigoDelProducto}
          onCancelar={() => setEtiqueta(null)}
          onListo={(alimento) => {
            guardarProducto(alimento);
            setEtiqueta(null);
            setFaltante(null);
            onAlimento(alimento);
          }}
        />
      ) : (
        <>
          {camara ? (
            <div className="visor">
              <video ref={video} muted playsInline />
              <motion.i animate={{ y: [-44, 44, -44] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} />
            </div>
          ) : null}
          {!leyendo && (
            <>
              <button type="button" className="boton boton-secundario" onClick={() => setCamara(!camara)}>
                {camara ? <><CameraOff size={17} /> Cerrar cámara</> : <><Camera size={17} /> Escanear con la cámara</>}
              </button>
              <form className="codigo-manual" onSubmit={enviar}>
                <input value={codigo} onChange={(e) => setCodigo(e.target.value)} inputMode="numeric" placeholder="O escribí el número" aria-label="Número de código de barras" />
                <button className="boton" type="submit" disabled={buscando || !codigo.trim()}>{buscando ? "Buscando…" : "Buscar"}</button>
              </form>
            </>
          )}
          {estado && <p className="nota">{estado}</p>}
          {leyendo ? (
            <p className="buscando leyendo-etiqueta" role="status">
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}><LoaderCircle size={17} /></motion.span>
              Leyendo la tabla nutricional{leyendo.progreso > 0 ? ` · ${Math.round(leyendo.progreso * 100)}%` : "…"}
            </p>
          ) : faltante ? (
            <label className="tarjeta accion etiqueta-accion destacada">
              <input type="file" accept="image/*" onChange={leerFoto} aria-label="Foto de la tabla nutricional" />
              <ScanText size={22} />
              <span>
                <strong>El código {faltante} no está en la base</strong>
                <small>Sacale una foto a la tabla nutricional y lo cargamos solo. Queda guardado para la próxima.</small>
              </span>
            </label>
          ) : (
            <label className="boton-texto etiqueta-enlace">
              <input type="file" accept="image/*" onChange={leerFoto} aria-label="Foto de la tabla nutricional" />
              <ScanText size={15} /> ¿Sin código? Leé la tabla nutricional
            </label>
          )}
        </>
      )}
    </motion.div>
  );
}

const CAMPOS = [["kcal", "Calorías"], ["p", "Proteínas (g)"], ["c", "Carbos (g)"], ["g", "Grasas (g)"]];
const comoTexto = (v) => (v == null || v === "" ? "" : String(v));

function FormEtiqueta({ inicial, codigo, onListo, onCancelar }) {
  const [nombre, setNombre] = useState(inicial.nombre || "");
  const [marca, setMarca] = useState(inicial.marca || "");
  const [base, setBase] = useState(inicial.base || "porcion");
  const [porcion, setPorcion] = useState(comoTexto(inicial.porcionG));
  const [v, setV] = useState(() => Object.fromEntries(CAMPOS.map(([k]) => [k, comoTexto(inicial.valores?.[k])])));
  const [error, setError] = useState("");

  function agregar(e) {
    e.preventDefault();
    const porcionG = Number(porcion) || null;
    if (base === "porcion" && !porcionG) return setError("Poné de cuántos gramos es la porción (figura arriba de la tabla).");
    const por100 = aPor100({ base, porcionG, valores: v });
    if (!por100) return setError("Los números no cierran: revisá que coincidan con la tabla y si son por porción o cada 100 g.");
    onListo({
      id: `etiqueta-${codigo || crypto.randomUUID()}`,
      nombre: nombre.trim() || "Producto",
      marca: marca.trim(),
      fuente: "etiqueta",
      por100,
      porcion: porcionG ? { nombre: "1 porción", g: porcionG } : null,
      ...(codigo ? { codigo } : {}),
    });
  }

  const aviso = {
    ia: "Lo leímos de la foto. Fijate que los números coincidan con la tabla.",
    texto: "Lo leímos de la foto. Fijate que los números coincidan con la tabla: el lector a veces confunde algún número.",
    nada: "No pudimos leer la tabla. Copiá los números acá o probá con una foto más cerca y derecha.",
  }[inicial.origen];

  return (
    <form className="form-etiqueta" onSubmit={agregar}>
      <p className="nota">{aviso}</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del producto" aria-label="Nombre del producto" required autoFocus={!nombre} />
      <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca (opcional)" aria-label="Marca" />
      <div className="base-etiqueta" role="radiogroup" aria-label="Los valores son">
        <button type="button" role="radio" aria-checked={base === "porcion"} className={base === "porcion" ? "boton-chico activo" : "boton-chico"} onClick={() => setBase("porcion")}>Por porción</button>
        <button type="button" role="radio" aria-checked={base === "100g"} className={base === "100g" ? "boton-chico activo" : "boton-chico"} onClick={() => setBase("100g")}>Cada 100 g</button>
      </div>
      <label className="porcion-etiqueta">
        <span>Porción (g o ml){base === "100g" ? " · opcional" : ""}</span>
        <input type="number" min="0" step="any" inputMode="decimal" value={porcion} onChange={(e) => setPorcion(e.target.value)} />
      </label>
      <div className="ajuste-macros">
        {CAMPOS.map(([k, texto]) => (
          <label key={k}>
            <span>{texto}</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required={k === "kcal"} />
          </label>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="form-etiqueta-botones">
        <button type="button" className="boton boton-secundario" onClick={onCancelar}>Volver</button>
        <button type="submit" className="boton">Agregar</button>
      </div>
    </form>
  );
}
