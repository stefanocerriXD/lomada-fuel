import { useState } from "react";
import { Trash2 } from "lucide-react";
import { borrarMiCuenta } from "../lib/cuenta.js";

// Ajustes > Cuenta: borrar la cuenta y todo lo suyo, escribiendo BORRAR para confirmar.
export default function BorrarCuenta({ usuarioId }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState("");
  const confirmado = texto.trim().toUpperCase() === "BORRAR";

  async function borrar(e) {
    e.preventDefault();
    if (!confirmado || borrando) return;
    setBorrando(true);
    setError("");
    try {
      await borrarMiCuenta(usuarioId);
    } catch (err) {
      setError(err.message);
      setBorrando(false);
    }
  }

  return (
    <section className="tarjeta ajuste con-titulo borrar-cuenta">
      <h3 className="perfil-subtitulo">Borrar mi cuenta</h3>
      {!abierto ? (
        <button type="button" className="boton-texto peligro" onClick={() => setAbierto(true)}>
          <Trash2 size={15} /> Borrar mi cuenta y mis datos
        </button>
      ) : (
        <form onSubmit={borrar}>
          <p className="ajuste-texto">
            Se borran para siempre tu cuenta, tus comidas y fotos, tus mensajes del chat, tu peso, tus registros, tus logros y todo lo que cargaste. <strong>No se puede deshacer.</strong> Si creaste un grupo, queda a cargo del integrante más antiguo.
          </p>
          <label>
            <span>Escribí BORRAR para confirmar</span>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" autoCapitalize="characters" disabled={borrando} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="borrar-cuenta-acciones">
            <button type="button" className="boton boton-secundario" onClick={() => { setAbierto(false); setTexto(""); setError(""); }} disabled={borrando}>
              Cancelar
            </button>
            <button className="boton boton-peligro" disabled={!confirmado || borrando}>
              {borrando ? "Borrando…" : "Borrar todo"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
