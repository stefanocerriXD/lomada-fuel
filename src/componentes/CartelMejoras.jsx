import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { irAAjustes } from "../lib/navegar.js";
import { vibrar } from "./Base.jsx";

// Una vez por mes, un cartelito en el Resumen: "¿Qué le mejorarías a la app?". Se cierra o lleva a Mejoras.
// Al cerrarlo (o tocarlo) no vuelve hasta el mes que viene.
const CLAVE = "lomada-cartel-mejoras";
const mesActual = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return mesActual(); } };
const guardar = () => { try { localStorage.setItem(CLAVE, mesActual()); } catch { /* sin almacenamiento, vuelve a aparecer */ } };

export default function CartelMejoras() {
  const [visible, setVisible] = useState(() => leer() !== mesActual());
  if (!visible) return null;
  const cerrar = (e) => {
    e?.stopPropagation();
    guardar();
    setVisible(false);
  };
  return (
    <div className="cartel-mejoras">
      <button className="cartel-mejoras-texto" onClick={() => { vibrar(8); cerrar(); irAAjustes("mejoras"); }}>
        <Lightbulb size={17} aria-hidden="true" />
        <span><strong>¿Qué le mejorarías a la app?</strong> Mandá tu pedido en Mejoras.</span>
      </button>
      <button className="cartel-mejoras-cerrar" onClick={cerrar} aria-label="Ocultar el cartel de mejoras"><X size={15} /></button>
    </div>
  );
}
