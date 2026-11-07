import { ArrowLeft } from "lucide-react";

export default function Volver({ titulo, onVolver }) {
  return (
    <header className="volver">
      <button className="boton-icono" onClick={onVolver} aria-label="Volver al grupo"><ArrowLeft size={20} /></button>
      <h1>{titulo}</h1>
    </header>
  );
}
