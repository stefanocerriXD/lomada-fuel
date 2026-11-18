import { useEffect, useState } from "react";
import { Plane, Trophy } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { DEPORTES, DIAS_SEMANA, nombreDiaSemana, useMotivacion } from "../lib/motivacion.js";
import { vibrar } from "./Base.jsx";

// Ajustes → Viaje y Match Day: cada uno arma su cuenta regresiva y su día de partido.
export default function MiMotivacion({ avisar }) {
  const { usuario } = useDatos();
  const motivacion = useMotivacion(usuario.id);
  if (motivacion.datos === undefined) return null;
  if (motivacion.sinTabla) {
    return (
      <section className="tarjeta ajuste">
        <h2>Viaje y Match Day</h2>
        <p className="ajuste-texto">Todavía no está activo: falta terminar la configuración de la base de datos.</p>
      </section>
    );
  }
  return (
    <>
      <MiViaje datos={motivacion.datos} guardar={motivacion.guardar} avisar={avisar} />
      <MiMatchDay datos={motivacion.datos} guardar={motivacion.guardar} avisar={avisar} />
    </>
  );
}

const fechaLarga = (f) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(new Date(`${f}T12:00:00`));

function MiViaje({ datos, guardar, avisar }) {
  const hoy = fechaLocal();
  const [destino, setDestino] = useState(datos?.viaje_destino || "");
  const [fecha, setFecha] = useState(datos?.viaje_fecha || "");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    setDestino(datos?.viaje_destino || "");
    setFecha(datos?.viaje_fecha || "");
  }, [datos?.viaje_destino, datos?.viaje_fecha]);

  const tiene = Boolean(datos?.viaje_destino && datos?.viaje_fecha);
  const cambio = destino.trim() !== (datos?.viaje_destino || "") || fecha !== (datos?.viaje_fecha || "");
  const valido = destino.trim().length > 0 && fecha >= hoy;

  async function enviar(e) {
    e.preventDefault();
    if (!valido) return;
    setGuardando(true);
    const ok = await guardar({ viaje_destino: destino.trim().slice(0, 40), viaje_fecha: fecha });
    setGuardando(false);
    if (!ok) return avisar?.("No se pudo guardar");
    vibrar(15);
    avisar?.(`Cuenta regresiva a ${destino.trim()} lista`);
  }
  async function quitar() {
    setGuardando(true);
    const ok = await guardar({ viaje_destino: null, viaje_fecha: null });
    setGuardando(false);
    if (!ok) return avisar?.("No se pudo guardar");
    avisar?.("Sacaste el viaje");
  }

  return (
    <form className="tarjeta ajuste mi-motivacion" onSubmit={enviar}>
      <h3 className="perfil-subtitulo mi-motivacion-titulo"><Plane size={17} aria-hidden="true" /> Tu viaje</h3>
      <p className="ajuste-texto">
        {tiene ? `Vas a ${datos.viaje_destino} el ${fechaLarga(datos.viaje_fecha)}. ` : "¿Tenés un viaje que te motive? "}
        La cuenta regresiva aparece en Progreso y te avisamos al arrancar, un mes antes, a los 15, 7, 2 y 1 día, y el día del viaje.
      </p>
      <div className="campos-dobles">
        <label className="campo">
          <span>Destino</span>
          <input value={destino} onChange={(e) => setDestino(e.target.value)} maxLength={40} placeholder="Floripa" autoComplete="off" />
        </label>
        <label className="campo">
          <span>Fecha</span>
          <input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} />
        </label>
      </div>
      <div className="mi-motivacion-botones">
        <button className="boton" type="submit" disabled={!valido || !cambio || guardando}>{guardando ? "Guardando…" : tiene ? "Guardar cambios" : "Arrancar la cuenta regresiva"}</button>
        {tiene && <button className="boton-texto" type="button" onClick={quitar} disabled={guardando}>Sacar el viaje</button>}
      </div>
    </form>
  );
}

const HORAS = Array.from({ length: 18 }, (_, i) => i + 6);

