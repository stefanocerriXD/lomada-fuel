import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ACTUALIZACIONES, marcarVistas, nuevasDesde } from "../data/actualizaciones.js";
import { aFecha } from "../lib/fechas.js";

const fechaLinda = (f) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(aFecha(f));

// Los cambios importantes de la app, agrupados por día. Al abrirla quedan vistas.
export default function Actualizaciones() {
  const [nuevas] = useState(nuevasDesde);
  useEffect(() => {
    marcarVistas();
  }, []);

  const dias = ACTUALIZACIONES.reduce((t, a) => {
    (t[a.fecha] ||= []).push(a);
    return t;
  }, {});

  return (
    <div className="actualizaciones">
      <p className="ajuste-texto">Lo importante que fuimos sumando a la app. Los arreglos chicos no aparecen acá.</p>
      {Object.entries(dias).map(([fecha, lista]) => (
        <section key={fecha} className="actualizaciones-dia">
          <h3 className="perfil-subtitulo">{fechaLinda(fecha)}</h3>
          <ul>
            {lista.map((a, i) => (
              <motion.li key={a.id} className="tarjeta actualizacion" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.04 }}>
                <span className="actualizacion-emoji" aria-hidden="true">{a.emoji}</span>
                <div>
                  <strong>{a.titulo}{nuevas.has(a.id) && <span className="pastilla-nuevo">Nuevo</span>}</strong>
                  <p>{a.texto}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
