import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Users } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { Hoja, vibrar } from "./Base.jsx";

// Arriba, para quien está en varios grupos: qué grupo está mirando y cambiar a otro.
export default function SelectorGrupo() {
  const { grupo, misGrupos, cambiarGrupo } = useDatos();
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState(null);

  async function elegir(id) {
    if (id === grupo.id) return setAbierto(false);
    setCambiando(id);
    vibrar(10);
    const ok = await cambiarGrupo(id);
    if (!ok) setCambiando(null);
  }

  return (
    <>
      <button className="selector-grupo" onClick={() => setAbierto(true)} aria-label={`Grupo: ${grupo.nombre}. Cambiar de grupo`}>
        <span>{grupo.nombre}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {createPortal(<Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Tus grupos">
        <ul className="lista-grupos">
          {misGrupos.map((g) => (
            <li key={g.id}>
              <button className={g.id === grupo.id ? "grupo-opcion activo" : "grupo-opcion"} onClick={() => elegir(g.id)} disabled={Boolean(cambiando)} aria-current={g.id === grupo.id ? "true" : undefined}>
                <span className="grupo-icono" aria-hidden="true"><Users size={18} /></span>
                <span className="grupo-nombre">{g.nombre}</span>
                {g.id === grupo.id ? <Check size={18} aria-label="Lo estás viendo" /> : cambiando === g.id ? <small>Cambiando…</small> : null}
              </button>
            </li>
          ))}
        </ul>
        <p className="nota">Para sumarte a otro grupo o elegir dónde se publican tus comidas, andá a Ajustes → Grupos.</p>
      </Hoja>, document.body)}
    </>
  );
}
