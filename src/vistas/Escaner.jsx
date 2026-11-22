import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, CameraOff, ImagePlus, LoaderCircle, PenLine, ScanText } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { ia, reconocerFoto } from "../lib/api.js";
import { leerTexto } from "../lib/ocr.js";
import { aPor100, completarCon, kcalDeMacros, leerEtiqueta, leerNumero } from "../lib/etiqueta.js";
import { buscarEnCatalogo, buscarProductoPropio, guardarProducto } from "../lib/productosPropios.js";
import { vibrar } from "../componentes/Base.jsx";

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
  // Lo que se ve es un lienzo pintado con los cuadros de la cámara: en el iPhone el <video> adentro de la hoja
  // a veces se pinta todo negro aunque la cámara ande.
  const vista = useRef(null);
  const iphone = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

  async function consultar(valor) {
    setBuscando(true);
    setEstado("");
    setFaltante(null);
    setEtiqueta(null);
    try {
      const propio = buscarProductoPropio(valor, [...(comidasLogros || []), ...comidas]);
      const alimento = propio || (await buscarEnCatalogo(valor)) || (await buscar(valor));
      if (alimento) onAlimento(alimento);
      else setFaltante(valor);
    } catch (err) {
      setEstado(err.message);
    } finally {
      setBuscando(false);
    }
  }

  // El lector se carga recién acá: pesa bastante y la mayoría de las veces no se usa.
  const lector = useRef(null);
  async function crearLector() {
    if (!lector.current) {
      lector.current = Promise.all([import("@zxing/browser"), import("@zxing/library")]).then(([{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }]) => {
        const pistas = new Map([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
          [DecodeHintType.TRY_HARDER, true],
        ]);
        return new BrowserMultiFormatReader(pistas);
      });
    }
    return lector.current;
  }

  function encontrado(leido) {
    vibrar(14);
    setCamara(false);
    setCodigo(leido);
    consultar(leido);
  }

  // La cámara la abrimos nosotros y le damos play a mano: en el iPhone (sobre todo con la app instalada)
  // si no, el video puede quedar negro. Cada 200 ms se mira un cuadro buscando el código.
  const [sinImagen, setSinImagen] = useState(false);
  useEffect(() => {
    if (!camara) return undefined;
    let cancelado = false;
    let flujo = null;
    let reloj = null;
    let cuadro = null;
    setSinImagen(false);
    (async () => {
      try {
        const lectorListo = crearLector();
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const leer = await lectorListo;
        const v = video.current;
        if (cancelado || !v) return;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        v.setAttribute("autoplay", "");
        v.muted = true;
        v.srcObject = flujo;
        // Sin await: si la cámara no manda imagen, play() queda colgado para siempre.
        v.play().catch(() => {});
        const lienzo = document.createElement("canvas");
        const dibujo = lienzo.getContext("2d", { willReadFrequently: true });
        const desde = Date.now();
        let tiempo = -1;
        let quieto = Date.now();
        let negroDesde = null;

        // La vista: cada cuadro de la cámara se pinta en el lienzo, recortado para llenar el recuadro.
        const pintar = () => {
          if (cancelado) return;
          const c = vista.current;
          if (c && v.readyState >= 2 && v.videoWidth) {
            const ancho = c.clientWidth * (window.devicePixelRatio || 1);
            const alto = c.clientHeight * (window.devicePixelRatio || 1);
            if (c.width !== Math.round(ancho) || c.height !== Math.round(alto)) { c.width = Math.round(ancho); c.height = Math.round(alto); }
            const escala = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
            const w = v.videoWidth * escala;
            const h = v.videoHeight * escala;
            c.getContext("2d").drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
          }
          cuadro = requestAnimationFrame(pintar);
        };
        cuadro = requestAnimationFrame(pintar);

        // Cada 200 ms se busca el código en un cuadro. Si el video no avanza o llega todo negro, se avisa.
        const mirar = () => {
          if (cancelado) return;
          if (v.currentTime !== tiempo) { tiempo = v.currentTime; quieto = Date.now(); }
          const congelado = Date.now() - quieto > 4000;
          if (v.readyState >= 2 && v.videoWidth && !congelado) {
            const escala = Math.min(1, 960 / v.videoWidth);
            lienzo.width = Math.round(v.videoWidth * escala);
            lienzo.height = Math.round(v.videoHeight * escala);
            dibujo.drawImage(v, 0, 0, lienzo.width, lienzo.height);
            // ¿Todo negro? (la cámara "anda" pero no manda imagen)
            const muestra = dibujo.getImageData(0, 0, lienzo.width, lienzo.height).data;
            let suma = 0;
            let n = 0;
            for (let i = 0; i < muestra.length; i += 4 * 97) { suma += muestra[i] + muestra[i + 1] + muestra[i + 2]; n += 1; }
            const negro = suma / Math.max(1, n * 3) < 4;
            if (!negro) negroDesde = null;
            else if (negroDesde === null) negroDesde = Date.now();
            setSinImagen(negroDesde !== null && Date.now() - negroDesde > 3000);
            try {
              const resultado = leer.decodeFromCanvas(lienzo);
              if (resultado?.getText()) { encontrado(resultado.getText()); return; }
            } catch {
              // En este cuadro no hay código: se sigue mirando.
            }
          } else {
            if (v.paused) v.play().catch(() => {});
            if (Date.now() - desde > 4000) setSinImagen(true);
          }
          reloj = setTimeout(mirar, 200);
        };
        mirar();
      } catch (err) {
        if (cancelado) return;
        setCamara(false);
        setEstado(err?.name === "NotAllowedError"
          ? "La app no tiene permiso para usar la cámara. Sacale una foto al código o escribí el número."
          : "No pudimos abrir la cámara. Sacale una foto al código o escribí el número.");
      }
    })();
    return () => {
      cancelado = true;
      clearTimeout(reloj);
      cancelAnimationFrame(cuadro);
      flujo?.getTracks().forEach((pista) => pista.stop());
      if (video.current) video.current.srcObject = null;
    };
  }, [camara]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plan B: una foto del código con la cámara del celu (siempre anda, aunque el video no).
  async function fotoCodigo(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setCamara(false);
    setEstado("");
    setBuscando(true);
    const url = URL.createObjectURL(archivo);
    try {
      const leer = await crearLector();
      const img = await new Promise((listo, fallo) => { const i = new Image(); i.onload = () => listo(i); i.onerror = fallo; i.src = url; });
      const lienzo = document.createElement("canvas");
      const dibujo = lienzo.getContext("2d", { willReadFrequently: true });
      // Se prueba a dos tamaños: las fotos del iPhone son enormes y el código puede quedar chico.
      let leido = "";
      for (const maximo of [1600, 900]) {
        const escala = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
        lienzo.width = Math.round(img.naturalWidth * escala);
        lienzo.height = Math.round(img.naturalHeight * escala);
        dibujo.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        try { leido = leer.decodeFromCanvas(lienzo)?.getText() || ""; } catch { leido = ""; }
        if (leido) break;
      }
      setBuscando(false);
      if (leido) encontrado(leido);
      else setEstado("No pudimos leer el código en la foto. Probá más cerca, derecho y con luz, o escribí el número.");
    } catch {
      setBuscando(false);
      setEstado("No pudimos abrir la foto. Probá de nuevo o escribí el número.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function enviar(e) {
    e.preventDefault();
    const limpio = codigo.replace(/\D/g, "");
    if (limpio) consultar(limpio);
  }

  async function leerFoto(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setCamara(false);
    setEstado("");
    setEtiqueta(null);
    setLeyendo({ progreso: 0 });
    const datos = await leerDatosDeFoto(archivo, (progreso) => setLeyendo({ progreso }));
    setLeyendo(null);
    setEtiqueta(datos || { ...VACIA, origen: "nada" });
  }

  const codigoDelProducto = faltante || null;

  return (
    <motion.div className="tarjeta-interna" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
              <video ref={video} className="visor-video" muted playsInline autoPlay aria-hidden="true" />
              <canvas ref={vista} className="visor-lienzo" aria-label="Lo que ve la cámara" />
              <motion.i animate={{ y: [-44, 44, -44] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }} />
              {sinImagen && <p className="visor-sin-imagen">La cámara no muestra imagen. Sacale una foto al código ↓</p>}
            </div>
          ) : null}
          {!leyendo && (
            <>
              <button type="button" className="boton boton-secundario" onClick={() => setCamara(!camara)}>
                {camara ? <><CameraOff size={17} /> Cerrar cámara</> : <><Camera size={17} /> Escanear con la cámara</>}
              </button>
              <label className={sinImagen || iphone ? "boton boton-foto-codigo" : "boton-texto etiqueta-enlace"}>
                <input type="file" accept="image/*" capture="environment" onChange={fotoCodigo} aria-label="Foto del código de barras" />
                <Camera size={sinImagen || iphone ? 17 : 15} /> Sacale una foto al código
              </label>
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
            <div className="producto-nuevo">
              <p className="producto-nuevo-titulo"><strong>El código {faltante} no está en la base</strong><small>Cargalo una vez y queda guardado para todos.</small></p>
              <label className="tarjeta accion etiqueta-accion destacada">
                <input type="file" accept="image/*" onChange={leerFoto} aria-label="Foto de la tabla nutricional" />
                <ScanText size={22} />
                <span>
                  <strong>Foto de la tabla o del envase</strong>
                  <small>Leemos los números solos. Si algo está en otra parte del paquete, después sumás otra foto.</small>
                </span>
              </label>
              <button type="button" className="tarjeta accion" onClick={() => setEtiqueta({ ...VACIA, origen: "mano" })}>
                <PenLine size={22} />
                <span>
                  <strong>Cargarlo a mano</strong>
                  <small>Copiá los números del envase.</small>
                </span>
              </button>
            </div>
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
const comoTexto = (v) => (v == null || v === "" ? "" : String(v).replace(".", ","));
const VACIA = { base: "100g", porcionG: null, valores: {}, nombre: "", marca: "" };
const NOMBRES = { kcal: "calorías", p: "proteínas", c: "carbos", g: "grasas" };

// Primero Gemini (lee tablas y datos sueltos del envase); sin clave o sin cupo, el lector de texto del celu.
async function leerDatosDeFoto(archivo, alProgresar) {
  if (!ia.apagada) {
    try {
      const r = await reconocerFoto(archivo, "etiqueta");
      if (r.esEtiqueta && Object.values(r.valores || {}).some((v) => v != null && v > 0)) return { ...r, origen: "ia" };
    } catch {
      // Se prueba con el lector del celu.
    }
  }
  try {
    const leido = leerEtiqueta(await leerTexto(archivo, alProgresar));
    if (leido.encontrados >= 1) return { ...leido, nombre: "", marca: "", origen: "texto" };
  } catch {
    // Queda para cargar a mano.
  }
  return null;
}

function FormEtiqueta({ inicial, codigo, onListo, onCancelar }) {
  const [nombre, setNombre] = useState(inicial.nombre || "");
  const [marca, setMarca] = useState(inicial.marca || "");
  const [base, setBase] = useState(inicial.base || "100g");
  const [porcion, setPorcion] = useState(comoTexto(inicial.porcionG));
  const [v, setV] = useState(() => Object.fromEntries(CAMPOS.map(([k]) => [k, comoTexto(inicial.valores?.[k])])));
  const [origen, setOrigen] = useState(inicial.origen);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState(null);

  const porcionG = leerNumero(porcion);
  const valores = Object.fromEntries(CAMPOS.map(([k]) => [k, leerNumero(v[k])]));
  const kcalCalculadas = valores.kcal == null ? kcalDeMacros(valores) : null;
  const kcal = valores.kcal ?? kcalCalculadas;
  const por100 = kcal != null && (base === "100g" || porcionG) ? aPor100({ base, porcionG, valores: { ...valores, kcal } }) : null;
  const porPorcion = por100 && porcionG ? Math.round((por100.kcal * porcionG) / 100) : null;

  // Otra foto (el frente del envase, el costado): completa lo que falta sin pisar lo que ya está.
  async function otraFoto(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setLeyendo(true);
    setAviso("");
    const nuevo = await leerDatosDeFoto(archivo, () => {});
    setLeyendo(false);
    if (!nuevo) return setAviso("No encontramos números en esa foto. Probá más cerca o completalo a mano.");
    const actual = { base, porcionG, valores: Object.fromEntries(CAMPOS.map(([k]) => [k, v[k] === "" ? null : v[k]])), nombre, marca };
    const r = completarCon(actual, nuevo);
    if (!porcion && r.porcionG) setPorcion(comoTexto(r.porcionG));
    setV((prev) => Object.fromEntries(CAMPOS.map(([k]) => [k, prev[k] !== "" ? prev[k] : comoTexto(r.valores[k])])));
    if (!nombre && r.nombre) setNombre(r.nombre);
    if (!marca && r.marca) setMarca(r.marca);
    setOrigen((o) => (o === "mano" || o === "nada" ? nuevo.origen : o));
    setAviso(r.sumados.length ? `Sumamos ${r.sumados.map((k) => NOMBRES[k]).join(", ")} de la otra foto.` : nuevo.base !== base && !porcionG ? "La otra foto trae los valores de otra forma (por porción o cada 100 g): poné de cuántos gramos es la porción y probá de nuevo." : "Esa foto no trajo nada que faltara.");
  }

  function agregar(e) {
    e.preventDefault();
    if (!nombre.trim()) return setError({ campo: "nombre", texto: "Ponele un nombre al producto." });
    const malos = CAMPOS.filter(([k]) => v[k].trim() !== "" && valores[k] == null);
    if (malos.length) return setError({ campo: malos[0][0], texto: `Revisá ${NOMBRES[malos[0][0]]}: tiene que ser un número (con coma si tiene decimales).` });
    if (kcal == null) return setError({ campo: "kcal", texto: "Poné al menos las calorías (o las macros, y las calculamos)." });
    if (base === "porcion" && !porcionG) return setError({ campo: "porcion", texto: "Poné de cuántos gramos es la porción (figura arriba de la tabla), o elegí «Cada 100 g»." });
    if (!por100) return setError({ campo: "kcal", texto: "Los números no cierran: revisá que coincidan con el envase y si son por porción o cada 100 g." });
    onListo({
      id: `etiqueta-${codigo || crypto.randomUUID()}`,
      nombre: nombre.trim(),
      marca: marca.trim(),
      fuente: "etiqueta",
      por100,
      porcion: porcionG ? { nombre: "1 porción", g: porcionG } : null,
      ...(codigo ? { codigo } : {}),
    });
  }

  const nota = {
    ia: "Lo leímos de la foto. Fijate que los números coincidan con el envase.",
    texto: "Lo leímos de la foto. Fijate que los números coincidan: el lector a veces confunde algún número.",
    nada: "No pudimos leer la foto. Copiá los números acá, o sumá otra foto más cerca y derecha.",
    mano: "Copiá los números del envase. Lo que no figure dejalo vacío.",
  }[origen];
  const marcar = (campo) => (error?.campo === campo ? "campo-error" : undefined);

  return (
    <form className="form-etiqueta" onSubmit={agregar} noValidate>
      <p className="nota">{nota}</p>
      <input className={marcar("nombre")} value={nombre} onChange={(e) => { setNombre(e.target.value); setError(null); }} placeholder="Nombre del producto" aria-label="Nombre del producto" autoFocus={!nombre} />
      <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca (opcional)" aria-label="Marca" />
      <div className="base-etiqueta" role="radiogroup" aria-label="Los valores son">
        <button type="button" role="radio" aria-checked={base === "100g"} className={base === "100g" ? "boton-chico activo" : "boton-chico"} onClick={() => { setBase("100g"); setError(null); }}>Cada 100 g</button>
        <button type="button" role="radio" aria-checked={base === "porcion"} className={base === "porcion" ? "boton-chico activo" : "boton-chico"} onClick={() => { setBase("porcion"); setError(null); }}>Por porción</button>
      </div>
      <label className="porcion-etiqueta">
        <span>Porción (g o ml){base === "100g" ? " · opcional" : ""}</span>
        <input className={marcar("porcion")} type="text" inputMode="decimal" value={porcion} onChange={(e) => { setPorcion(e.target.value); setError(null); }} placeholder="Ej: 30" />
      </label>
      <div className="ajuste-macros">
        {CAMPOS.map(([k, texto]) => (
          <label key={k}>
            <span>{texto}</span>
            <input
              className={marcar(k)}
              type="text"
              inputMode="decimal"
              value={v[k]}
              onChange={(e) => { setV({ ...v, [k]: e.target.value }); setError(null); }}
              placeholder={k === "kcal" && kcalCalculadas != null ? `${kcalCalculadas} (calc.)` : "–"}
              aria-label={texto}
            />
          </label>
        ))}
      </div>
      <label className={leyendo ? "boton-texto etiqueta-enlace ocupado" : "boton-texto etiqueta-enlace"}>
        <input type="file" accept="image/*" onChange={otraFoto} disabled={leyendo} aria-label="Sumar otra foto del envase" />
        {leyendo ? <><LoaderCircle size={15} className="girando" /> Leyendo la otra foto…</> : <><ImagePlus size={15} /> ¿Falta algún dato? Sumá otra foto del envase</>}
      </label>
      {aviso && <p className="nota" role="status">{aviso}</p>}
      {por100 && (
        <p className="etiqueta-resumen" role="status">
          Queda: <strong>{por100.kcal} kcal</strong> cada 100 g · P {comoTexto(por100.p)} · C {comoTexto(por100.c)} · G {comoTexto(por100.g)}
          {porPorcion != null ? <> · <strong>{porPorcion} kcal</strong> la porción de {String(porcionG).replace(".", ",")} g</> : null}
          {kcalCalculadas != null ? <small> Las calorías las calculamos con las macros.</small> : null}
        </p>
      )}
      {error && <p className="error" role="alert">{error.texto}</p>}
      <div className="form-etiqueta-botones">
        <button type="button" className="boton boton-secundario" onClick={onCancelar}>Volver</button>
        <button type="submit" className="boton">Agregar</button>
      </div>
    </form>
  );
}
