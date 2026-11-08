import { useCallback, useEffect, useState } from "react";
import { Check, SendHorizontal } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";

export default function Mejoras({ avisar }) {
  const { usuario, perfiles } = useDatos();
  const [lista, setLista] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [pedidos, rol] = await Promise.all([
      supabase.from("mejoras").select("*").order("creado_en", { ascending: false }).limit(200),
      supabase.from("administradores").select("usuario_id").eq("usuario_id", usuario.id).maybeSingle(),
    ]);
    if (pedidos.error) return; // La tabla todavía no existe.
    setLista(pedidos.data);
    setAdmin(Boolean(rol.data));
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
  }

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

      {lista.length > 0 && (
        <>
          <h3 className="perfil-subtitulo">Pedidos del grupo</h3>
          <ul className="lista-mejoras">
            {lista.map((m) => (
              <li key={m.id} className={m.hecha ? "hecha" : ""}>
                <p>{m.texto}</p>
                <small>
                  {`${m.usuario_id === usuario.id ? "Vos" : perfiles[m.usuario_id]?.nombre || "Amigo"} · `}
                  {haceCuanto(m.creado_en)}{m.hecha ? " · Hecha" : ""}
                </small>
                {admin && (
                  <button className="boton-chico" onClick={() => marcar(m)} aria-pressed={m.hecha}>
                    <Check size={14} /> {m.hecha ? "Reabrir" : "Marcar hecha"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
