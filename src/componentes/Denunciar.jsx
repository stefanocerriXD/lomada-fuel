// Denunciar y bloquear (SQL 070). Apple lo pide a las apps donde la gente sube cosas: poder denunciar lo que
// está mal y dejar de ver a alguien. La denuncia le llega al dueño, que la revisa desde el Panel del dueño.
import { useEffect, useState } from "react";
import { Flag, ShieldOff, UserX } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo } from "../lib/api.js";
import { Avatar, Hoja, vibrar } from "./Base.jsx";

const EVENTO = "lomada:denunciar";
// Abre la hoja desde cualquier lado: { tipo: "mensaje" | "comida" | "perfil", objetoId, usuarioId, contenido, fotoPath }.
export const denunciar = (d) => window.dispatchEvent(new CustomEvent(EVENTO, { detail: d }));

export const MOTIVOS = [
  ["ofensivo", "Ofensivo o de mal gusto"],
  ["acoso", "Acoso o burla hacia alguien"],
  ["sexual", "Contenido sexual o violento"],
  ["spam", "Spam o engaño"],
  ["otro", "Otra cosa"],
];
const QUE = { mensaje: "este mensaje", comida: "esta comida", perfil: "este perfil" };
const faltaSql = (err) => /does not exist|42P01|PGRST205|Could not find/.test(`${err?.code} ${err?.message}`);

export default function Denunciar({ avisar }) {
  const { usuario, perfiles, bloqueados, bloquear } = useDatos();
  const [d, setD] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [conBloqueo, setConBloqueo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const abrir = (e) => {
      setD(e.detail);
      setMotivo("");
      setDetalle("");
      setConBloqueo(false);
      setError("");
    };
    window.addEventListener(EVENTO, abrir);
    return () => window.removeEventListener(EVENTO, abrir);
  }, []);

  const quien = d?.usuarioId && d.usuarioId !== usuario.id ? perfiles[d.usuarioId] : null;
  const yaBloqueado = quien && (bloqueados || []).includes(quien.id);

  async function enviar() {
    if (!motivo) return setError("Elegí qué pasa");
    setEnviando(true);
    setError("");
    const { data, error: err } = await supabase
      .from("denuncias")
      .insert({
        denunciante_id: usuario.id,
        denunciado_id: quien?.id || null,
        tipo: d.tipo,
        objeto_id: d.objetoId || null,
        motivo,
        detalle: detalle.trim().slice(0, 500) || null,
        contenido: String(d.contenido || "").slice(0, 1200) || null,
        foto_path: d.fotoPath || null,
      })
      .select("id")
      .single();
    if (err) {
      setEnviando(false);
      return setError(faltaSql(err) ? "Falta correr el SQL 070 en Supabase" : /row-level/.test(err.message) ? "Hoy ya mandaste muchas denuncias" : "No se pudo mandar la denuncia");
    }
    avisarGrupo("denuncia", data.id);
    let bloqueo = false;
    if (conBloqueo && quien && !yaBloqueado) bloqueo = await bloquear(quien.id).then(() => true, () => false);
    vibrar(15);
    setEnviando(false);
    setD(null);
    avisar(bloqueo ? `Denuncia enviada. Bloqueaste a ${quien.nombre}` : "Denuncia enviada. La revisamos en menos de 24 horas");
  }

  return (
    <Hoja abierta={Boolean(d)} onCerrar={() => setD(null)} titulo="Denunciar">
      {d && (
        <div className="denunciar">
          <p className="ajuste-texto">¿Qué pasa con {QUE[d.tipo]}? Nadie se entera de que lo denunciaste: le llega solo a quien administra Lomada Fuel, que lo revisa en menos de 24 horas.</p>
          <div className="denunciar-motivos" role="radiogroup" aria-label="Motivo de la denuncia">
            {MOTIVOS.map(([id, texto]) => (
              <label key={id} className={motivo === id ? "activo" : ""}>
                <input type="radio" name="motivo-denuncia" value={id} checked={motivo === id} onChange={() => { setMotivo(id); setError(""); vibrar(5); }} />
                <span>{texto}</span>
              </label>
            ))}
          </div>
          <label className="campo">
            <span>Contanos algo más (opcional)</span>
            <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} maxLength={500} aria-label="Detalle de la denuncia" />
          </label>
          {quien && !yaBloqueado && (
            <label className="interruptor">
              <input type="checkbox" checked={conBloqueo} onChange={(e) => setConBloqueo(e.target.checked)} />
              <span>Bloquear también a {quien.nombre}: dejás de ver sus comidas y sus mensajes</span>
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="boton boton-grande" onClick={enviar} disabled={enviando}><Flag size={17} /> {enviando ? "Enviando…" : "Mandar denuncia"}</button>
        </div>
      )}
    </Hoja>
  );
}

