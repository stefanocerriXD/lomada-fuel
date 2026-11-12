import { useState } from "react";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase.js";

// Quien quedó afuera de su grupo no ve nada. Si le pasaron un código, entra a ese grupo.
export default function SinGrupo({ onAdentro }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setEnviando(true);
    setError("");
    const { error: err } = await supabase.rpc("unirme_a_grupo", { p_codigo: codigo.trim() });
    setEnviando(false);
    if (err) return setError(/codigo_invalido/.test(err.message) ? "Ese código no es de ningún grupo." : "No se pudo entrar. Probá de nuevo.");
    onAdentro();
  }

  return (
    <div className="login sin-grupo">
      <motion.div className="login-tarjeta" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <img className="login-icono" src="/icono.svg" alt="" width="52" height="52" />
        <h1>No estás en ningún grupo</h1>
        <p className="login-bajada">Si te pasaron el código de un grupo, escribilo para entrar.</p>
        <form onSubmit={entrar}>
          <label>
            <span>Código del grupo</span>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="boton boton-grande" type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar al grupo"}</button>
          <button className="boton-texto centrado" type="button" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </form>
      </motion.div>
    </div>
  );
}
