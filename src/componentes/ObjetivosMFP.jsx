import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { CAMPOS_A_MEDIDA } from "../lib/cuerpo.js";
import { leerObjetivos } from "../lib/objetivos.js";
import Lector from "./Lector.jsx";
import { Hoja, vibrar } from "./Base.jsx";

const EJEMPLO = "Calorías 2200\nCarbohidratos 40%\nProteínas 30%\nGrasas 30%";
const NOMBRES = [["p", "Proteínas"], ["c", "Carbos"], ["g", "Grasas"]];
const CAMPO = { p: "proteinas_propias", c: "carbos_propios", g: "grasas_propias" };

// MyFitnessPal no deja leer los objetivos desde otra app: se trae una captura de la pantalla de Objetivos.
export default function ObjetivosMFP({ abierta, onCerrar, onListo, avisar }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Objetivos de MyFitnessPal" ancha>
      {abierta && <Contenido onListo={onListo} avisar={avisar} />}
    </Hoja>
  );
}

function Contenido({ onListo, avisar }) {
  const { usuario, salud, cargarSalud, cargarPerfiles } = useDatos();
  const [leido, setLeido] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const fuera = leido?.gramos && CAMPOS_A_MEDIDA.find(({ campo, min, max }) => {
    const k = Object.keys(CAMPO).find((x) => CAMPO[x] === campo);
    return leido.gramos[k] < min || leido.gramos[k] > max;
  });

  async function usar() {
    setGuardando(true);
    setError("");
    try {
      const { error: errMeta } = await supabase.from("perfiles").update({ meta_calorias: leido.kcal }).eq("id", usuario.id);
      if (errMeta) throw errMeta;
      if (salud) {
        const macros = Object.fromEntries(Object.entries(CAMPO).map(([k, campo]) => [campo, leido.gramos[k]]));
        const { error: errSalud } = await supabase.from("perfiles_salud").update({ ...macros, actualizado_en: new Date().toISOString() }).eq("usuario_id", usuario.id);
        if (errSalud) throw errSalud;
      }
      await Promise.all([cargarPerfiles(), cargarSalud()]);
      vibrar(20);
      avisar("Objetivos actualizados");
      onListo(leido.kcal);
    } catch (e) {
      setError(e.message || "No se pudo guardar");
      setGuardando(false);
    }
  }

  if (!leido || leido.error) {
    return (
      <>
        <p className="nota">En MyFitnessPal entrá a Más → Objetivos, sacale una captura a «Objetivos de calorías y macronutrientes» y pegala o subila acá.</p>
        {leido?.error && <p className="error" role="alert">{leido.error}</p>}
        <Lector interpretar={leerObjetivos} onLeido={setLeido} ejemplo={EJEMPLO} />
      </>
    );
  }

  return (
    <div className="formulario objetivos-leidos">
      <div className="objetivo-kcal">
        <strong>{leido.kcal.toLocaleString("es-AR")}</strong>
        <span>kcal por día</span>
      </div>
      <ul className="objetivo-macros">
        {NOMBRES.map(([k, texto]) => (
          <li key={k}>
            <span className="macro-nombre"><span className={`punto s-${k}`} /> {texto}</span>
            <strong>{leido.gramos[k]} g</strong>
            <small>{leido.pct[k]}% de las kcal</small>
          </li>
        ))}
      </ul>
      {!salud && <p className="nota">Todavía no armaste tu plan: se guarda la meta de calorías. Armá tu plan para usar también los macros.</p>}
      {fuera && <p className="error" role="alert">{fuera.texto}: el valor no parece correcto. Revisá la captura.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton boton-grande" onClick={usar} disabled={guardando || Boolean(fuera)}>{guardando ? "Guardando…" : "Usar estos objetivos"}</button>
      <button className="boton boton-secundario" onClick={() => setLeido(null)} disabled={guardando}>Leer otra captura</button>
    </div>
  );
}
