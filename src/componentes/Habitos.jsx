import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Droplets, Minus, Plus, Timer } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { vibrar } from "./Base.jsx";

const VASO_ML = 250;
const OPCIONES_AYUNO = [14, 16, 18];

export default function Habitos({ fecha }) {
  const { extras } = useDatos();
  if (!extras.disponible) return null;
  return (
    <section className="habitos" aria-label="Hábitos del día">
      <Agua fecha={fecha} />
      <Ayuno />
    </section>
  );
}

function Agua({ fecha }) {
  const { usuario, extras, salud, cambiarAgua } = useDatos();
  const ml = extras.agua.find((a) => a.usuario_id === usuario.id && a.fecha === fecha)?.ml || 0;
  const meta = useMemo(() => {
    const porPeso = salud ? Math.round((Number(salud.peso_kg) * 35) / 250) * 250 : 2500;
    return Math.min(Math.max(porPeso, 1500), 4000);
  }, [salud]);
  const avance = Math.min(ml / meta, 1);

  return (
    <article className="tarjeta habito">
      <div className="habito-titulo"><Droplets size={16} /> Agua</div>
      <div className="vaso" aria-hidden="true">
        <motion.i initial={false} animate={{ height: `${avance * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }} />
      </div>
      <p className="habito-valor"><strong>{(ml / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</strong> de {(meta / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} L</p>
      <div className="habito-botones">
        <button className="boton-icono" onClick={() => cambiarAgua(fecha, ml - VASO_ML)} disabled={ml === 0} aria-label="Restar un vaso"><Minus size={18} /></button>
        <button className="boton-icono acento" onClick={() => { cambiarAgua(fecha, ml + VASO_ML); vibrar(8); }} aria-label="Sumar un vaso de 250 mililitros"><Plus size={18} /></button>
      </div>
    </article>
  );
}

function Ayuno() {
  const { usuario, extras, cargarExtras } = useDatos();
  const [ahora, setAhora] = useState(Date.now());
  const [horas, setHoras] = useState(16);
  const [ocupado, setOcupado] = useState(false);
  const enCurso = extras.ayuno && !extras.ayuno.fin ? extras.ayuno : null;

  useEffect(() => {
    if (!enCurso) return;
    setAhora(Date.now());
    const reloj = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(reloj);
  }, [enCurso]);

  async function cambiar(tarea) {
    setOcupado(true);
    await tarea;
    await cargarExtras();
    setOcupado(false);
    vibrar(15);
  }

  const empezar = () => cambiar(supabase.from("ayunos").insert({ usuario_id: usuario.id, meta_horas: horas }));
  const terminar = () => cambiar(supabase.from("ayunos").update({ fin: new Date().toISOString() }).eq("id", enCurso.id));

  if (!enCurso) {
    return (
      <article className="tarjeta habito">
        <div className="habito-titulo"><Timer size={16} /> Ayuno</div>
        <div className="ayuno-opciones" role="radiogroup" aria-label="Duración del ayuno">
          {OPCIONES_AYUNO.map((h) => (
            <button key={h} role="radio" aria-checked={horas === h} className={horas === h ? "activo" : ""} onClick={() => setHoras(h)}>{h} h</button>
          ))}
        </div>
        <button className="boton boton-secundario" onClick={empezar} disabled={ocupado}>Empezar</button>
      </article>
    );
  }

  const minutos = Math.max(0, Math.floor((ahora - new Date(enCurso.inicio).getTime()) / 60000));
  const avance = Math.min(minutos / (enCurso.meta_horas * 60), 1);
  const hechas = Math.floor(minutos / 60);

  return (
    <article className="tarjeta habito">
      <div className="habito-titulo"><Timer size={16} /> Ayuno</div>
      <p className="ayuno-tiempo">{hechas} h {String(minutos % 60).padStart(2, "0")} min</p>
      <span className="pista-progreso"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.7 }} /></span>
      <p className="habito-valor">{avance >= 1 ? "¡Meta cumplida!" : `Meta: ${enCurso.meta_horas} h`}</p>
      <button className="boton boton-secundario" onClick={terminar} disabled={ocupado}>Terminar</button>
    </article>
  );
}
