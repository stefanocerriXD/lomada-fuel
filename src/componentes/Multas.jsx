import { Camera, Check } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { cacasDeLaSemana, FOTOS_POR_DIA, fotosDelDia, inicioSemana } from "../lib/multas.js";
import { Avatar } from "./Base.jsx";

// Las maldiciones de la semana y quién carga con el Bocha Evo.
export default function Multas() {
  const { usuario, perfiles, comidas, extras } = useDatos();
  const hoy = fechaLocal();
  const tabla = cacasDeLaSemana(extras.multas || [], perfiles, hoy);
  const evo = (extras.bochaEvo || []).filter((b) => b.semana === inicioSemana(hoy)).map((b) => perfiles[b.usuario_id]?.nombre).filter(Boolean);
  const subio = fotosDelDia(comidas, usuario.id, hoy) >= FOTOS_POR_DIA;

  return (
    <section className="tarjeta multas">
      <div className="multas-hoy">
        <span className={subio ? "fotos-hoy completas" : "fotos-hoy"}>
          {subio ? <><Check size={15} /> Ya subiste tu foto de hoy</> : <><Camera size={15} /> Te falta tu foto de hoy</>}
        </span>
        <small>Mínimo {FOTOS_POR_DIA} foto de comida por día. Se cuenta a la medianoche.</small>
      </div>

      {evo.length > 0 && <p className="multas-evo">Bocha Evo esta semana: <strong>{evo.join(" y ")}</strong></p>}

      <ul className="multas-tabla">
        {tabla.map(({ perfil, cacas }) => (
          <li key={perfil.id} className={cacas > 0 ? "con-multas" : ""}>
            <Avatar perfil={perfil} tam={30} />
            <span className="multas-nombre">{perfil.id === usuario.id ? "Vos" : perfil.nombre}</span>
            <strong aria-label={`${cacas} ${cacas === 1 ? "maldición" : "maldiciones"}`}>{cacas > 0 ? "💩".repeat(Math.min(cacas, 7)) : "0"}</strong>
          </li>
        ))}
      </ul>
      <small className="multas-nota">Cada día sin foto es una maldición del Bocha. El domingo a la noche, el que más juntó se come al Bocha Evo toda la semana siguiente.</small>
    </section>
  );
}
