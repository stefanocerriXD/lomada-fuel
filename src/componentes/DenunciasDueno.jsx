// Panel del dueño: las denuncias para revisar (SQL 070). Se borra lo denunciado o se descarta la denuncia.
import { useCallback, useEffect, useState } from "react";
import { Check, Flag, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { haceCuanto } from "../lib/fechas.js";
import { MOTIVOS } from "./Denunciar.jsx";

const MOTIVO = Object.fromEntries(MOTIVOS);
const TIPO = { mensaje: "Mensaje", comida: "Comida", perfil: "Perfil" };
const ESTADO = { borrado: "Borrado", descartada: "Descartada" };

export default function DenunciasDueno() {
  const [lista, setLista] = useState(null);
  const [falta, setFalta] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [trabajando, setTrabajando] = useState(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("denuncias_para_revisar");
    if (error) { setFalta(true); setLista([]); return; }
    setLista(data || []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function resolver(d, borrar) {
    if (borrar && confirmar !== d.id) return setConfirmar(d.id);
    setTrabajando(d.id);
    await supabase.rpc("resolver_denuncia", { p_id: d.id, p_borrar: borrar });
    setConfirmar(null);
    setTrabajando(null);
    cargar();
  }

  if (!lista) return null;
  const pendientes = lista.filter((d) => d.estado === "pendiente");
  return (
    <section className="tarjeta ajuste con-titulo denuncias-dueno">
      <h3 className="perfil-subtitulo"><Flag size={16} aria-hidden="true" /> Denuncias{pendientes.length ? ` (${pendientes.length} para revisar)` : ""}</h3>
      {falta ? (
        <p className="ajuste-texto">Falta correr el SQL 070 en Supabase.</p>
      ) : lista.length === 0 ? (
        <p className="ajuste-texto">No hay denuncias. Apple pide revisarlas en menos de 24 horas: cuando llegue una, te avisa una notificación.</p>
      ) : (
        <ul className="lista-denuncias">
          {lista.map((d) => (
            <li key={d.id} className={d.estado}>
              <p className="denuncia-cabecera">
                <strong>{TIPO[d.tipo]} de {d.denunciado || "alguien"}</strong>
                <small>{MOTIVO[d.motivo] || d.motivo} · {haceCuanto(d.creado_en)}</small>
              </p>
              {d.contenido && <blockquote>{d.contenido}</blockquote>}
              {d.detalle && <p className="ajuste-texto">“{d.detalle}”</p>}
              <small className="denuncia-meta">
                Denunció {d.denunciante || "alguien"}
                {d.denuncias_al_mismo > 1 ? ` · ${d.denuncias_al_mismo} denuncias a ${d.denunciado || "esta persona"}` : ""}
                {d.tipo !== "perfil" && !d.sigue_estando ? " · ya no está" : ""}
              </small>
              {d.estado === "pendiente" ? (
                <div className="denuncia-acciones">
                  {(d.tipo === "perfil" || d.sigue_estando) && (
                    <button className={confirmar === d.id ? "boton-chico peligro" : "boton-chico"} onClick={() => resolver(d, true)} onBlur={() => setConfirmar(null)} disabled={trabajando === d.id}>
                      <Trash2 size={14} /> {confirmar === d.id ? "¿Seguro?" : d.tipo === "perfil" ? "Sacar foto y bio" : "Borrar"}
                    </button>
                  )}
                  <button className="boton-chico" onClick={() => resolver(d, false)} disabled={trabajando === d.id}><Check size={14} /> {d.tipo !== "perfil" && !d.sigue_estando ? "Listo" : "Está bien, descartar"}</button>
                </div>
              ) : (
                <small className="denuncia-estado">{ESTADO[d.estado]}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
