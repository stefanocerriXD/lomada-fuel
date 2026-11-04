import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { comprimirImagen, blobABase64 } from "./lib/imagen.js";
import Inicio from "./Inicio.jsx";
import Comidas from "./Comidas.jsx";
import Chat from "./Chat.jsx";

const PESTANAS = [
  { id: "inicio", texto: "Resumen" },
  { id: "comidas", texto: "Comidas" },
  { id: "chat", texto: "Chat" },
];

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pestana, setPestana] = useState("inicio");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  // Al primer ingreso se crea el perfil con el nombre que el amigo escribió en el login.
  useEffect(() => {
    if (!sesion) return;
    const u = sesion.user;
    const nombre = u.user_metadata?.nombre || u.email.split("@")[0];
    // Sin .then() supabase-js no envía la consulta.
    supabase
      .from("perfiles")
      .upsert({ id: u.id, nombre }, { onConflict: "id", ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.error("No se pudo crear el perfil:", error.message);
      });
  }, [sesion]);

  if (cargando) return <div className="centro">Cargando…</div>;
  if (!sesion) return <Login />;

  return (
    <div className="app">
      <header className="cabecera">
        <h1>Comidas entre amigos</h1>
        <button className="secundario" onClick={() => supabase.auth.signOut()}>Salir</button>
      </header>
      <nav className="pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={pestana === p.id ? "pestana activa" : "pestana"}
            onClick={() => setPestana(p.id)}
          >
            {p.texto}
          </button>
        ))}
      </nav>
      <main>
        {pestana === "inicio" && <Inicio usuario={sesion.user} />}
        {pestana === "comidas" && <Comidas usuario={sesion.user} />}
        {pestana === "chat" && <Chat usuario={sesion.user} />}
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  async function entrar(e) {
    e.preventDefault();
    setError("");
    // El nombre se guarda en la metadata para crear el perfil al primer ingreso.
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { data: { nombre }, emailRedirectTo: window.location.origin },
    });
    if (err) setError(err.message);
    else setEnviado(true);
  }

  return (
    <div className="login">
      <h1>Comidas entre amigos</h1>
      {enviado ? (
        <p>Listo. Revisá tu mail y tocá el link para entrar.</p>
      ) : (
        <form onSubmit={entrar}>
          <input placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <input type="email" placeholder="Tu mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit">Mandame el link</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  );
}

// Se usa desde Comidas para subir una foto nueva y estimar sus macros.
export async function estimarMacros(archivo) {
  const blob = await comprimirImagen(archivo);
  const imagen = await blobABase64(blob);
  const { data } = await supabase.auth.getSession();
  const resp = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ imagen, tipoImagen: "image/jpeg" }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error || "No se pudo estimar");
  return { estimacion: json, blob };
}
