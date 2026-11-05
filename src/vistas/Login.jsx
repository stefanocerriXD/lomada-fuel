import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { recordarContrasena, usaContrasena } from "../lib/acceso.js";

export default function Login() {
  const [modo, setModo] = useState(usaContrasena() ? "contrasena" : "link");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  function cambiarModo(nuevo) {
    setModo(nuevo);
    setError("");
  }

  async function entrarConLink(e) {
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

  async function entrarConContrasena(e) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: clave });
    setEnviando(false);
    if (err) setError("Mail o contraseña incorrectos. Si todavía no creaste una, entrá con el link.");
    else recordarContrasena();
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
        <p className="login-bajada">Subí tus comidas para bajar de peso, gordito.</p>

        {enviado ? (
          <motion.div className="login-enviado" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
            <MailCheck size={32} />
            <strong>Revisá tu mail</strong>
            <p>Te mandamos un link a {email}. Abrilo en este mismo dispositivo.</p>
            <button className="boton-texto" onClick={() => setEnviado(false)}>Usar otro mail</button>
          </motion.div>
        ) : (
          <>
            <div className="selector" role="tablist" aria-label="Cómo entrar">
              {[["link", "Link al mail"], ["contrasena", "Contraseña"]].map(([id, texto]) => (
                <button key={id} type="button" role="tab" aria-selected={modo === id} className={modo === id ? "activo" : ""} onClick={() => cambiarModo(id)}>
                  {modo === id && <motion.span className="selector-fondo" layoutId="selector-login" />}
                  <span>{texto}</span>
                </button>
              ))}
            </div>

            {modo === "link" ? (
              <form onSubmit={entrarConLink}>
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
            ) : (
              <form onSubmit={entrarConContrasena}>
                <label>
                  <span>Tu mail</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                </label>
                <label>
                  <span>Tu contraseña</span>
                  <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
                </label>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="boton boton-grande" type="submit" disabled={enviando}>
                  {enviando ? "Entrando…" : "Entrar"} <ArrowRight size={19} />
                </button>
                <p className="login-ayuda">¿Te la olvidaste? Entrá con el link y cambiala en Ajustes.</p>
              </form>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
