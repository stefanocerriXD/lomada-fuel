import { useCallback, useEffect, useState } from "react";
import { Check, MessageSquareReply, SendHorizontal } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";

export default function Mejoras({ avisar }) {
  const { usuario, perfiles, grupo } = useDatos();
  const [lista, setLista] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [dueno, setDueno] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [pedidos, rol, esDueno] = await Promise.all([
      supabase.from("mejoras").select("*").order("creado_en", { ascending: false }).limit(200),
      supabase.from("administradores").select("usuario_id").eq("usuario_id", usuario.id).maybeSingle(),
      supabase.rpc("es_dueno"),
    ]);
    if (pedidos.error) return; // La tabla todavía no existe.
    setLista(pedidos.data);
    setAdmin(Boolean(rol.data));
    setDueno(esDueno.data === true);
  }, [usuario.id]);

  useEffect(() => {
    cargar().catch(() => {});
  }, [cargar]);

  if (lista === null) return null;

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (limpio.length < 3) return setError("Contá un poco más.");
    setEnviando(true);
    setError("");
    const { data, error: err } = await supabase.from("mejoras").insert({ usuario_id: usuario.id, texto: limpio }).select().single();
    setEnviando(false);
    if (err) return setError("No se pudo enviar. Probá de nuevo.");
    setTexto("");
    document.activeElement?.blur();
    setLista((prev) => [data, ...prev]);
    avisar("Pedido enviado. Gracias");
    avisarGrupo("mejora", data.id);
  }

  async function marcar(pedido) {
    const hecha = !pedido.hecha;
    const { error: err } = await supabase.from("mejoras").update({ hecha }).eq("id", pedido.id);
    if (err) return avisar("No se pudo guardar");
    setLista((prev) => prev.map((m) => (m.id === pedido.id ? { ...m, hecha } : m)));
    // A quien lo pidió le llega un aviso de que ya está en la app.
    if (hecha) {
      avisarGrupo("mejora_hecha", pedido.id);
      avisar(pedido.usuario_id === usuario.id ? "Marcada como hecha" : `Hecha. Le avisamos a ${perfiles[pedido.usuario_id]?.nombre || "quien la pidió"}`);
    }
  }

  // Solo el dueño (SQL 060): la respuesta queda abajo del pedido y a quien lo pidió le llega un aviso.
  async function responder(pedido, respuesta, noVa) {
    const { error: err } = await supabase.rpc("responder_mejora", { p_id: pedido.id, p_respuesta: respuesta, p_no_va: noVa });
    if (err) {
      avisar(/Could not find|PGRST202/.test(`${err.code} ${err.message}`) ? "Falta correr el SQL 060 en Supabase" : "No se pudo guardar la respuesta");
      return false;
    }
    const limpio = respuesta.trim() || null;
    setLista((prev) => prev.map((m) => (m.id === pedido.id ? { ...m, respuesta: limpio, no_va: noVa, respondida_en: limpio ? new Date().toISOString() : null } : m)));
    if (!limpio) avisar("Respuesta borrada");
    else if (pedido.usuario_id === usuario.id) avisar("Respuesta guardada");
    else {
      avisarGrupo("mejora_respuesta", pedido.id);
      avisar(`Respondido. Le avisamos a ${perfiles[pedido.usuario_id]?.nombre || "quien la pidió"}`);
    }
    return true;
  }

  const props = { usuario, perfiles, admin, marcar, dueno, responder };
  return (
    <section className="tarjeta ajuste mejoras">
      <h2>Mejoras</h2>
      <p className="ajuste-texto">¿Qué cambiarías o agregarías? Contalo acá y lo vemos.</p>
      <form className="formulario" onSubmit={enviar}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={1000} placeholder="Por ejemplo: quiero ver mi peso en el resumen" aria-label="Qué querés mejorar" />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="boton" disabled={enviando || !texto.trim()}>
          <SendHorizontal size={18} /> {enviando ? "Enviando…" : "Enviar pedido"}
        </button>
      </form>

      {(() => {
        // Cada grupo ve lo que se pidió en ese grupo (y lo propio). El dueño ve además lo de los otros grupos.
        const delGrupo = lista.filter((m) => !m.grupo_id || m.grupo_id === grupo.id || m.usuario_id === usuario.id);
        const otros = lista.filter((m) => !delGrupo.includes(m));
        const pendientes = (l) => l.filter((m) => !m.hecha && !m.no_va).length;
        return (
          <>
            {delGrupo.length > 0 && (
              <details className="desplegable-mejoras">
                <summary>Mejoras del grupo <small>{delGrupo.length} · {pendientes(delGrupo)} sin hacer</small></summary>
                <ListaMejoras lista={delGrupo} {...props} />
              </details>
            )}
            {otros.length > 0 && (
              <details className="desplegable-mejoras">
                <summary>Mejoras de otros grupos <small>{otros.length} · {pendientes(otros)} sin hacer · solo vos</small></summary>
                <ListaMejoras lista={otros} {...props} />
              </details>
            )}
          </>
        );
      })()}
    </section>
  );
}

