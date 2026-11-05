import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { calcularPlan, nivelActividad, RITMOS } from "../lib/cuerpo.js";
import { Hoja, vibrar } from "../componentes/Base.jsx";

const PASOS = ["Sobre vos", "Tus medidas", "Tu actividad", "Tu objetivo", "Tu plan"];
const VACIO = { sexo: "", anio_nacimiento: "", altura_cm: "", peso_kg: "", dias_actividad: 3, peso_objetivo: "", ritmo: 0.5 };

const anioActual = new Date().getFullYear();
const entre = (v, min, max) => Number(v) >= min && Number(v) <= max;

export default function Bienvenida({ abierta, onCerrar, onGuardar }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Personalizá tu plan" ancha>
      {abierta && <Asistente onGuardar={onGuardar} />}
    </Hoja>
  );
}

function Asistente({ onGuardar }) {
  const { usuario, salud, yo, cargarSalud, cargarPerfiles } = useDatos();
  const [d, setD] = useState(() => (salud ? { ...VACIO, ...salud } : VACIO));
  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const [usarMeta, setUsarMeta] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (campo) => (e) => setD({ ...d, [campo]: e.target.value });
  const plan = useMemo(() => (paso === 4 ? calcularPlan(d) : null), [paso, d]);

  const valido = [
    d.sexo && entre(d.anio_nacimiento, 1930, Math.min(2015, anioActual)),
    entre(d.altura_cm, 120, 230) && entre(d.peso_kg, 30, 300),
    true,
    entre(d.peso_objetivo, 30, 300),
    true,
  ][paso];

  function mover(delta) {
    setDireccion(delta);
    setPaso(paso + delta);
    setError("");
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    const { actualizado_en, ...fila } = d;
    const datos = {
      ...fila,
      usuario_id: usuario.id,
      anio_nacimiento: Number(d.anio_nacimiento),
      altura_cm: Number(d.altura_cm),
      peso_kg: Number(d.peso_kg),
      dias_actividad: Number(d.dias_actividad),
      peso_objetivo: Number(d.peso_objetivo),
      ritmo: Number(d.ritmo),
      actualizado_en: new Date().toISOString(),
    };
    try {
      const { error: errSalud } = await supabase.from("perfiles_salud").upsert(datos, { onConflict: "usuario_id" });
      if (errSalud) throw errSalud;
      const { error: errPeso } = await supabase.from("pesos").upsert({ usuario_id: usuario.id, fecha: fechaLocal(), peso_kg: datos.peso_kg }, { onConflict: "usuario_id,fecha" });
      if (errPeso) throw errPeso;
      if (usarMeta && plan.calorias !== yo.meta_calorias) {
        const { error: errMeta } = await supabase.from("perfiles").update({ meta_calorias: plan.calorias }).eq("id", usuario.id);
        if (errMeta) throw errMeta;
      }
      await Promise.all([cargarSalud(), cargarPerfiles()]);
      vibrar(20);
      onGuardar();
    } catch (err) {
      setError(err.message || "No se pudo guardar");
      setGuardando(false);
    }
  }

  return (
    <div className="asistente">
      <div className="pasos" role="progressbar" aria-valuemin="1" aria-valuemax={PASOS.length} aria-valuenow={paso + 1} aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
        {PASOS.map((p, i) => (
          <span key={p} className={i <= paso ? "lleno" : ""} />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direccion}>
        <motion.div
          key={paso}
          className="paso"
          custom={direccion}
          initial={{ opacity: 0, x: 24 * direccion }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * direccion }}
          transition={{ duration: 0.16 }}
        >
          <h3>{PASOS[paso]}</h3>

          {paso === 0 && (
            <>
              <div className="campo">
                <span id="etiqueta-sexo">Sexo, para el cálculo del metabolismo</span>
                <div className="opciones-dobles" role="radiogroup" aria-labelledby="etiqueta-sexo">
                  {[["masculino", "Masculino"], ["femenino", "Femenino"]].map(([valor, texto]) => (
                    <button key={valor} role="radio" aria-checked={d.sexo === valor} className={d.sexo === valor ? "activo" : ""} onClick={() => setD({ ...d, sexo: valor })}>
                      {texto}
                    </button>
                  ))}
                </div>
              </div>
              <label className="campo">
                <span>Año de nacimiento</span>
                <input type="number" inputMode="numeric" min="1930" max="2015" value={d.anio_nacimiento} onChange={cambiar("anio_nacimiento")} placeholder="1998" />
              </label>
            </>
          )}

          {paso === 1 && (
            <div className="campos-dobles">
              <label className="campo">
                <span>Altura (cm)</span>
                <input type="number" inputMode="decimal" value={d.altura_cm} onChange={cambiar("altura_cm")} placeholder="178" />
              </label>
              <label className="campo">
                <span>Peso (kg)</span>
                <input type="number" inputMode="decimal" value={d.peso_kg} onChange={cambiar("peso_kg")} placeholder="80" />
              </label>
            </div>
          )}

          {paso === 2 && (
            <div className="campo">
              <span id="etiqueta-dias">¿Cuántos días por semana entrenás o hacés actividad?</span>
              <div className="opciones-dias" role="radiogroup" aria-labelledby="etiqueta-dias">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} role="radio" aria-checked={Number(d.dias_actividad) === n} className={Number(d.dias_actividad) === n ? "activo" : ""} onClick={() => setD({ ...d, dias_actividad: n })}>
                    {n}
                  </button>
                ))}
              </div>
              <p className="nota">{nivelActividad(Number(d.dias_actividad)).texto}</p>
            </div>
          )}

          {paso === 3 && (
            <>
              <label className="campo">
                <span>Peso objetivo (kg)</span>
                <input type="number" inputMode="decimal" value={d.peso_objetivo} onChange={cambiar("peso_objetivo")} placeholder={String(d.peso_kg)} />
              </label>
              <div className="campo">
                <span id="etiqueta-ritmo">Ritmo</span>
                <div className="opciones-ritmo" role="radiogroup" aria-labelledby="etiqueta-ritmo">
                  {RITMOS.map((r) => (
                    <button key={r.valor} role="radio" aria-checked={Number(d.ritmo) === r.valor} className={Number(d.ritmo) === r.valor ? "activo" : ""} onClick={() => setD({ ...d, ritmo: r.valor })}>
                      <strong>{r.texto}</strong>
                      <small>{String(r.valor).replace(".", ",")} kg por semana</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {paso === 4 && plan && (
            <>
              <div className="plan-principal">
                <span>Tu meta diaria</span>
                <strong>{plan.calorias.toLocaleString("es-AR")} kcal</strong>
                {plan.semanas > 0 && (
                  <small>
                    Llegarías a {Number(d.peso_objetivo).toLocaleString("es-AR")} kg cerca de {plan.llegada}, a {String(plan.ritmoReal).replace(".", ",")} kg por semana
                  </small>
                )}
              </div>
              <ul className="plan-datos">
                <li><span>Quemás por día</span><strong>{plan.gasto.toLocaleString("es-AR")} kcal</strong></li>
                <li><span>En reposo</span><strong>{plan.basal.toLocaleString("es-AR")} kcal</strong></li>
                <li><span>Proteínas</span><strong>{plan.proteinas} g</strong></li>
                <li><span>Carbos</span><strong>{plan.carbohidratos} g</strong></li>
                <li><span>Grasas</span><strong>{plan.grasas} g</strong></li>
              </ul>
              <label className="interruptor">
                <input type="checkbox" checked={usarMeta} onChange={(e) => setUsarMeta(e.target.checked)} />
                <span>Usar {plan.calorias.toLocaleString("es-AR")} kcal como mi meta</span>
              </label>
              <p className="nota">Es una estimación y puede variar según cada persona. Estos datos son privados: solo los ves vos.</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="asistente-botones">
        {paso > 0 && (
          <button className="boton boton-secundario" onClick={() => mover(-1)} aria-label="Volver"><ArrowLeft size={18} /></button>
        )}
        {paso < 4 ? (
          <button className="boton boton-grande" onClick={() => mover(1)} disabled={!valido}>Seguir <ArrowRight size={18} /></button>
        ) : (
          <button className="boton boton-grande" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar mi plan"}</button>
        )}
      </div>
    </div>
  );
}
