import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

const MB = 1048576;
const mb = (bytes) => `${Math.round(bytes / MB).toLocaleString("es-AR")} MB`;

// Solo para quien administra la app: cuánto se usa de lo gratis. A los 70, 85 y 95 % llega un aviso.
export default function EspacioApp() {
  const [uso, setUso] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("uso_de_la_app").then(({ data, error: err }) => {
      if (err) setError(/could not find|PGRST202/i.test(`${err.message} ${err.code}`) ? "Falta correr el SQL 047 en Supabase." : "No se pudo leer el uso.");
      else setUso(data);
    });
  }, []);

  if (error) return <section className="tarjeta ajuste"><p className="nota">{error}</p></section>;
  if (!uso) return null;

  // A este ritmo (lo que se subió en los últimos 30 días), ¿en cuánto se llena?
  const libre = uso.fotos_limite - uso.fotos_bytes;
  const porMes = uso.fotos_bytes_30_dias;
  const meses = porMes > 0 ? libre / porMes : null;

  return (
    <section className="tarjeta ajuste espacio-app">
      <Medidor titulo="Fotos" usado={uso.fotos_bytes} limite={uso.fotos_limite} detalle={`${uso.fotos_cantidad.toLocaleString("es-AR")} archivos · ${mb(porMes)} en los últimos 30 días`} />
      <Medidor titulo="Base de datos" usado={uso.base_bytes} limite={uso.base_limite} />
      <p className="nota">
        {meses === null ? "Todavía no hay fotos nuevas este mes." : meses > 24 ? "A este ritmo, las fotos tienen lugar para más de 2 años." : `A este ritmo, las fotos se llenan en ${meses < 1 ? "menos de un mes" : `unos ${Math.round(meses)} ${Math.round(meses) === 1 ? "mes" : "meses"}`}.`}
        {" "}Te llega un aviso al pasar el 70, el 85 y el 95 %.
      </p>
      <p className="nota">
        <strong>IA (Gemini gratis):</strong> {uso.ia_sin_cupo ? `la última vez que se quedó sin cupo fue el ${new Date(`${uso.ia_sin_cupo}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}.` : "nunca se quedó sin cupo."} Si pasa, te llega un aviso ese día.
      </p>
    </section>
  );
}

function Medidor({ titulo, usado, limite, detalle }) {
  const pct = Math.min(100, (usado / limite) * 100);
  const estado = pct >= 85 ? "critico" : pct >= 70 ? "alerta" : "bien";
  return (
    <div className={`medidor-uso ${estado}`}>
      <div className="medidor-uso-cabecera">
        <strong>{titulo}</strong>
        <span>{mb(usado)} de {mb(limite)} · {pct < 1 ? "<1" : Math.round(pct)} %</span>
      </div>
      <div className="medidor-uso-barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={`${titulo}: ${Math.round(pct)} % usado`}>
        <i style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      {detalle && <small>{detalle}</small>}
    </div>
  );
}
