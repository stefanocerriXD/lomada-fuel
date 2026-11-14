import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PartyPopper } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo } from "../lib/api.js";
import { abrirFestejo, EVENTO_FESTEJO } from "../lib/fiestaEstado.js";
import { EVENTO_IR } from "../lib/navegar.js";
import { Avatar, Hoja, vibrar } from "./Base.jsx";

// Las marcas al lado del nombre: 🍸 en modo fiesta; al otro día ⚽ si hubo gol y 🥴 de resaca.
export function textoMarcaFiesta(fiesta) {
  if (!fiesta) return "";
  if (fiesta.modo === "fiesta") return "🍸";
  return fiesta.gol ? "⚽🥴" : "🥴";
}

export function MarcaFiesta({ perfil }) {
  const texto = textoMarcaFiesta(perfil?.fiesta);
  if (!texto) return null;
  const tocar = (e) => {
    // Está dentro del botón del nombre: tocar la marca no abre el perfil.
    e.stopPropagation();
    e.preventDefault();
    abrirFestejo(perfil.id);
  };
  return (
    <span
      className="marca-fiesta"
      role="button"
      tabIndex={0}
      aria-label={perfil.fiesta.modo === "fiesta" ? `${perfil.nombre} está en modo fiesta` : perfil.fiesta.gol ? `${perfil.nombre} hizo gol anoche` : `${perfil.nombre} tiene resaca`}
      onClick={tocar}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && tocar(e)}
    >
      {" "}{texto}
    </span>
  );
}

const yaFelicitado = (id) => {
  try {
    return localStorage.getItem(`lomada-felicitado-${id}`) === "1";
  } catch {
    return false;
  }
};

// El cartel de la fiesta de alguien: qué pasó y, si hizo gol, felicitarlo por el chat del grupo.
export default function HojaFestejo() {
  const { usuario, perfiles, agregarMensaje } = useDatos();
  const [perfilId, setPerfilId] = useState(null);
  const [mandando, setMandando] = useState(false);
  const [felicitado, setFelicitado] = useState(false);
  useEffect(() => {
    const abrir = (e) => setPerfilId(e.detail.perfilId);
    window.addEventListener(EVENTO_FESTEJO, abrir);
    return () => window.removeEventListener(EVENTO_FESTEJO, abrir);
  }, []);

  const perfil = perfilId ? perfiles[perfilId] : null;
  const fiesta = perfil?.fiesta;
  useEffect(() => setFelicitado(fiesta ? yaFelicitado(fiesta.comidaId) : false), [fiesta]);
  const propio = perfilId === usuario.id;
  const vasos = fiesta ? `${fiesta.vasos} ${fiesta.vasos === 1 ? "vaso" : "vasos"}` : "";

  async function felicitar() {
    if (mandando) return;
    setMandando(true);
    const id = crypto.randomUUID();
    const fila = { id, usuario_id: usuario.id, texto: `👑⚽ ¡Golazo, @${perfil.nombre}! Felicitaciones por el gol de anoche 🎉` };
    agregarMensaje({ ...fila, creado_en: new Date().toISOString(), pendiente: true });
    const { data, error } = await supabase.from("mensajes").insert(fila).select().single();
    setMandando(false);
    if (error) return;
    agregarMensaje(data);
    avisarGrupo("mensaje", id);
    try {
      localStorage.setItem(`lomada-felicitado-${fiesta.comidaId}`, "1");
    } catch {
      // Sin almacenamiento, el botón vuelve a aparecer.
    }
    setFelicitado(true);
    vibrar([20, 40, 20]);
    setPerfilId(null);
    window.dispatchEvent(new CustomEvent(EVENTO_IR, { detail: { vista: "grupo", seccion: "chat" } }));
  }

  return createPortal(
    <Hoja abierta={Boolean(fiesta)} onCerrar={() => setPerfilId(null)} titulo={fiesta?.modo === "fiesta" ? "Modo fiesta" : fiesta?.gol ? "¡Hubo gol!" : "Resaca"}>
      {fiesta && (
        <div className="hoja-festejo">
          <div className="festejo-avatar">
            <Avatar perfil={perfil} tam={76} />
            <span aria-hidden="true">{fiesta.modo === "fiesta" ? "🍸" : fiesta.gol ? "⚽" : "🥴"}</span>
          </div>
          <strong>
            {fiesta.modo === "fiesta"
              ? `${propio ? "Estás" : `${perfil.nombre} está`} en modo fiesta`
              : fiesta.gol
                ? `${propio ? "Hiciste" : `${perfil.nombre} hizo`} gol anoche 👑`
                : `${propio ? "Tenés" : `${perfil.nombre} tiene`} resaca`}
          </strong>
          <small>
            {fiesta.modo === "fiesta" ? `Lleva ${vasos} esta noche.` : `Salió anoche: ${vasos}${fiesta.gol ? " y hubo beso." : "."}`}
          </small>
          {fiesta.modo === "resaca" && fiesta.gol && !propio && (
            felicitado
              ? <p className="nota">Ya lo felicitaste en el grupo 🎉</p>
              : <button className="boton" onClick={felicitar} disabled={mandando}><PartyPopper size={18} /> Felicitarlo en el grupo</button>
          )}
        </div>
      )}
    </Hoja>,
    document.body,
  );
}
