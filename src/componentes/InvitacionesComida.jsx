import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { avisarGrupo } from "../lib/api.js";
import { tipoInfo } from "../lib/macros.js";
import { nombreDia } from "../lib/fechas.js";
import { Avatar, vibrar } from "./Base.jsx";
import IconoComida from "./IconoComida.jsx";

const numero = (n) => Math.round(Number(n) || 0).toLocaleString("es-AR");

// Las comidas grupales a las que te sumaron y todavía no respondiste.
export default function InvitacionesComida({ avisar }) {
  const { usuario, perfiles, fotos, invitaciones, comidasInvitadas, cargarInvitaciones, cargarComidas } = useDatos();
  const [respondiendo, setRespondiendo] = useState(null);

  const pendientes = invitaciones.filter((i) => i.para_usuario === usuario.id && i.estado === "pendiente" && comidasInvitadas[i.comida_id]);

  async function responder(inv, acepta) {
    setRespondiendo(inv.id);
    const { error } = await supabase.rpc("responder_invitacion", { p_id: inv.id, p_acepta: acepta });
    setRespondiendo(null);
    if (error) return avisar("No se pudo responder. Probá de nuevo.");
    vibrar(acepta ? 20 : 10);
    if (acepta) {
      avisarGrupo("invitacion", inv.id);
      avisar("Sumada a tu día. Tocala si querés ajustar tu porción.");
    }
    await Promise.all([cargarInvitaciones(), cargarComidas()]).catch(() => {});
  }

  return (
    <AnimatePresence initial={false}>
      {pendientes.map((inv) => {
        const c = comidasInvitadas[inv.comida_id];
        const de = perfiles[inv.de_usuario];
        const titulo = c.descripcion || tipoInfo(c.tipo).texto;
        return (
          <motion.section
            key={inv.id}
            className="invitacion-comida"
            aria-label={`Invitación de ${de?.nombre || "un amigo"}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          >
            <p className="invitacion-quien">
              <Avatar perfil={de} tam={26} />
              <span><strong>{de?.nombre || "Un amigo"}</strong> te sumó a su {tipoInfo(c.tipo).texto.toLowerCase()} grupal</span>
            </p>
            <div className="invitacion-comida-datos">
              {fotos[c.foto_path] ? <img src={fotos[c.foto_path]} alt="" /> : <span className="invitacion-icono"><IconoComida tipo={c.tipo} size={22} /></span>}
              <span>
                <strong>{titulo}</strong>
                <small>{nombreDia(c.fecha)} · {numero(c.calorias)} kcal · P {numero(c.proteinas)} · C {numero(c.carbohidratos)} · G {numero(c.grasas)}</small>
              </span>
            </div>
            <div className="invitacion-botones">
              <button className="boton-chico" onClick={() => responder(inv, false)} disabled={respondiendo === inv.id}><X size={15} /> No comí</button>
              <button className="boton-chico activo" onClick={() => responder(inv, true)} disabled={respondiendo === inv.id}><Check size={15} /> Aceptar</button>
            </div>
          </motion.section>
        );
      })}
    </AnimatePresence>
  );
}