// Bloquear o desbloquear desde el perfil o el chat: el primer toque pregunta.
export function BotonBloquear({ perfil, avisar, className = "boton boton-secundario", alListo }) {
  const { bloqueados, bloquear, desbloquear } = useDatos();
  const [confirmar, setConfirmar] = useState(false);
  if (bloqueados === null || !perfil) return null;
  const bloqueado = bloqueados.includes(perfil.id);

  async function tocar() {
    if (!bloqueado && !confirmar) { setConfirmar(true); vibrar(5); return; }
    try {
      await (bloqueado ? desbloquear(perfil.id) : bloquear(perfil.id));
      vibrar(12);
      avisar(bloqueado ? `Desbloqueaste a ${perfil.nombre}` : `Bloqueaste a ${perfil.nombre}. No vas a ver sus comidas ni sus mensajes`);
      alListo?.();
    } catch {
      avisar("No se pudo. Probá de nuevo");
    }
    setConfirmar(false);
  }

  return (
    <button type="button" className={`${className}${confirmar ? " peligro" : ""}`} onClick={tocar} onBlur={() => setConfirmar(false)}>
      {bloqueado ? <ShieldOff size={17} /> : <UserX size={17} />}
      {bloqueado ? `Desbloquear a ${perfil.nombre}` : confirmar ? "¿Seguro? Tocá de nuevo" : `Bloquear a ${perfil.nombre}`}
    </button>
  );
}

// Ajustes › Cuenta: la lista de bloqueados, para desbloquear.
export function Bloqueados({ avisar }) {
  const { bloqueados, perfiles, desbloquear } = useDatos();
  const [otros, setOtros] = useState({});
  // Puede haber bloqueados de otro grupo: se buscan sus nombres.
  useEffect(() => {
    const faltan = (bloqueados || []).filter((id) => !perfiles[id]);
    if (!faltan.length) return;
    supabase.from("perfiles").select("id, nombre, emoji, color").in("id", faltan).then(({ data }) => setOtros(Object.fromEntries((data || []).map((p) => [p.id, p]))));
  }, [bloqueados, perfiles]);
  if (bloqueados === null) return null;

  return (
    <section className="tarjeta ajuste con-titulo" aria-label="Personas bloqueadas">
      <h3 className="perfil-subtitulo">Personas bloqueadas</h3>
      {bloqueados.length === 0 ? (
        <p className="ajuste-texto">No bloqueaste a nadie. Para bloquear a alguien, entrá a su perfil o mantené apretado un mensaje suyo.</p>
      ) : (
        <ul className="lista-bloqueados">
          {bloqueados.map((id) => {
            const p = perfiles[id] || otros[id] || { id, nombre: "Alguien" };
            return (
              <li key={id}>
                <Avatar perfil={p} tam={34} />
                <span>{p.nombre}</span>
                <button className="boton-chico" onClick={() => desbloquear(id).then(() => avisar(`Desbloqueaste a ${p.nombre}`), () => avisar("No se pudo desbloquear"))}>Desbloquear</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
