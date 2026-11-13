import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChefHat, Clock, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { sumarItems, TIPOS } from "../lib/macros.js";
import { useDatos } from "../lib/datos.jsx";
import { ia, sugerirConIA } from "../lib/api.js";
import { alimentosUsados } from "../lib/historial.js";
import { itemsDeFoto } from "../lib/reconocer.js";
import { comidaSugerida, comoItems, contextoHora, macrosFaltantes, metasDelDia, queFalta, recomendar, textoCantidad } from "../lib/recomendar.js";
import IconoComida from "./IconoComida.jsx";
import { Hoja, vibrar } from "./Base.jsx";

const POR_PAGINA = 3;
const CLAVE_PREFERENCIA = "lomada-preferencia-comida";
const leerGuardada = () => { try { return localStorage.getItem(CLAVE_PREFERENCIA) || ""; } catch { return ""; } };
const numero = (n) => Math.round(n).toLocaleString("es-AR");
// "3 rebanadas", "2 latas escurridas": solo las palabras que terminan en vocal.
const plural = (texto, n) => (n > 1 ? texto.split(" ").map((w) => (/^[a-záéíóúñ]*[aeiou]$/i.test(w) ? `${w}s` : w)).join(" ") : texto);

export default function Recomendador({ yo, salud, total, cargadas, fecha, onCargar }) {
  const metas = useMemo(() => metasDelDia(yo, salud), [yo, salud]);
  const faltan = useMemo(() => macrosFaltantes(metas, total), [metas, total]);
  const [abierto, setAbierto] = useState(false);
  // La hora se toma al abrir: a las 23 y con la cena cargada no tiene sentido otra cena.
  const ahora = useMemo(() => new Date(), [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const sugerida = useMemo(() => comidaSugerida(cargadas, ahora), [cargadas, ahora]);
  const texto = queFalta(faltan, metas);

  return (
    <>
      <motion.button className="tarjeta accion accion-recomendar" whileTap={{ scale: 0.97 }} onClick={() => { setAbierto(true); vibrar(8); }}>
        <ChefHat size={22} />
        <span>
          <strong>¿Qué puedo comer?</strong>
          <small>{faltan.kcal >= 150 ? `Faltan ${numero(faltan.kcal)} kcal${texto ? `, sobre todo ${texto.split(" y ")[0]}` : ""}` : "Opciones livianas"}</small>
        </span>
      </motion.button>

      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="¿Qué puedo comer?" ancha>
        {abierto && (
          <Opciones
            inicial={sugerida}
            faltan={faltan}
            metas={metas}
            total={total}
            cargadas={cargadas}
            ahora={ahora}
            onElegir={(tipo, opcion) => {
              setAbierto(false);
              onCargar({ tipo, fecha, receta: { descripcion: opcion.receta.nombre, items: comoItems(opcion) } });
            }}
            onElegirIA={(tipo, opcion) => {
              setAbierto(false);
              onCargar({ tipo, fecha, receta: { descripcion: opcion.nombre, items: opcion.items } });
            }}
          />
        )}
      </Hoja>
    </>
  );
}

function Opciones({ inicial, faltan, metas, total, cargadas, ahora, onElegir, onElegirIA }) {
  const { usuario, comidas, comidasLogros } = useDatos();
  const historial = useMemo(() => alimentosUsados(comidasLogros || comidas, usuario.id), [comidasLogros, comidas, usuario.id]);
  const [tipo, setTipo] = useState(inicial);
  // Opciones armadas por la IA con lo que escribiste. Se piden con el botón: no gastan cupo solas.
  const [conIA, setConIA] = useState(!ia.apagada);
  const [deIA, setDeIA] = useState(null);
  const [pensando, setPensando] = useState(false);
  const [errorIA, setErrorIA] = useState("");
  const pedidoActual = useRef(0);
  const [pagina, setPagina] = useState(0);
  const [preferencia, setPreferencia] = useState(leerGuardada);
  const cambiarPreferencia = (valor) => {
    setPreferencia(valor);
    setPagina(0);
    setDeIA(null);
    setErrorIA("");
    try { localStorage.setItem(CLAVE_PREFERENCIA, valor); } catch { /* opcional */ }
  };
  const resultado = useMemo(() => recomendar({ tipo, faltan, cargadas, ahora, preferencia }), [tipo, faltan, cargadas, ahora, preferencia]);
  const contexto = contextoHora(tipo, cargadas, ahora);

  async function pedirIA() {
    if (!preferencia.trim() || pensando) return;
    const vez = ++pedidoActual.current;
    setPensando(true);
    setErrorIA("");
    setDeIA(null);
    try {
      const hora = ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
      const habituales = [...historial.frecuentes, ...historial.recientes].map((h) => h.alimento.nombre).filter((n, i, l) => l.indexOf(n) === i).slice(0, 20);
      const { opciones } = await sugerirConIA({ pedido: preferencia, tipo, hora, objetivo: resultado.objetivo, habituales });
      if (vez !== pedidoActual.current) return;
      setDeIA(opciones.map((o) => {
        const items = itemsDeFoto(o.ingredientes, historial.todos, "sugerencia");
        return { ...o, items, macros: sumarItems(items) };
      }));
      vibrar(12);
    } catch (err) {
      if (vez !== pedidoActual.current) return;
      if (err.apagado) setConIA(false);
      else setErrorIA(err.message);
    } finally {
      if (vez === pedidoActual.current) setPensando(false);
    }
  }
  const cantidad = resultado.opciones.length;
  const inicio = cantidad ? (pagina * POR_PAGINA) % cantidad : 0;
  const visibles = Array.from({ length: Math.min(POR_PAGINA, cantidad) }, (_, i) => resultado.opciones[(inicio + i) % cantidad]);

  return (
    <div className="formulario">
      <div className="tipos" role="radiogroup" aria-label="Para qué comida">
        {TIPOS.map((t) => (
          <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => { setTipo(t.id); setPagina(0); setDeIA(null); pedidoActual.current += 1; setPensando(false); }}>
            <IconoComida tipo={t.id} /> {t.texto}
          </button>
        ))}
      </div>

      <label className="preferencia-comida">
        <Sparkles size={17} aria-hidden="true" />
        <input value={preferencia} onChange={(e) => cambiarPreferencia(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && conIA) { e.currentTarget.blur(); pedirIA(); } }} placeholder="¿Algo en especial? Ej: dulce, sin huevo, tengo atún y arroz" aria-label="Preferencia para la recomendación" enterKeyHint={conIA ? "search" : "done"} />
        {preferencia && <button type="button" className="limpiar" onClick={() => cambiarPreferencia("")} aria-label="Borrar preferencia"><X size={16} /></button>}
      </label>
      {conIA && preferencia.trim().length > 2 && !deIA && (
        <button type="button" className="boton boton-secundario pedir-ia" onClick={pedirIA} disabled={pensando}>
          {pensando
            ? <><motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }} style={{ display: "grid" }}><LoaderCircle size={17} /></motion.span> Pensando opciones para vos…</>
            : <><Sparkles size={17} /> Pedirle opciones a la IA</>}
        </button>
      )}
      {errorIA && <p className="error" role="alert">{errorIA}</p>}
      {contexto && <p className="contexto-hora">{contexto}</p>}

      {deIA?.map((o, i) => (
        <motion.article key={`ia-${i}-${o.nombre}`} className="tarjeta receta receta-ia" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
          <header>
            <div>
              <span className="etiqueta-ia"><Sparkles size={12} /> Para vos, según lo que pediste</span>
              <h3>{o.nombre}</h3>
              <p><Clock size={13} /> {o.minutos} min</p>
            </div>
          </header>
          {o.porQue && <p className="receta-por-que">{o.porQue}</p>}
          <ul className="receta-macros">
            <li><strong>{numero(o.macros.kcal)}</strong> kcal</li>
            <li><span className="punto s-p" /><strong>{numero(o.macros.p)} g</strong> prote</li>
            <li><span className="punto s-c" /><strong>{numero(o.macros.c)} g</strong> carbos</li>
            <li><span className="punto s-g" /><strong>{numero(o.macros.g)} g</strong> grasas</li>
          </ul>
          <ul className="receta-ingredientes">
            {o.items.map((it) => (
              <li key={it.id}><span>{it.nombre}</span><strong>{it.unidad?.g > 1 ? `${it.cantidad} ${plural(it.unidad.nombre, it.cantidad)}` : `${Math.round(it.gramos)} g`}</strong></li>
            ))}
          </ul>
          {o.pasos.length > 0 && (
            <details className="receta-pasos">
              <summary>Cómo hacerla</summary>
              <ol>{o.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
            </details>
          )}
          <p className="receta-cierre">Con esto llegarías a {numero(total.kcal + o.macros.kcal)} de {numero(metas.kcal)} kcal.</p>
          <button className="boton" onClick={() => onElegirIA(tipo, o)}>Cargar esta comida</button>
        </motion.article>
      ))}
      {deIA && (
        <button type="button" className="boton-texto otra-vez-ia" onClick={pedirIA} disabled={pensando}>
          <RefreshCw size={15} /> {pensando ? "Pensando…" : "Pedir otras opciones a la IA"}
        </button>
      )}
      {deIA && <h3 className="titulo-lista">Del recetario</h3>}
      {resultado.nota && <p className="nota">{resultado.nota}</p>}

      {resultado.cerrado ? (
        <p className="objetivo-comida">Ya estás cerca de tu meta, así que van opciones livianas.</p>
      ) : (
        <p className="objetivo-comida">
          {resultado.parte < 0.99 ? "Dejando lugar para lo que queda del día, buscá" : "Para cerrar el día, buscá"} cerca de <strong>{numero(resultado.objetivo.kcal)} kcal</strong>: {numero(resultado.objetivo.p)} g de proteína, {numero(resultado.objetivo.c)} g de carbos y {numero(resultado.objetivo.g)} g de grasas.
        </p>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        {visibles.map((o, i) => (
          <motion.article key={`${tipo}-${o.receta.id}`} className="tarjeta receta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.04 }}>
            <header>
              <div>
                <h3>{o.receta.nombre}</h3>
                <p><Clock size={13} /> {o.receta.minutos} min</p>
              </div>
            </header>
            <ul className="receta-macros">
              <li><strong>{numero(o.macros.kcal)}</strong> kcal</li>
              <li><span className="punto s-p" /><strong>{numero(o.macros.p)} g</strong> prote</li>
              <li><span className="punto s-c" /><strong>{numero(o.macros.c)} g</strong> carbos</li>
              <li><span className="punto s-g" /><strong>{numero(o.macros.g)} g</strong> grasas</li>
            </ul>
            <ul className="receta-ingredientes">
              {o.partes.map((p) => (
                <li key={p.ing}><span>{p.ingrediente.nombre}</span><strong>{textoCantidad(p)}</strong></li>
              ))}
            </ul>
            <details className="receta-pasos">
              <summary>Cómo hacerla</summary>
              <ol>{o.receta.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
            </details>
            <p className="receta-cierre">Con esto llegarías a {numero(total.kcal + o.macros.kcal)} de {numero(metas.kcal)} kcal.</p>
            <button className="boton" onClick={() => onElegir(tipo, o)}>Cargar esta comida</button>
          </motion.article>
        ))}
      </AnimatePresence>

      {cantidad > POR_PAGINA && (
        <button className="boton boton-secundario" onClick={() => { setPagina(pagina + 1); vibrar(5); }}>
          <RefreshCw size={17} /> Ver otras opciones
        </button>
      )}
      <p className="nota">Cantidades aproximadas. Los valores reales cambian según ingredientes y cocción.</p>
    </div>
  );
}
