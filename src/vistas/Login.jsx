import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function entrar(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    // El nombre se guarda en la metadata para crear el perfil al primer ingreso.
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { data: { nombre }, emailRedirectTo: window.location.origin },
    });
    setEnviando(false);
    if (err) setError(/database error/i.test(err.message) ? "Ese mail todavía no está invitado. Pedile acceso a quien te pasó el link." : err.message);
    else setEnviado(true);
  }

  return (
    <div className="login">
      <div className="login-foto" aria-hidden="true">
        <motion.img
          src="/login-foto.webp"
          alt=""
          width="1086"
          height="1448"
          fetchPriority="high"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <motion.div className="login-tarjeta" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <img className="login-icono" src="/icono.svg" alt="" width="52" height="52" />
        <h1>Lomada Fuel</h1>
        <p className="login-bajada">Subí lo que comés, mirá lo de los demás y bardeá en el chat.</p>

        {enviado ? (
          <motion.div className="login-enviado" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
            <MailCheck size={32} />
            <strong>Revisá tu mail</strong>
            <p>Te mandamos un link a {email}. Abrilo en este mismo dispositivo.</p>
            <button className="boton-texto" onClick={() => setEnviado(false)}>Usar otro mail</button>
          </motion.div>
        ) : (
          <form onSubmit={entrar}>
            <label>
              <span>Tu nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" required />
            </label>
            <label>
              <span>Tu mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="boton boton-grande" type="submit" disabled={enviando}>
              {enviando ? "Enviando…" : "Mandame el link"} <ArrowRight size={19} />
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
