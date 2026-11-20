import { useEffect, useState } from "react";
import { Clapperboard, ExternalLink, SquarePlay, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { extraerLink, miniaturaDe, nombrePorDefecto, redDeLink, REDES } from "../lib/videosRecetas.js";
import { Hoja, vibrar } from "./Base.jsx";

// Recetas de TikTok, Instagram o YouTube: solo el link con un nombre. Van aparte de las recetas propias
// (no tienen ingredientes ni calorías) y cada una dice de qué red es.
export default function VideosRecetas({ avisar }) {
  const { usuario, perfiles } = useDatos();
  const [lista, setLista] = useState(null);
  const [agregando, setAgregando] = useState(false);
  const [borrando, setBorrando] = useState(null);

  useEffect(() => {
    let activo = true;
    supabase.from("recetas_videos").select("*").order("creado_en", { ascending: false })
      .then(({ data, error }) => activo && setLista(error ? undefined : data || []));
    return () => { activo = false; };
  }, []);

  // Sin el SQL 061 todavía no hay videos.
  if (!lista) return null;
  const visibles = lista.filter((v) => v.usuario_id === usuario.id || perfiles[v.usuario_id]);

  async function borrar(v) {
    if (borrando !== v.id) return setBorrando(v.id);
    const { error } = await supabase.from("recetas_videos").delete().eq("id", v.id);
    setBorrando(null);
    if (error) return avisar("No se pudo borrar el video");
    setLista((prev) => prev.filter((x) => x.id !== v.id));
    avisar("Video borrado");
  }

  return (
    <div className="videos-recetas">
      <h3 className="perfil-subtitulo">Videos de recetas</h3>
      <p className="ajuste-texto">Guardá las recetas que viste en TikTok, Instagram o YouTube. Es solo el link para volver a verlo: no suma calorías.</p>
      <button className="boton boton-secundario" onClick={() => setAgregando(true)}><Clapperboard size={18} /> Agregar video</button>
      {visibles.length > 0 && (
        <ul className="lista-videos">
          {visibles.map((v) => {
            const propio = v.usuario_id === usuario.id;
            const mini = miniaturaDe(v.url);
            const red = REDES[v.red] ? v.red : "otro";
            return (
              <li key={v.id}>
                <a className="video-receta" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={`${v.titulo}, video de ${REDES[red].nombre}. Abrir`}>
                  <span className={`video-miniatura red-${red}`}>
                    {mini ? <img src={mini} alt="" loading="lazy" /> : null}
                    <SquarePlay size={20} aria-hidden="true" />
                  </span>
                  <span className="resultado-datos">
                    <span className={`etiqueta-red red-${red}`}>{REDES[red].nombre}</span>
                    <strong>{v.titulo}</strong>
                    <span>{propio ? "Tuyo" : `De ${perfiles[v.usuario_id]?.nombre || "alguien del grupo"}`}{propio && !v.compartida ? " · solo vos" : ""}</span>
                  </span>
                  <ExternalLink size={17} aria-hidden="true" />
                </a>
                {propio && (
                  <button className={borrando === v.id ? "boton-chico peligro" : "boton-icono"} onClick={() => borrar(v)} onBlur={() => setBorrando(null)} aria-label={borrando === v.id ? "Tocá de nuevo para borrar" : `Borrar el video ${v.titulo}`}>
                    <Trash2 size={16} />{borrando === v.id ? " ¿Borrar?" : ""}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Hoja abierta={agregando} onCerrar={() => setAgregando(false)} titulo="Agregar video de receta">
        {agregando && (
          <NuevoVideo
            usuario={usuario}
            onListo={(v) => { setLista((prev) => [v, ...prev]); setAgregando(false); vibrar(15); avisar("Video guardado"); }}
          />
        )}
      </Hoja>
    </div>
  );
}

function NuevoVideo({ usuario, onListo }) {
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [compartida, setCompartida] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const link = extraerLink(texto);
  const red = link ? redDeLink(link) : null;

  async function guardar(e) {
    e.preventDefault();
    if (!link) return setError("Pegá el link del video.");
    setGuardando(true);
    setError("");
    const fila = { usuario_id: usuario.id, url: link, red, titulo: (titulo.trim() || nombrePorDefecto(red)).slice(0, 80), compartida };
    const { data, error: err } = await supabase.from("recetas_videos").insert(fila).select().single();
    setGuardando(false);
    if (err) return setError("No se pudo guardar el video. Probá de nuevo.");
    onListo(data);
  }

  return (
    <form className="carga nuevo-video" onSubmit={guardar}>
      <label className="campo">
        <span>Link del video</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} inputMode="url" autoFocus
          placeholder="Pegá el link de TikTok, Instagram o YouTube" aria-label="Link del video" />
      </label>
      {texto.trim() && (
        <p className={link ? "nota video-detectado" : "error"} role="status">
          {link ? <><span className={`etiqueta-red red-${red}`}>{REDES[red].nombre}</span> {red === "otro" ? "Se guarda como video." : "Listo, es de " + REDES[red].nombre + "."}</> : "No encontré un link en lo que pegaste."}
        </p>
      )}
      <label className="campo">
        <span>Nombre (opcional)</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder={link ? nombrePorDefecto(red) : "Ej: Budín proteico"} aria-label="Nombre del video" />
      </label>
      <label className="interruptor">
        <input type="checkbox" checked={compartida} onChange={(e) => setCompartida(e.target.checked)} />
        <span>Que lo vea el grupo</span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="boton boton-grande" disabled={guardando || !link}>{guardando ? "Guardando…" : "Guardar video"}</button>
    </form>
  );
}
