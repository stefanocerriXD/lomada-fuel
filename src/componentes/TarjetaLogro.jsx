import { Lock } from "lucide-react";
import { motion } from "motion/react";
import { nivelDe } from "../lib/medallas.js";

const numero = (v) => Number(v).toLocaleString("es-AR");

// Con "cantidad" muestra el avance propio; con "nivel" solo lo alcanzado, para ver a otra persona.
export default function TarjetaLogro({ logro, cantidad, nivel: nivelFijo }) {
  const nivel = nivelFijo ?? nivelDe(logro, cantidad);
  const actual = logro.niveles[nivel - 1];
  const siguiente = logro.niveles[nivel];
  const Icono = logro.icono;
  const base = actual?.meta ?? 0;
  const avance = siguiente ? Math.min(Math.max((cantidad - base) / (siguiente.meta - base), 0), 1) : 1;

  return (
    <li className={nivel ? "tarjeta medalla ganada" : "tarjeta medalla"}>
      <span className="medalla-icono" aria-hidden="true">{nivel ? <Icono size={24} /> : <Lock size={20} />}</span>
      <strong>{actual?.nombre || logro.niveles[0].nombre}</strong>
      <span className="medalla-niveles" role="img" aria-label={`Nivel ${nivel} de ${logro.niveles.length}`}>
        {logro.niveles.map((n, i) => <i key={n.meta} className={i < nivel ? "lleno" : ""} />)}
      </span>
      {cantidad === undefined ? (
        <small>Nivel {nivel} de {logro.niveles.length}</small>
      ) : siguiente ? (
        <>
          <small>{numero(cantidad)} de {numero(siguiente.meta)} {logro.unidad}</small>
          <span className="pista-progreso"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.7 }} /></span>
          {nivel > 0 && <small className="medalla-proximo">Próximo: {siguiente.nombre}</small>}
        </>
      ) : (
        <small>Nivel máximo</small>
      )}
    </li>
  );
}
