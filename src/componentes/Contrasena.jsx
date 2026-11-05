import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { recordarContrasena } from "../lib/acceso.js";

const LARGO_MINIMO = 8;

function explicar(error) {
  if (/different from the old/i.test(error.message)) return "Tiene que ser distinta de la anterior.";
  if (/weak|short|at least/i.test(error.message)) return "Elegí una contraseña más larga o difícil.";
  if (/reauth|recent/i.test(error.message)) return "Por seguridad, cerrá sesión, entrá con el link y volvé a intentar.";
  return "No se pudo guardar. Probá de nuevo.";
}

export function FormularioContrasena({ onListo, textoBoton = "Guardar contraseña" }) {
  const [clave, setClave] = useState("");
  const [repetida, setRepetida] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (clave.length < LARGO_MINIMO) return setError(`Usá al menos ${LARGO_MINIMO} caracteres.`);
    if (clave !== repetida) return setError("Las dos contraseñas no coinciden.");
    setGuardando(true);
    const { error: err } = await supabase.auth.updateUser({ password: clave, data: { tiene_contrasena: true } });
    setGuardando(false);
    if (err) return setError(explicar(err));
    recordarContrasena();
    onListo();
  }

  return (
    <form className="formulario-clave" onSubmit={guardar}>
      <label className="campo">
        <span>Contraseña nueva</span>
        <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" minLength={LARGO_MINIMO} required />
      </label>
      <label className="campo">
        <span>Repetila</span>
        <input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton boton-grande" disabled={guardando}>{guardando ? "Guardando…" : textoBoton}</button>
    </form>
  );
}
