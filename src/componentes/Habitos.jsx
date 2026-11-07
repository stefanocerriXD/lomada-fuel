import { useMemo } from "react";
import { motion } from "motion/react";
import { Droplets, Minus, Plus } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { vibrar } from "./Base.jsx";

const VASO_ML = 250;

export default function Habitos({ fecha }) {
  const { extras } = useDatos();
  if (!extras.disponible) return null;
  return (
    <section className="habitos" aria-label="Hábitos del día">
      <Agua fecha={fecha} />
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
