import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";

function hace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function Inicio() {
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("comidas")
      .select("usuario_id, fecha, calorias, proteinas, carbohidratos, grasas, perfiles(nombre)")
      .gte("fecha", hace(6))
      .then(({ data, error: err }) => (err ? setError(err.message) : setFilas(data)));
  }, []);

  // Totales por persona de los últimos 7 días.
  const porPersona = {};
  for (const f of filas) {
    const nombre = f.perfiles?.nombre || "Sin nombre";
    const p = (porPersona[nombre] ??= { kcal: 0, prot: 0, carb: 0, gras: 0, comidas: 0, dias: new Set() });
    p.kcal += f.calorias || 0;
    p.prot += Number(f.proteinas) || 0;
    p.carb += Number(f.carbohidratos) || 0;
    p.gras += Number(f.grasas) || 0;
    p.comidas += 1;
    p.dias.add(f.fecha);
  }
  const personas = Object.entries(porPersona).sort((a, b) => b[1].comidas - a[1].comidas);
  const comidasTotales = filas.length;
  const diasRegistrados = new Set(filas.map((f) => `${f.usuario_id}-${f.fecha}`)).size;

  return (
    <section>
      <h2>Últimos 7 días</h2>
      {error && <p className="error">{error}</p>}
      <div className="kpis">
        <div><strong>{comidasTotales}</strong><span>comidas subidas</span></div>
        <div><strong>{diasRegistrados}</strong><span>días registrados</span></div>
        <div><strong>{personas.length}</strong><span>amigos activos</span></div>
      </div>

      {personas.length === 0 && <p>Todavía no hay comidas esta semana. Subí la primera desde Comidas.</p>}

      <table className="resumen">
        <thead>
          <tr>
            <th>Amigo</th>
            <th>Comidas</th>
            <th>Días</th>
            <th>kcal</th>
            <th>Prot.</th>
            <th>Carb.</th>
            <th>Grasas</th>
          </tr>
        </thead>
        <tbody>
          {personas.map(([nombre, p]) => (
            <tr key={nombre}>
              <td>{nombre}</td>
              <td>{p.comidas}</td>
              <td>{p.dias.size}</td>
              <td>{Math.round(p.kcal)}</td>
              <td>{Math.round(p.prot)} g</td>
              <td>{Math.round(p.carb)} g</td>
              <td>{Math.round(p.gras)} g</td>
            </tr>
          ))}
        </tbody>
      </table>

      {personas.length > 0 && (
        <p className="nota">
          Los valores son estimaciones de la IA, corregibles por cada uno. Son para divertirse y llevar la cuenta, no reemplazan a un nutricionista.
        </p>
      )}
    </section>
  );
}
