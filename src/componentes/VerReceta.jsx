import { useEffect, useState } from "react";
import { BookmarkPlus, ChefHat, MessageCircle, Pencil } from "lucide-react";
import EditorReceta from "./EditorReceta.jsx";
import { CarruselFotos } from "./TarjetaComida.jsx";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { macrosDeItem } from "../lib/macros.js";
import { compartirEnChat, pesoDeReceta, totalesDeReceta } from "../lib/recetasPropias.js";
import { Avatar, Hoja, vibrar } from "./Base.jsx";

const redondo = (n) => Math.round(n).toLocaleString("es-AR");
const medidaDe = (i) => i.medida || (i.gramos ? `${redondo(i.gramos)} g` : "");

// Una receta en la que se busca, se lee o se encuentra en el chat. Las de otros se pueden guardar como propias.
export default function VerReceta({ receta, onCerrar, avisar }) {
  // Editar abre el editor y cierra esta hoja (el editor vive acá afuera para no cerrarse con ella).
  const [editando, setEditando] = useState(null);
  return (
    <>
      <Hoja abierta={!!receta} onCerrar={onCerrar} titulo="Receta" ancha>
        {receta && <Detalle key={receta.id} receta={receta} onCerrar={onCerrar} avisar={avisar} onEditar={() => { setEditando(receta); onCerrar(); }} />}
      </Hoja>
      <EditorReceta receta={editando} onCerrar={() => setEditando(null)} avisar={avisar} />
    </>
  );
}

// Busca una receta por id: entre las cargadas o, si no está (la compartieron recién), en la base.
export function useReceta(id) {
  const { extras } = useDatos();
  const cargada = [...(extras.recetas || []), ...(extras.recetasGrupo || [])].find((r) => r.id === id);
  const [traida, setTraida] = useState(undefined);
  useEffect(() => {
    if (cargada || !id) return;
    let activo = true;
    supabase.from("recetas_propias").select("*").eq("id", id).maybeSingle().then(({ data }) => activo && setTraida(data || null), () => activo && setTraida(null));
    return () => { activo = false; };
  }, [cargada, id]);
  return cargada || traida;
}

function Detalle({ receta, onCerrar, avisar, onEditar }) {
  const { usuario, perfiles, extras, cargarExtras, mandarRecetaAlChat, fotos } = useDatos();
  const fotosReceta = (receta.fotos || []).map((r) => fotos[r]);
  const [ampliada, setAmpliada] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const propia = receta.usuario_id === usuario.id;
  const autor = perfiles[receta.usuario_id];
  const porciones = Math.max(1, Number(receta.porciones) || 1);
  const total = totalesDeReceta(receta.ingredientes || []);
  const peso = pesoDeReceta(receta);
  const yaLaTengo = !propia && (extras.recetas || []).some((r) => r.nombre.trim().toLowerCase() === receta.nombre.trim().toLowerCase());

  async function guardarCopia() {
    setOcupado("guardar");
    const { error } = await supabase.from("recetas_propias").insert({
      usuario_id: usuario.id,
      nombre: receta.nombre,
      ingredientes: receta.ingredientes,
      porciones: receta.porciones,
      peso_final: receta.peso_final,
    });
    setOcupado("");
    if (error) return avisar("No se pudo guardar la receta");
    await cargarExtras();
    vibrar(20);
    avisar("Guardada en tus recetas. Buscala al cargar una comida.");
    onCerrar();
  }

  async function compartir() {
    setOcupado("compartir");
    try {
      await compartirEnChat({ supabase, receta, usuarioId: usuario.id, mandarRecetaAlChat });
      if (propia && receta.compartida === false) await cargarExtras();
      vibrar(10);
      onCerrar();
    } catch {
      avisar("No se pudo compartir");
    } finally {
      setOcupado("");
    }
  }

  return (
    <div className="carga ver-receta">
      {fotosReceta.length > 1 ? (
        <CarruselFotos srcs={fotosReceta} alt={receta.nombre} onZoom={(n) => fotosReceta[n] && setAmpliada(fotosReceta[n])} />
      ) : fotosReceta.length === 1 && fotosReceta[0] ? (
        <button type="button" className="comida-foto ver-receta-foto" onClick={() => setAmpliada(fotosReceta[0])} aria-label={`Ampliar la foto de ${receta.nombre}`}>
          <img src={fotosReceta[0]} alt={receta.nombre} />
        </button>
      ) : null}
      {ampliada && (
        <div className="receta-foto-grande" role="dialog" aria-label={`Foto de ${receta.nombre}`} onClick={() => setAmpliada(null)}>
          <img src={ampliada} alt={receta.nombre} />
        </div>
      )}
      <header className="ver-receta-cabecera">
        <span className="ver-receta-icono"><ChefHat size={22} aria-hidden="true" /></span>
        <div>
          <h3>{receta.nombre}</h3>
          <p>
            {propia ? "Tu receta" : <><Avatar perfil={autor} tam={18} /> Receta de {autor?.nombre || "alguien del grupo"}</>}
          </p>
        </div>
      </header>
      <ul className="receta-macros">
        <li><strong>{redondo(total.kcal / porciones)}</strong> kcal</li>
        <li><span className="punto s-p" /><strong>{redondo(total.p / porciones)} g</strong> prote</li>
        <li><span className="punto s-c" /><strong>{redondo(total.c / porciones)} g</strong> carbos</li>
        <li><span className="punto s-g" /><strong>{redondo(total.g / porciones)} g</strong> grasas</li>
      </ul>
      <p className="nota">
        {porciones > 1 ? `Por porción · rinde ${porciones} porciones de ${redondo(peso / porciones)} g` : `La receta entera · ${redondo(peso)} g`}
      </p>
      <h3 className="titulo-lista">Ingredientes</h3>
      <ul className="ingredientes-receta">
        {(receta.ingredientes || []).map((i, n) => (
          <li key={n}>
            <span>{i.nombre}</span>
            <small>{[medidaDe(i), `${redondo(macrosDeItem(i).kcal)} kcal`].filter(Boolean).join(" · ")}</small>
          </li>
        ))}
      </ul>
      <div className="ver-receta-botones">
        {propia && (
          <button className="boton boton-secundario" onClick={onEditar}>
            <Pencil size={18} /> Editar receta
          </button>
        )}
        {!propia && (
          <button className="boton" onClick={guardarCopia} disabled={Boolean(ocupado) || yaLaTengo}>
            <BookmarkPlus size={18} /> {yaLaTengo ? "Ya la tenés" : ocupado === "guardar" ? "Guardando…" : "Guardar en mis recetas"}
          </button>
        )}
        <button className={propia ? "boton" : "boton boton-secundario"} onClick={compartir} disabled={Boolean(ocupado)}>
          <MessageCircle size={18} /> {ocupado === "compartir" ? "Compartiendo…" : "Compartir en el chat"}
        </button>
      </div>
      {!propia && <p className="nota">También la encontrás buscando su nombre al cargar una comida.</p>}
    </div>
  );
}
