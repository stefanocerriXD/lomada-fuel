import { useCallback, useEffect, useState } from "react";
import { Check, Share2, ShieldCheck, UserMinus, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { compartirCodigo, EVENTO_PEDIDOS, textoError } from "../lib/grupos.js";
import { Avatar, vibrar } from "./Base.jsx";
import { campanita } from "../lib/sonidos.js";

// Para quien administra un grupo: el código para compartir, los pedidos para entrar y sacar a alguien.
export default function AdminGrupo({ grupo, esVista, avisar }) {
  const { usuario, perfiles, cargarPerfiles } = useDatos();
  const [codigo, setCodigo] = useState("");
  const [pedidos, setPedidos] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [sacando, setSacando] = useState(null);

  const cargar = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase.rpc("codigo_de_grupo", { p_grupo: grupo.id }),
      supabase.rpc("solicitudes_de_grupo", { p_grupo: grupo.id }),
    ]);
    if (!c.error) setCodigo(c.data || "");
    setPedidos(s.error ? [] : s.data || []);
  }, [grupo.id]);

  useEffect(() => {
    cargar();
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [cargar]);

  async function responder(pedido, aceptar) {
    setOcupado(pedido.id);
    const { error } = await supabase.rpc("responder_solicitud", { p_id: pedido.id, p_aceptar: aceptar });
    setOcupado(null);
    if (error) return avisar?.(textoError(error));
    vibrar(aceptar ? 20 : 10);
    if (aceptar) campanita();
    avisar?.(aceptar ? `${pedido.nombre} ya está en ${grupo.nombre}` : `Rechazaste a ${pedido.nombre}`);
    window.dispatchEvent(new Event(EVENTO_PEDIDOS));
    await cargar();
    if (aceptar && esVista) cargarPerfiles?.();
  }

  async function compartir() {
    const r = await compartirCodigo(grupo.nombre, codigo);
    if (r === "copiado") avisar?.("Código copiado");
    else if (r === "nada") avisar?.("Mantené apretado el código para copiarlo");
  }

  async function sacar(perfil) {
    if (sacando !== perfil.id) return setSacando(perfil.id);
    setSacando(null);
    const { error } = await supabase.rpc("sacar_de_grupo", { p_grupo: grupo.id, p_usuario: perfil.id });
    if (error) return avisar?.(textoError(error, "No se pudo sacar"));
    avisar?.(`Sacaste a ${perfil.nombre} del grupo`);
    cargarPerfiles?.();
  }

  const integrantes = esVista ? Object.values(perfiles).filter((p) => p.id !== usuario.id).sort((a, b) => a.nombre.localeCompare(b.nombre)) : [];

  return (
    <section className="admin-grupo" aria-label={`Administrar ${grupo.nombre}`}>
      <h3 className="perfil-subtitulo admin-grupo-titulo"><ShieldCheck size={17} aria-hidden="true" /> Administrás {grupo.nombre}</h3>

      {codigo && (
        <div className="admin-grupo-codigo">
          <span>
            <small>Código para entrar</small>
            <code>{codigo}</code>
          </span>
          <button className="boton-chico" onClick={compartir}><Share2 size={15} /> Compartir</button>
        </div>
      )}

      <p className="admin-grupo-sub">Pedidos para entrar</p>
      {pedidos === null ? null : pedidos.length === 0 ? (
        <p className="nota">Nadie esperando. Cuando alguien ponga el código te llega un aviso y lo aceptás acá.</p>
      ) : (
        <ul className="lista-grupos">
          {pedidos.map((p) => (
            <li key={p.id} className="grupo-fila pedido-grupo">
              <Avatar perfil={{ id: p.usuario_id, nombre: p.nombre }} tam={34} />
              <span className="grupo-nombre">
                {p.nombre}
                {p.usuario && <small>@{p.usuario}</small>}
              </span>
              <button className="boton-chico acento" disabled={ocupado === p.id} onClick={() => responder(p, true)} aria-label={`Aceptar a ${p.nombre}`}><Check size={15} /> Aceptar</button>
              <button className="boton-chico" disabled={ocupado === p.id} onClick={() => responder(p, false)} aria-label={`Rechazar a ${p.nombre}`}><X size={15} /></button>
            </li>
          ))}
        </ul>
      )}

      {integrantes.length > 0 && (
        <details className="admin-grupo-integrantes">
          <summary>Integrantes ({integrantes.length + 1})</summary>
          <ul className="lista-grupos">
            {integrantes.map((p) => (
              <li key={p.id} className="grupo-fila">
                <Avatar perfil={p} tam={34} />
                <span className="grupo-nombre">{p.nombre}</span>
                <button className={sacando === p.id ? "boton-chico peligro" : "boton-chico"} onClick={() => sacar(p)} onBlur={() => setSacando(null)} aria-label={`Sacar a ${p.nombre}`}>
                  <UserMinus size={15} /> {sacando === p.id ? "¿Seguro?" : "Sacar"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
