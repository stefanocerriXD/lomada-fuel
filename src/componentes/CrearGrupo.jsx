import { useState } from "react";
import { Clock, Plus, X } from "lucide-react";
import { crearGrupo } from "../lib/grupos.js";
import { vibrar } from "./Base.jsx";

// Cualquiera crea un grupo: queda adentro y lo administra (acepta a los que ponen el código).
export default function CrearGrupo({ onCreado }) {
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function crear(e) {
    e.preventDefault();
    if (nombre.trim().length < 2) return setError("Ponele un nombre de al menos 2 letras.");
    setEnviando(true);
    setError("");
    try {
      const grupo = await crearGrupo(nombre);
      vibrar(20);
      setNombre("");
      await onCreado?.(grupo);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <form className="sumarme-grupo crear-grupo" onSubmit={crear}>
        <label>
          <span>Crear un grupo nuevo</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del grupo" maxLength={40} autoComplete="off" />
        </label>
        <button className="boton" type="submit" disabled={enviando || !nombre.trim()}><Plus size={17} /> {enviando ? "Creando…" : "Crear"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="nota crear-grupo-nota">Lo administrás vos: te pasamos un código para compartir y aceptás a cada uno que pida entrar. Viene con la maldición de la caca 💩.</p>
    </>
  );
}

// Los pedidos que mandé y todavía nadie respondió.
export function PedidosEnviados({ pedidos, onCancelar }) {
  if (!pedidos.length) return null;
  return (
    <ul className="lista-grupos pedidos-enviados" aria-label="Pedidos para entrar">
      {pedidos.map((p) => (
        <li key={p.grupo_id} className="grupo-fila esperando">
          <span className="grupo-icono" aria-hidden="true"><Clock size={18} /></span>
          <span className="grupo-nombre">
            {p.nombre}
            <small>Esperando que el admin te acepte</small>
          </span>
          {onCancelar && <button className="boton-chico" onClick={() => onCancelar(p.grupo_id)} aria-label={`Cancelar el pedido a ${p.nombre}`}><X size={15} /> Cancelar</button>}
        </li>
      ))}
    </ul>
  );
}
