import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { Indicador } from "../componentes/Base.jsx";
import InstalarApp from "../componentes/InstalarApp.jsx";
import Logo from "../componentes/Logo.jsx";

const USUARIO_VALIDO = /^[a-z0-9_.]{3,20}$/;
const LARGO_CLAVE = 8;

const ERRORES_REGISTRO = {
  usuario_invalido: "El usuario lleva de 3 a 20 letras, números, punto o guion bajo.",
  usuario_ocupado: "Ese usuario ya existe. Probá con otro.",
};

export default function Login() {
  const [modo, setModo] = useState("entrar");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // La cuenta espera que confirme el mail: el link llega a esta dirección.
  const [porConfirmar, setPorConfirmar] = useState(null);
  const [reenvio, setReenvio] = useState("");

  function cambiarModo(nuevo) {
    setModo(nuevo);
    setError("");
    setEnviado(false);
  }

  async function correr(e, tarea) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await tarea();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const entrar = (e) =>
    correr(e, async () => {
      const { data: mail, error: err } = await supabase.rpc("mail_de_ingreso", { p_usuario: usuario, p_clave: clave });
      if (/demasiados_intentos/.test(err?.message)) throw new Error("Demasiados intentos. Esperá 10 minutos.");
      if (err) throw new Error("No pudimos conectarnos. Probá de nuevo.");
      if (!mail) throw new Error("Usuario o contraseña incorrectos.");
      const { error: errSesion } = await supabase.auth.signInWithPassword({ email: mail, password: clave });
      if (errSesion?.code === "email_not_confirmed" || /not confirmed/i.test(errSesion?.message)) return setPorConfirmar(mail);
      if (errSesion) throw new Error("No pudimos iniciar la sesión. Probá de nuevo.");
    });

  const crearCuenta = (e) =>
    correr(e, async () => {
      const nombre = usuario.trim();
      if (!USUARIO_VALIDO.test(nombre.toLowerCase())) throw new Error(ERRORES_REGISTRO.usuario_invalido);
      if (clave.length < LARGO_CLAVE) throw new Error(`La contraseña lleva al menos ${LARGO_CLAVE} caracteres.`);

      const { data: estado, error: errEstado } = await supabase.rpc("revisar_registro", { p_usuario: nombre, p_codigo: "" });
      if (errEstado) throw new Error("No pudimos conectarnos. Probá de nuevo.");
      if (estado !== "ok") throw new Error(ERRORES_REGISTRO[estado]);

      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password: clave,
        options: { data: { usuario: nombre.toLowerCase(), nombre }, emailRedirectTo: window.location.origin },
      });
      if (/already|registered/i.test(err?.message)) throw new Error("Ese mail ya tiene una cuenta.");
      if (err) throw new Error("No pudimos crear la cuenta. Revisá los datos.");
      // Hay que confirmar el mail: se muestra el aviso y, al tocar el link, entra solo.
      if (!data.session) setPorConfirmar(email.trim());
    });

  const recuperar = (e) =>
    correr(e, async () => {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (/rate limit/i.test(err?.message)) throw new Error("Se mandaron demasiados mails. Probá más tarde.");
      if (err) throw new Error("No pudimos mandar el mail. Probá de nuevo.");
      setEnviado(true);
    });

  async function reenviar() {
    setReenvio("enviando");
    const { error: err } = await supabase.auth.resend({ type: "signup", email: porConfirmar, options: { emailRedirectTo: window.location.origin } });
    setReenvio(err ? (/rate|seconds|limit/i.test(err.message) ? "espera" : "error") : "listo");
  }

  return (
    <div className="login">
      <InstalarApp />
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
        <Logo className="login-icono" tam={64} />
        <h1>Lomada Fuel</h1>
        <p className="login-bajada">Subí tus comidas para bajar de peso, gordito.</p>

        {porConfirmar ? (
          <motion.div className="login-enviado" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
            <MailCheck size={32} />
            <strong>Confirmá tu mail</strong>
            <p>Te mandamos un link a <b>{porConfirmar}</b>. Tocalo para activar la cuenta y entrás solo. Si no lo ves, fijate en spam.</p>
            <button className="boton boton-secundario" type="button" onClick={reenviar} disabled={reenvio === "enviando" || reenvio === "listo"}>
              {reenvio === "enviando" ? "Enviando…" : reenvio === "listo" ? "Listo, te lo mandamos de nuevo" : "Reenviar el mail"}
            </button>
            {reenvio === "espera" && <p className="error" role="alert">Esperá un minuto antes de pedirlo de nuevo.</p>}
            {reenvio === "error" && <p className="error" role="alert">No se pudo reenviar. Probá en un rato.</p>}
            <button className="boton-texto" type="button" onClick={() => { setPorConfirmar(null); setReenvio(""); cambiarModo("entrar"); }}>Ya lo confirmé: entrar</button>
          </motion.div>
        ) : modo === "recuperar" ? (
          enviado ? (
            <motion.div className="login-enviado" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
              <MailCheck size={32} />
              <strong>Revisá tu mail</strong>
              <p>Si {email} tiene una cuenta, te llega un link para crear otra contraseña.</p>
              <button className="boton-texto" onClick={() => cambiarModo("entrar")}>Volver</button>
            </motion.div>
          ) : (
            <form onSubmit={recuperar}>
              <label>
                <span>Tu mail de recuperación</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
              {error && <p className="error" role="alert">{error}</p>}
              <button className="boton boton-grande" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Mandame el link"}</button>
              <button className="boton-texto centrado" type="button" onClick={() => cambiarModo("entrar")}>Volver</button>
            </form>
          )
        ) : (
          <>
            <div className="selector" role="tablist" aria-label="Acceso">
              {[["entrar", "Entrar"], ["crear", "Crear cuenta"]].map(([id, texto]) => (
                <button key={id} type="button" role="tab" aria-selected={modo === id} className={modo === id ? "activo" : ""} onClick={() => cambiarModo(id)}>
                  <span>{texto}</span>
                </button>
              ))}
              <Indicador indice={[["entrar", "Entrar"], ["crear", "Crear cuenta"]].findIndex(([id]) => id === modo)} total={2} />
            </div>

            <form onSubmit={modo === "entrar" ? entrar : crearCuenta}>
              <label>
                <span>Usuario</span>
                <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" maxLength={20} required />
              </label>
              <label>
                <span>Contraseña</span>
                <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete={modo === "entrar" ? "current-password" : "new-password"} required />
              </label>
              {modo === "crear" && (
                <>
                  <label>
                    <span>Mail de recuperación</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                  </label>
                </>
              )}
              {error && <p className="error" role="alert">{error}</p>}
              <button className="boton boton-grande" type="submit" disabled={enviando}>
                {enviando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"} <ArrowRight size={19} />
              </button>
              {modo === "entrar" && (
                <button className="boton-texto centrado" type="button" onClick={() => cambiarModo("recuperar")}>Olvidé mi contraseña</button>
              )}
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
