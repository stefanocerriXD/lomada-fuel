import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { nivelDe } from "../lib/medallas.js";
import { Hoja } from "./Base.jsx";

const numero = (v) => Number(v).toLocaleString("es-AR");

function Contenido({ logro, cantidad, nivel: nivelFijo }) {
  const nivel = nivelFijo ?? nivelDe(logro, cantidad);
  const siguiente = logro.niveles[nivel];
  const base = logro.niveles[nivel - 1]?.meta ?? 0;
  const conAvance = cantidad !== undefined;
  const avance = siguiente && conAvance ? Math.min(Math.max((cantidad - base) / (siguiente.meta - base), 0), 1) : 1;
  const Icono = logro.icono;

  return (
    <div className="detalle-logro">
      <div className="detalle-logro-cabecera">
        <span className="entrada-logro" aria-hidden="true"><Icono size={26} /></span>
        <div>
          <strong>Nivel {nivel} de {logro.niveles.length}</strong>
          <small>{conAvance ? `Llevás ${numero(cantidad)} ${logro.unidad}` : `Se cuenta en ${logro.unidad}`}</small>
        </div>
      </div>

      {siguiente ? (
        conAvance && (
          <div className="detalle-logro-avance">
            <p>Faltan <strong>{numero(Math.max(siguiente.meta - cantidad, 0))} {logro.unidad}</strong> para {siguiente.nombre}</p>
            <span className="pista-progreso gruesa" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)} aria-label="Avance al próximo nivel">
              <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.7 }} />
            </span>
            <small>{numero(cantidad)} de {numero(siguiente.meta)}</small>
          </div>
        )
      ) : (
        <p className="nota">Llegó al nivel máximo.</p>
      )}

      <ol className="niveles-logro">
        {logro.niveles.map((n, i) => {
          const hecho = i < nivel;
          return (
            <li key={n.meta} className={hecho ? "hecho" : i === nivel ? "proximo" : ""}>
              <span aria-hidden="true">{hecho ? <Check size={16} /> : <Lock size={15} />}</span>
              <strong>{n.nombre}</strong>
              <small>{numero(n.meta)} {logro.unidad}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Va directo al body: también se abre encima de la hoja del perfil.
export default function DetalleLogro({ abierto, onCerrar }) {
  const nombre = abierto ? abierto.logro.niveles[Math.max((abierto.nivel ?? nivelDe(abierto.logro, abierto.cantidad)) - 1, 0)].nombre : "Logro";
  return createPortal(
    <Hoja abierta={!!abierto} onCerrar={onCerrar} titulo={nombre}>
      {abierto && <Contenido {...abierto} />}
    </Hoja>,
    document.body,
  );
}
