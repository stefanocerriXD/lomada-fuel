import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Check, ListChecks, Settings2 } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { rachaDe, REGISTROS, useRegistros } from "../lib/registros.js";
import { Hoja, vibrar } from "./Base.jsx";

const CLAVE_NO = "lomada-registros-no";
const dijoQueNo = () => {
  try {
    return localStorage.getItem(CLAVE_NO) === "1";
  } catch {
    return false;
  }
};

// Elegir qué registros aparecen cada día y si avisar a las 20.
export function ConfigRegistros({ registros, avisar }) {
  const { config, guardarConfig, sinBase } = registros;
  async function cambiar(cambios) {
    const ok = await guardarConfig(cambios);
    if (!ok && !sinBase) avisar?.("No se pudo guardar");
  }
  return (
    <div className="config-registros">
      <p className="ajuste-texto">Elegí qué querés tildar cada día. Es solo tuyo: el grupo no lo ve.</p>
      {REGISTROS.map((r) => {
        const activo = config.activos.includes(r.codigo);
        return (
          <label key={r.codigo} className="interruptor registro-opcion">
            <input
              type="checkbox"
              checked={activo}
              onChange={() => cambiar({ activos: activo ? config.activos.filter((c) => c !== r.codigo) : [...config.activos, r.codigo] })}
            />
            <span className="registro-opcion-icono"><r.icono size={17} /></span>
            <span>{r.nombre}</span>
          </label>
        );
      })}
      <label className="interruptor registro-aviso">
        <input type="checkbox" checked={config.aviso} onChange={() => cambiar({ aviso: !config.aviso })} disabled={!config.activos.length} />
        <span>Avisarme a las 20 si me falta tildar alguno</span>
      </label>
      {sinBase && <p className="nota">Para poder tildarlos falta correr el SQL 043 en Supabase.</p>}
    </div>
  );
}

// La tarjeta del Resumen: tocar para tildar lo de ese día.
export default function RegistrosDiarios({ fecha }) {
  const { usuario } = useDatos();
  const registros = useRegistros(usuario.id);
  const { config, marcas, listo, sinBase, alternar } = registros;
  const [ajustes, setAjustes] = useState(false);
  const [noQuiere, setNoQuiere] = useState(dijoQueNo);
  const [error, setError] = useState("");
  const hoy = fechaLocal();
  const activos = REGISTROS.filter((r) => config.activos.includes(r.codigo));

  async function tocar(codigo) {
    const puso = !marcas.has(`${fecha}|${codigo}`);
    if (puso) vibrar(12);
    const ok = await alternar(fecha, codigo);
    setError(ok ? "" : "No se pudo guardar. Probá de nuevo.");
  }

  const hoja = createPortal(
    <Hoja abierta={ajustes} onCerrar={() => setAjustes(false)} titulo="Registros diarios">
      <ConfigRegistros registros={registros} avisar={setError} />
    </Hoja>,
    document.body,
  );

  if (!listo) return null;

  if (!activos.length) {
    if (noQuiere) return hoja;
    return (
      <>
        <article className="tarjeta registros-vacio">
          <span className="registros-vacio-icono"><ListChecks size={18} /></span>
          <span><strong>¿Creatina, gym, magnesio?</strong><small>Tildalos cada día para no olvidarte.</small></span>
          <button type="button" className="boton-texto" onClick={() => setAjustes(true)}>Elegir</button>
          <button
            type="button"
            className="boton-texto registros-no"
            onClick={() => {
              setNoQuiere(true);
              try {
                localStorage.setItem(CLAVE_NO, "1");
              } catch {
                // Sin almacenamiento: vuelve a aparecer la próxima vez.
              }
            }}
          >
            No uso
          </button>
        </article>
        {hoja}
      </>
    );
  }

  return (
    <>
      <article className="tarjeta registros-dia" aria-label="Registros del día">
        <header className="registros-cabecera">
          <span className="habito-titulo"><ListChecks size={16} /> {fecha === hoy ? "Hoy" : "Ese día"}</span>
          <button type="button" className="boton-icono chico" onClick={() => setAjustes(true)} aria-label="Elegir registros"><Settings2 size={16} /></button>
        </header>
        <div className="registros-lista">
          {activos.map((r) => {
            const hecho = marcas.has(`${fecha}|${r.codigo}`);
            const racha = rachaDe(marcas, r.codigo, hoy);
            return (
              <motion.button
                key={r.codigo}
                type="button"
                className={hecho ? "registro hecho" : "registro"}
                whileTap={{ scale: 0.95 }}
                onClick={() => tocar(r.codigo)}
                aria-pressed={hecho}
                disabled={sinBase}
                aria-label={`${r.accion}${hecho ? " (tildado)" : ""}`}
              >
                <span className="registro-check" aria-hidden="true">
                  {hecho ? (
                    <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}><Check size={17} strokeWidth={3} /></motion.span>
                  ) : <r.icono size={17} />}
                </span>
                <span className="registro-texto">
                  <strong>{r.nombre}</strong>
                  <small>{racha >= 2 ? `🔥 ${racha} días` : hecho ? "Listo" : "Sin tildar"}</small>
                </span>
              </motion.button>
            );
          })}
        </div>
        {sinBase && <p className="nota">Falta correr el SQL 043 en Supabase para poder tildarlos.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </article>
      {hoja}
    </>
  );
}

// En Ajustes: la misma elección.
export function AjustesRegistros({ avisar }) {
  const { usuario } = useDatos();
  const registros = useRegistros(usuario.id);
  return (
    <section className="tarjeta ajuste">
      <h2>Registros diarios</h2>
      <ConfigRegistros registros={registros} avisar={avisar} />
      <p className="nota">Aparecen en el Resumen, abajo del agua. Tocás y queda tildado.</p>
    </section>
  );
}
