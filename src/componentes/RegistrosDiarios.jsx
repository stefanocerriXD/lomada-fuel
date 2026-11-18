import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { AlarmClock, Check, ListChecks, Plus, Settings2, Trash2 } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { definiciones, rachaDe, TIPOS_PROPIOS, useRegistros } from "../lib/registros.js";
import { leerHora, MAX_RECORDATORIOS, textoHora, useRecordatorios } from "../lib/recordatorios.js";
import { DIAS_SEMANA } from "../lib/motivacion.js";
import { Hoja, vibrar } from "./Base.jsx";
import { tic } from "../lib/sonidos.js";

const CLAVE_NO = "lomada-registros-no";
const dijoQueNo = () => {
  try {
    return localStorage.getItem(CLAVE_NO) === "1";
  } catch {
    return false;
  }
};

// Elegir qué registros aparecen cada día (los armados y los propios) y los recordatorios.
export function ConfigRegistros({ registros, avisar }) {
  const { usuario } = useDatos();
  const { config, guardarConfig, agregarPropio, quitarPropio, sinBase, sin053 } = registros;
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("actividad");
  async function cambiar(cambios) {
    const ok = await guardarConfig(cambios);
    if (!ok && !sinBase) avisar?.("No se pudo guardar");
  }
  async function agregar(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const ok = await agregarPropio(nombre, tipo);
    if (!ok) return avisar?.("No se pudo guardar");
    setNombre("");
    vibrar(10);
  }
  // Sin el SQL 053: el aviso fijo de las 20, como antes.
  const avisoDeLas20 = (
    <label className="interruptor registro-aviso">
      <input type="checkbox" checked={config.aviso} onChange={() => cambiar({ aviso: !config.aviso })} disabled={!config.activos.length} />
      <span>Avisarme a las 20 si me falta tildar alguno</span>
    </label>
  );
  // Sin el SQL 053 solo están los tres de siempre.
  const opciones = definiciones(config).filter((r) => !sin053 || (!r.nuevo && !r.propio));
  return (
    <div className="config-registros">
      <p className="ajuste-texto">Elegí qué querés tildar cada día. Es solo tuyo: el grupo no lo ve.</p>
      {opciones.map((r) => {
        const activo = config.activos.includes(r.codigo);
        return (
          <div key={r.codigo} className="registro-opcion-fila">
            <label className="interruptor registro-opcion">
              <input
                type="checkbox"
                checked={activo}
                onChange={() => cambiar({ activos: activo ? config.activos.filter((c) => c !== r.codigo) : [...config.activos, r.codigo] })}
              />
              <span className="registro-opcion-icono"><r.icono size={17} /></span>
              <span>{r.nombre}</span>
            </label>
            {r.propio && (
              <button type="button" className="boton-icono chico" onClick={() => quitarPropio(r.codigo)} aria-label={`Borrar ${r.nombre}`}><Trash2 size={15} /></button>
            )}
          </div>
        );
      })}
      {!sin053 && !sinBase && (
        <form className="registro-nuevo" onSubmit={agregar}>
          <span className="registro-nuevo-titulo">Agregar otro</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={30} placeholder="Yoga, natación, omega 3…" aria-label="Nombre del registro" />
          <div className="segmentos" role="radiogroup" aria-label="Tipo de registro">
            {TIPOS_PROPIOS.map(([id, texto]) => (
              <button key={id} type="button" role="radio" aria-checked={tipo === id} className={tipo === id ? "activo" : ""} onClick={() => setTipo(id)}>{texto}</button>
            ))}
          </div>
          <button className="boton boton-secundario" type="submit" disabled={!nombre.trim()}><Plus size={16} /> Agregar</button>
        </form>
      )}
      {sin053 ? avisoDeLas20 : <Recordatorios usuarioId={usuario.id} avisar={avisar} sinTabla={avisoDeLas20} />}
      {sinBase && <p className="nota">Para poder tildarlos falta correr el SQL 043 en Supabase.</p>}
    </div>
  );
}

// Recordatorios: varios, a la hora que quieras, los días que elijas y con tu texto.
function Recordatorios({ usuarioId, avisar, sinTabla: alternativo }) {
  const { lista, sinTabla, crear, cambiar, borrar } = useRecordatorios(usuarioId);
  if (sinTabla) return alternativo;
  if (lista === null) return null;
  const guardar = async (id, cambios) => {
    if (!(await cambiar(id, cambios))) avisar?.("No se pudo guardar");
  };
  return (
    <div className="recordatorios">
      <h3 className="perfil-subtitulo recordatorios-titulo"><AlarmClock size={16} aria-hidden="true" /> Recordatorios</h3>
      {!lista.length && <p className="nota">No tenés recordatorios. Agregá uno a la hora que quieras.</p>}
      {lista.map((r) => (
        <div key={r.id} className={r.activo ? "recordatorio" : "recordatorio apagado"}>
          <div className="recordatorio-fila">
            <input
              type="time"
              step="900"
              value={textoHora(r)}
              onChange={(e) => {
                const h = leerHora(e.target.value);
                if (h) guardar(r.id, h);
              }}
              aria-label="Hora del recordatorio"
            />
            <button type="button" role="switch" aria-checked={r.activo} className="recordatorio-llave" onClick={() => guardar(r.id, { activo: !r.activo })} aria-label="Prendido">
              <span className={r.activo ? "llave-aviso prendida" : "llave-aviso"} aria-hidden="true"><i /></span>
            </button>
            <button type="button" className="boton-icono chico" onClick={() => borrar(r.id)} aria-label="Borrar recordatorio"><Trash2 size={15} /></button>
          </div>
          <div className="dias-semana chicos" role="group" aria-label="Días">
            {DIAS_SEMANA.map(([n, corto, largo]) => {
              const esta = r.dias.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={esta}
                  aria-label={largo}
                  className={esta ? "activo" : ""}
                  onClick={() => {
                    const dias = esta ? r.dias.filter((d) => d !== n) : [...r.dias, n];
                    if (dias.length) guardar(r.id, { dias });
                  }}
                >
                  {corto[0]}
                </button>
              );
            })}
          </div>
          <input
            defaultValue={r.texto || ""}
            maxLength={80}
            placeholder={r.solo_si_falta ? "¿Ya tildaste lo de hoy?" : "Recordatorio"}
            aria-label="Texto del recordatorio"
            onBlur={(e) => {
              const texto = e.target.value.trim() || null;
              if (texto !== (r.texto || null)) guardar(r.id, { texto });
            }}
          />
          <label className="interruptor registro-aviso">
            <input type="checkbox" checked={r.solo_si_falta} onChange={() => guardar(r.id, { solo_si_falta: !r.solo_si_falta })} />
            <span>Solo si me falta tildar algo (y te dice qué)</span>
          </label>
        </div>
      ))}
      {lista.length < MAX_RECORDATORIOS && (
        <button type="button" className="boton boton-secundario" onClick={async () => { if (!(await crear())) avisar?.("No se pudo guardar"); else vibrar(10); }}>
          <Plus size={16} /> Agregar recordatorio
        </button>
      )}
      <p className="nota">Los minutos van de a 15 (20:00, 20:15, 20:30...).</p>
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
  const activos = definiciones(config).filter((r) => config.activos.includes(r.codigo));

  async function tocar(codigo) {
    const puso = !marcas.has(`${fecha}|${codigo}`);
    if (puso) { vibrar(12); tic(); }
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
          <span><strong>¿Creatina, gym, fútbol?</strong><small>Tildá lo que hacés cada día y poné recordatorios.</small></span>
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
