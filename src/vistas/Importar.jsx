import { useState } from "react";
import { motion } from "motion/react";
import { ClipboardPaste, ImageUp } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { leerResumen } from "../lib/importar.js";
import { leerImagen } from "../lib/ocr.js";
import { nombreDia } from "../lib/fechas.js";
import { TIPOS_TODOS, tipoInfo } from "../lib/macros.js";
import { Hoja, vibrar } from "../componentes/Base.jsx";

const CAMPOS = [["kcal", "kcal"], ["p", "Prote"], ["c", "Carbos"], ["g", "Grasas"]];

export default function Importar({ fecha, onCerrar, onGuardar }) {
  return (
    <Hoja abierta={!!fecha} onCerrar={onCerrar} titulo="Importar de otra app" ancha>
      {fecha && <Contenido fecha={fecha} onGuardar={onGuardar} />}
    </Hoja>
  );
}

function Contenido({ fecha, onGuardar }) {
  const [texto, setTexto] = useState("");
  const [filas, setFilas] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState("");

  function interpretar(contenido) {
    const hallado = leerResumen(contenido);
    if (!hallado.length) {
      setError("No encontramos calorías ni macros. Probá con otra captura, o cargalos a mano acá abajo.");
      setFilas([{ tipo: "resumen", kcal: 0, p: 0, c: 0, g: 0 }]);
      return;
    }
    setError("");
    setFilas(hallado);
  }

  async function elegirArchivo(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    try {
      if (archivo.type.startsWith("image/")) {
        setProgreso(0);
        interpretar(await leerImagen(archivo, setProgreso));
      } else {
        interpretar(await archivo.text());
      }
    } catch {
      setError("No pudimos leerlo. Revisá tu conexión o pegá el texto.");
    } finally {
      setProgreso(null);
    }
  }

  if (filas) return <Revisar fecha={fecha} filas={filas} setFilas={setFilas} aviso={error} onVolver={() => { setFilas(null); setError(""); }} onGuardar={onGuardar} />;

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
      <p className="nota">Para {nombreDia(fecha).toLowerCase()}. Subí una captura de tu app donde se vean las calorías y los macros. La imagen no sale de tu celular.</p>
      <label className="boton boton-grande">
        <ImageUp size={20} /> Subir captura
        <input className="oculto" type="file" accept="image/*,.csv,.txt,text/csv,text/plain" onChange={elegirArchivo} aria-label="Subir captura o archivo" />
      </label>
      <div className="separador"><span>o pegá el texto</span></div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder={"Calorías 1850\nProteínas 142 g\nCarbos 180 g\nGrasas 62 g"} aria-label="Texto del resumen" />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton boton-secundario" onClick={() => interpretar(texto)} disabled={!texto.trim()}>
        <ClipboardPaste size={18} /> Leer texto
      </button>
    </div>
  );
}

function Revisar({ fecha, filas, setFilas, aviso, onVolver, onGuardar }) {
  const { usuario, yo, comidas, cargarComidas, extras } = useDatos();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (i, campo, valor) => setFilas(filas.map((f, n) => (n === i ? { ...f, [campo]: valor } : f)));
  const total = Math.round(filas.reduce((t, f) => t + (Number(f.kcal) || 0), 0));

  async function guardar() {
    const validas = filas.filter((f) => Number(f.kcal) > 0);
    if (!validas.length) return setError("Poné al menos las calorías.");
    setGuardando(true);
    setError("");
    try {
      for (const f of validas) {
        const macros = { kcal: Math.round(Number(f.kcal)), p: Number(f.p) || 0, c: Number(f.c) || 0, g: Number(f.g) || 0 };
        const fila = {
          tipo: f.tipo,
          fecha,
          descripcion: f.tipo === "resumen" ? "Resumen importado" : `${tipoInfo(f.tipo).texto} importado`,
          calorias: macros.kcal,
          proteinas: macros.p,
          carbohidratos: macros.c,
          grasas: macros.g,
          macros_editados: false,
          alimentos: [{ nombre: "Importado", fuente: "importado", ...macros }],
          ...(extras.disponible ? { privada: yo.comidas_privadas ?? false } : {}),
        };
        // Importar de nuevo el mismo día reemplaza lo importado antes, no lo duplica.
        const previa = comidas.find((c) => c.usuario_id === usuario.id && c.fecha === fecha && c.tipo === f.tipo && (f.tipo === "resumen" || c.alimentos?.[0]?.fuente === "importado"));
        const { error: err } = previa
          ? await supabase.from("comidas").update(fila).eq("id", previa.id)
          : await supabase.from("comidas").insert({ ...fila, usuario_id: usuario.id });
        if (err) throw err;
      }
      await cargarComidas();
      vibrar(20);
      onGuardar();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
      setGuardando(false);
    }
  }

  return (
    <div className="formulario">
      {aviso ? <p className="error" role="alert">{aviso}</p> : <p className="nota">Revisá que los números estén bien antes de guardar.</p>}
      {filas.map((f, i) => (
        <section key={i} className="tarjeta fila-importada">
          <select value={f.tipo} onChange={(e) => cambiar(i, "tipo", e.target.value)} aria-label="Comida">
            {TIPOS_TODOS.map((t) => <option key={t.id} value={t.id}>{t.emoji} {t.texto}</option>)}
          </select>
          <div className="campos-importados">
            {CAMPOS.map(([k, texto]) => (
              <label key={k}>
                <span>{texto}</span>
                <input type="number" min="0" inputMode="decimal" value={f[k]} onChange={(e) => cambiar(i, k, e.target.value)} />
              </label>
            ))}
          </div>
        </section>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="pie-publicar">
        <div className="pie-fila">
          <div className="pie-total"><strong>{total.toLocaleString("es-AR")} kcal</strong><span>{filas.length === 1 ? "1 registro" : `${filas.length} comidas`}</span></div>
          <button className="boton boton-secundario" onClick={onVolver}>Volver</button>
          <button className="boton" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