function ListaMejoras({ lista, usuario, perfiles, admin, marcar, dueno, responder }) {
  const [abierta, setAbierta] = useState(null);
  return (
    <ul className="lista-mejoras">
      {lista.map((m) => (
        <li key={m.id} className={m.hecha ? "hecha" : m.no_va ? "no-va" : ""}>
          <p>{m.texto}</p>
          <small>
            {`${m.usuario_id === usuario.id ? "Vos" : perfiles[m.usuario_id]?.nombre || "Amigo"} · `}
            {haceCuanto(m.creado_en)}{m.hecha ? " · Hecha" : m.no_va ? " · No va" : ""}
          </small>
          {m.respuesta && abierta !== m.id && (
            <div className="mejora-respuesta">
              <strong>{m.no_va ? "Por qué no va" : "Respuesta"}</strong>
              <p>{m.respuesta}</p>
            </div>
          )}
          {abierta === m.id ? (
            <ResponderMejora pedido={m} cerrar={() => setAbierta(null)} responder={responder} />
          ) : (admin || dueno) && (
            <div className="mejora-acciones">
              {admin && (
                <button className="boton-chico" onClick={() => marcar(m)} aria-pressed={m.hecha}>
                  <Check size={14} /> {m.hecha ? "Reabrir" : "Marcar hecha"}
                </button>
              )}
              {dueno && (
                <button className="boton-chico" onClick={() => setAbierta(m.id)}>
                  <MessageSquareReply size={14} /> {m.respuesta ? "Editar respuesta" : "Responder"}
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ResponderMejora({ pedido, cerrar, responder }) {
  const [texto, setTexto] = useState(pedido.respuesta || "");
  const [noVa, setNoVa] = useState(Boolean(pedido.no_va));
  const [guardando, setGuardando] = useState(false);
  const vacio = !texto.trim();
  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    const ok = await responder(pedido, texto, noVa && !vacio);
    setGuardando(false);
    if (ok) cerrar();
  }
  return (
    <form className="mejora-responder" onSubmit={enviar}>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={500} autoFocus
        placeholder={noVa ? "Contale por qué no se puede" : "Tu respuesta"} aria-label="Respuesta al pedido" />
      <label className="mejora-no-va">
        <input type="checkbox" checked={noVa} onChange={(e) => setNoVa(e.target.checked)} />
        <span>No se puede hacer</span>
      </label>
      <div className="mejora-acciones">
        <button type="button" className="boton-chico" onClick={cerrar}>Cancelar</button>
        <button type="submit" className="boton-chico acento" disabled={guardando || (vacio && !pedido.respuesta)}>
          <SendHorizontal size={14} /> {guardando ? "Enviando…" : vacio ? "Borrar respuesta" : "Enviar respuesta"}
        </button>
      </div>
    </form>
  );
}
