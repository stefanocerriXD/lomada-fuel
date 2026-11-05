import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChefHat, Clock, RefreshCw } from "lucide-react";
import { TIPOS, tipoInfo } from "../lib/macros.js";
import { comidaSugerida, comoItems, macrosFaltantes, metasDelDia, queFalta, recomendar, textoCantidad } from "../lib/recomendar.js";
import { Hoja, vibrar } from "./Base.jsx";

const POR_PAGINA = 3;
const numero = (n) => Math.round(n).toLocaleString("es-AR");

export default function Recomendador({ yo, salud, total, cargadas, fecha, onCargar }) {
  const metas = useMemo(() => metasDelDia(yo, salud), [yo, salud]);
  const faltan = useMemo(() => macrosFaltantes(metas, total), [metas, total]);
  const sugerida = useMemo(() => comidaSugerida(cargadas), [cargadas]);
  const [abierto, setAbierto] = useState(false);
  const texto = queFalta(faltan, metas);

  return (
    <>
      <section className="tarjeta recomendador">
        <div className="recomendador-texto">
          <h2><ChefHat size={18} /> ¿Qué como?</h2>
          {faltan.kcal >= 150 ? (
            <p>Te faltan <strong>{numero(faltan.kcal)} kcal</strong>{texto ? `, sobre todo ${texto}` : ""}.</p>
          ) : (
            <p>Ya casi cerraste el día. Si tenés hambre, hay opciones livianas.</p>
          )}
        </div>
        <motion.button className="boton" whileTap={{ scale: 0.96 }} onClick={() => { setAbierto(true); vibrar(8); }}>
          Recomendar {tipoInfo(sugerida).texto.toLowerCase()}
        </motion.button>
      </section>

      <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Qué comer" ancha>
        {abierto && (
          <Opciones
            inicial={sugerida}
            faltan={faltan}
            metas={metas}
            total={total}
            cargadas={cargadas}
            onElegir={(tipo, opcion) => {
              setAbierto(false);
              onCargar({ tipo, fecha, receta: { descripcion: opcion.receta.nombre, items: comoItems(opcion) } });
            }}
          />
        )}
      </Hoja>
    </>
  );
}

function Opciones({ inicial, faltan, metas, total, cargadas, onElegir }) {
  const [tipo, setTipo] = useState(inicial);
  const [pagina, setPagina] = useState(0);
  const resultado = useMemo(() => recomendar({ tipo, faltan, cargadas }), [tipo, faltan, cargadas]);
  const cantidad = resultado.opciones.length;
  const inicio = cantidad ? (pagina * POR_PAGINA) % cantidad : 0;
  const visibles = Array.from({ length: Math.min(POR_PAGINA, cantidad) }, (_, i) => resultado.opciones[(inicio + i) % cantidad]);

  return (
    <div className="formulario">
      <div className="tipos" role="radiogroup" aria-label="Para qué comida">
        {TIPOS.map((t) => (
          <button key={t.id} role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => { setTipo(t.id); setPagina(0); }}>
            <span aria-hidden="true">{t.emoji}</span> {t.texto}
          </button>
        ))}
      </div>

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
              <span className="receta-emoji" aria-hidden="true">{o.receta.emoji}</span>
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
