import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { nivelGeneral } from "../lib/medallas.js";
import { Avatar, datosMarco, marcoDe, proximoMarco } from "./Base.jsx";

// Resume todos los logros de una persona en un solo nivel, con el marco que tiene y el que sigue.
export default function NivelGeneral({ niveles, perfil }) {
  const { nivel, rango, puntos, siguiente, avance } = nivelGeneral(niveles);
  const actual = datosMarco(marcoDe(nivel));
  const proximo = proximoMarco(nivel);
  return (
    <div className="nivel-general">
      <div className="nivel-general-titulo">
        <strong>Nivel {nivel}</strong>
        <span>{rango}</span>
      </div>
      {siguiente && (
        <>
          <span className="pista-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)} aria-label={`Avance a ${siguiente.nombre}`}>
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.7 }} />
          </span>
          <small>{puntos} de {siguiente.puntos} niveles de logros para {siguiente.nombre}</small>
        </>
      )}
      {perfil && (actual || proximo) && (
        <div className="marcos-nivel">
          {actual && <Avatar perfil={{ ...perfil, nivel, caca: null }} tam={38} />}
          <span>
            <strong>{actual ? `Marco ${actual[2]} ${actual[3]}` : "Todavía sin marco"}</strong>
            <small>{proximo ? `Próximo: ${proximo[2]} ${proximo[3]} en el nivel ${proximo[0]} (te ${proximo[0] - nivel === 1 ? "falta 1" : `faltan ${proximo[0] - nivel}`})` : "Tenés el mejor marco de todos"}</small>
          </span>
          {proximo && (
            <>
              <ChevronRight size={16} className="marcos-flecha" aria-hidden="true" />
              <Avatar perfil={{ ...perfil, nivel: proximo[0], caca: null }} tam={38} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