function MiMatchDay({ datos, guardar, avisar }) {
  const inicial = () => ({
    activo: datos?.match_activo ?? false,
    nombre: datos?.match_nombre || "fútbol",
    dia: datos?.match_dia ?? 0,
    hora: datos?.match_hora ?? 16,
  });
  const [m, setM] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setM(inicial()); }, [datos?.match_activo, datos?.match_nombre, datos?.match_dia, datos?.match_hora]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambio = !datos || m.activo !== datos.match_activo || m.nombre.trim() !== datos.match_nombre || m.dia !== datos.match_dia || m.hora !== datos.match_hora;
  const valido = m.nombre.trim().length > 0;
  const temprano = m.hora < 12;
  const dia = nombreDiaSemana(m.dia);
  const diaAntes = nombreDiaSemana((m.dia + 6) % 7);

  async function enviar(e) {
    e.preventDefault();
    if (!valido) return;
    setGuardando(true);
    const ok = await guardar({ match_activo: m.activo, match_nombre: m.nombre.trim().slice(0, 30), match_dia: m.dia, match_hora: m.hora });
    setGuardando(false);
    if (!ok) return avisar?.("No se pudo guardar");
    vibrar(15);
    avisar?.(m.activo ? "Match Day guardado" : "Match Day apagado");
  }

  return (
    <form className="tarjeta ajuste mi-motivacion" onSubmit={enviar}>
      <h3 className="perfil-subtitulo mi-motivacion-titulo"><Trophy size={17} aria-hidden="true" /> Tu Match Day</h3>
      <button type="button" role="switch" aria-checked={m.activo} className="preferencia" onClick={() => { setM({ ...m, activo: !m.activo }); vibrar(8); }}>
        <span>Avisarme el día que juego</span>
        <span className={m.activo ? "llave-aviso prendida" : "llave-aviso"} aria-hidden="true"><i /></span>
      </button>
      {m.activo && (
        <>
          <div className="campo">
            <span id="etiqueta-deporte">¿Qué jugás?</span>
            <div className="chips-deporte" role="radiogroup" aria-labelledby="etiqueta-deporte">
              {DEPORTES.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={m.nombre === d} className={m.nombre === d ? "activo" : ""} onClick={() => setM({ ...m, nombre: d })}>{d}</button>
              ))}
            </div>
            <input value={m.nombre} onChange={(e) => setM({ ...m, nombre: e.target.value })} maxLength={30} placeholder="u otro: vóley, natación…" aria-label="Deporte" />
          </div>
          <div className="campo">
            <span id="etiqueta-dia-partido">Día</span>
            <div className="dias-semana" role="radiogroup" aria-labelledby="etiqueta-dia-partido">
              {DIAS_SEMANA.map(([n, corto, largo]) => (
                <button key={n} type="button" role="radio" aria-checked={m.dia === n} aria-label={largo} className={m.dia === n ? "activo" : ""} onClick={() => setM({ ...m, dia: n })}>{corto}</button>
              ))}
            </div>
          </div>
          <label className="campo">
            <span>Hora del partido</span>
            <select value={m.hora} onChange={(e) => setM({ ...m, hora: Number(e.target.value) })}>
              {HORAS.map((h) => <option key={h} value={h}>{h} h</option>)}
            </select>
          </label>
          <p className="nota mi-motivacion-ejemplo">
            {temprano
              ? `Como jugás temprano, el aviso te llega la noche anterior (${diaAntes} a las 21): "Mañana es MATCH DAY. Mañana a las ${m.hora} hay ${m.nombre.trim() || "partido"}. Esta noche cená tu CARB LOAD."`
              : `El aviso te llega el ${dia} a las 9: "MATCH DAY. Hoy a las ${m.hora} hay ${m.nombre.trim() || "partido"}. Día de guerra: no te olvides de publicar tu CARB LOAD."`}
          </p>
        </>
      )}
      <button className="boton" type="submit" disabled={!valido || !cambio || guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
