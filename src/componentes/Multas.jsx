import { useState } from "react";
import { Camera, Check, Pencil, Ticket } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { FOTOS_POR_DIA, fotosDelDia, inicioSemana, multasDeLaSemana, usoDeComodin } from "../lib/multas.js";
import { Avatar, vibrar } from "./Base.jsx";

// Tabla de multas de la semana, la prenda y el comodín propio.
export default function Multas({ avisar }) {
  const { usuario, perfiles, comidas, extras, cargarExtras } = useDatos();
  const [usando, setUsando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [prenda, setPrenda] = useState("");
  const hoy = fechaLocal();
  const multas = extras.multas || [];
  const comodines = extras.comodines || [];
  const tabla = multasDeLaSemana(multas, perfiles, hoy);
  const comodin = usoDeComodin({ comodines, multas, comidas, usuarioId: usuario.id, hoy });
  const lunes = inicioSemana(hoy);
  const usoComodin = (id) => comodines.some((c) => c.usuario_id === id && c.fecha >= lunes);
  const hechas = fotosDelDia(comidas, usuario.id, hoy);

  async function usarComodin() {
    if (!usando) return setUsando(true);
    const { error } = await supabase.rpc("usar_comodin", { p_fecha: comodin.fecha });
    setUsando(false);
    if (error) return avisar(error.message.includes("comodin_usado") ? "Ya usaste el comodín esta semana" : "No se pudo usar el comodín");
    vibrar(15);
    avisar(comodin.fecha === hoy ? "Comodín usado: hoy no te multan" : "Comodín usado: te sacamos la multa de ayer");
    await cargarExtras();
  }

  async function guardarPrenda() {
    const valor = prenda.trim().slice(0, 200);
    if (!valor) return setEditando(false);
    const { error } = await supabase.from("ajustes_grupo").update({ valor }).eq("clave", "prenda");
    if (error) return avisar("No se pudo cambiar la prenda");
    setEditando(false);
    await cargarExtras();
  }

  return (
    <section className="tarjeta multas">
      <div className="multas-hoy">
        <span className={hechas >= FOTOS_POR_DIA ? "fotos-hoy completas" : "fotos-hoy"}>
          {hechas >= FOTOS_POR_DIA ? <Check size={15} /> : <Camera size={15} />} {Math.min(hechas, FOTOS_POR_DIA)}/{FOTOS_POR_DIA} fotos hoy
        </span>
        <small>Mínimo {FOTOS_POR_DIA} fotos de comidas por día. Se cuenta a la medianoche.</small>
      </div>

      <ul className="multas-tabla">
        {tabla.map(({ perfil, multas: n }) => (
          <li key={perfil.id} className={n > 0 ? "con-multas" : ""}>
            <Avatar perfil={perfil} tam={30} />
            <span className="multas-nombre">{perfil.id === usuario.id ? "Vos" : perfil.nombre}{usoComodin(perfil.id) && <small> · usó comodín</small>}</span>
            <strong>{n}</strong>
          </li>
        ))}
      </ul>

      <div className="multas-prenda">
        <span>Prenda del que más multas junte:</span>
        {editando ? (
          <div className="multas-prenda-editar">
            <input value={prenda} onChange={(e) => setPrenda(e.target.value)} maxLength={200} aria-label="Prenda" autoFocus />
            <button className="boton-chico activo" onClick={guardarPrenda}>Guardar</button>
          </div>
        ) : (
          <strong>
            {extras.prenda || "A definir"}
            {extras.admin && <button className="boton-icono chico" onClick={() => { setPrenda(extras.prenda || ""); setEditando(true); }} aria-label="Cambiar la prenda"><Pencil size={14} /></button>}
          </strong>
        )}
      </div>

      {comodin && (
        <button className={usando ? "boton boton-secundario confirmar" : "boton boton-secundario"} onClick={usarComodin} onBlur={() => setUsando(false)}>
          <Ticket size={17} /> {usando ? "¿Seguro? Es uno por semana" : comodin.texto}
        </button>
      )}
    </section>
  );
}
