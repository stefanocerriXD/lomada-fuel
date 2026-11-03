import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";

export default function Chat({ usuario }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const fondo = useRef(null);

  useEffect(() => {
    supabase
      .from("mensajes")
      .select("*, perfiles(nombre)")
      .order("creado_en", { ascending: true })
      .limit(200)
      .then(({ data, error: err }) => (err ? setError(err.message) : setMensajes(data)));

    // Mensajes nuevos en vivo, de cualquier amigo.
    const canal = supabase
      .channel("mensajes-grupo")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, async (payload) => {
        const { data } = await supabase.from("perfiles").select("nombre").eq("id", payload.new.usuario_id).single();
        setMensajes((prev) => [...prev, { ...payload.new, perfiles: data }]);
      })
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, []);

  useEffect(() => {
    fondo.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setTexto("");
    const { error: err } = await supabase.from("mensajes").insert({ usuario_id: usuario.id, texto: limpio });
    if (err) setError(err.message);
  }

  return (
    <section className="chat">
      {error && <p className="error">{error}</p>}
      <div className="mensajes">
        {mensajes.map((m) => (
          <div key={m.id} className={m.usuario_id === usuario.id ? "burbuja propia" : "burbuja"}>
            <small>{m.perfiles?.nombre || "Amigo"}</small>
            <p>{m.texto}</p>
          </div>
        ))}
        <div ref={fondo} />
      </div>
      <form className="enviar" onSubmit={enviar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí algo…" maxLength={1000} />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}
