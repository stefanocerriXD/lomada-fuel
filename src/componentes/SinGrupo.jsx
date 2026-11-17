import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "../lib/supabase.js";
import { cancelarPedido, misPedidos, pedirEntrar } from "../lib/grupos.js";
import CrearGrupo, { PedidosEnviados } from "./CrearGrupo.jsx";
import Logo from "./Logo.jsx";

// Quien no está en ningún grupo: pide entrar a uno con el código (el admin lo acepta) o crea el suyo.
// Mientras espera, se revisa solo cada tanto: cuando lo aceptan, entra.
export default function SinGrupo({ onAdentro }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const habia = useRef(0);

  const revisar = useCallback(async () => {
    const lista = await misPedidos();
    setPedidos(lista);
    // Un pedido que desaparece es que lo respondieron: si lo aceptaron, ya hay grupo.
    if (lista.length < habia.current) onAdentro();
    habia.current = lista.length;
  }, [onAdentro]);

  useEffect(() => {
    revisar();
    const reloj = setInterval(revisar, 15000);
    const alVolver = () => document.visibilityState === "visible" && revisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [revisar]);

  async function entrar(e) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setEnviando(true);
    setError("");
    setAviso("");
    try {
      const r = await pedirEntrar(codigo);
      if (r.estado !== "pendiente") return onAdentro();
      setCodigo("");
      setAviso(`Listo: le pedimos al admin de ${r.nombre} que te acepte. Cuando te acepte, entrás solo.`);
      await revisar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id) {
    if (await cancelarPedido(id)) {
      habia.current = Math.max(0, habia.current - 1);
      await revisar();
    }
  }

  return (
    <div className="login sin-grupo">
      <motion.div className="login-tarjeta" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <Logo className="login-icono" tam={64} />
        <h1>{pedidos.length ? "Esperando que te acepten" : "Entrá a un grupo"}</h1>
        <p className="login-bajada">{pedidos.length ? "Cuando el admin del grupo te acepte, entrás solo. Mientras, podés crear el tuyo." : "Poné el código que te pasaron o creá tu propio grupo."}</p>

        <PedidosEnviados pedidos={pedidos} onCancelar={cancelar} />

        <form onSubmit={entrar}>
          <label>
            <span>Código del grupo</span>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          {aviso && <p className="nota sin-grupo-aviso" role="status">{aviso}</p>}
          <button className="boton boton-grande" type="submit" disabled={enviando || !codigo.trim()}>{enviando ? "Pidiendo…" : "Pedir entrar"}</button>
        </form>

        <div className="sin-grupo-o" aria-hidden="true"><span>o</span></div>
        <CrearGrupo onCreado={onAdentro} />

        <button className="boton-texto centrado" type="button" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </motion.div>
    </div>
  );
}
