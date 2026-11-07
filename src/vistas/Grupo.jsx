import { useMemo } from "react";
import { motion } from "motion/react";
import { ChevronRight, Images, MessageCircle } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { sumarComidas } from "../lib/macros.js";
import { Avatar } from "../componentes/Base.jsx";
import Chat from "./Chat.jsx";
import Imagenes from "./Imagenes.jsx";

export default function Grupo({ seccion, onSeccion, onCargar, avisar }) {
  const { usuario, perfiles, comidas, fotos, abrirPerfil } = useDatos();
  const hoy = fechaLocal();
  const deHoy = useMemo(() => comidas.filter((c) => c.fecha === hoy), [comidas, hoy]);
  const conFoto = deHoy.filter((c) => fotos[c.foto_path]);
  const volver = () => onSeccion(null);

  if (seccion === "chat") return <Chat onCargar={onCargar} avisar={avisar} onVolver={volver} />;
  if (seccion === "imagenes") return <Imagenes onVolver={volver} />;

  const integrantes = Object.values(perfiles).sort((a, b) => (a.id === usuario.id ? -1 : b.id === usuario.id ? 1 : a.nombre.localeCompare(b.nombre)));

  return (
    <>
      <header className="titulo-vista"><h1>Grupo</h1></header>

      <div className="entradas-grupo">
        <motion.button className="tarjeta entrada-grupo" whileTap={{ scale: 0.97 }} onClick={() => onSeccion("chat")}>
          <span className="entrada-icono"><MessageCircle size={26} /></span>
          <strong>Chat</strong>
          <small>Mensajes y comidas</small>
        </motion.button>
        <motion.button className="tarjeta entrada-grupo" whileTap={{ scale: 0.97 }} onClick={() => onSeccion("imagenes")}>
          <span className="entrada-icono"><Images size={26} /></span>
          <strong>Imágenes</strong>
          <small>{conFoto.length ? `${conFoto.length} ${conFoto.length === 1 ? "foto" : "fotos"} hoy` : "Las fotos de cada comida"}</small>
          {conFoto.length > 0 && (
            <span className="pila-fotos" aria-hidden="true">
              {conFoto.slice(0, 3).map((c) => <img key={c.id} src={fotos[c.foto_path]} alt="" loading="lazy" />)}
            </span>
          )}
        </motion.button>
      </div>

      <section>
        <h2 className="titulo-seccion">Integrantes</h2>
        <ul className="integrantes">
          {integrantes.map((p) => {
            const kcal = Math.round(sumarComidas(deHoy.filter((c) => c.usuario_id === p.id)).kcal);
            return (
              <li key={p.id}>
                <button className="tarjeta integrante" onClick={() => abrirPerfil(p.id)}>
                  <Avatar perfil={p} tam={44} />
                  <span>
                    <strong>{p.id === usuario.id ? `${p.nombre} (vos)` : p.nombre}</strong>
                    <small>{kcal ? `${kcal.toLocaleString("es-AR")} kcal hoy` : "Nada cargado hoy"}</small>
                  </span>
                  <ChevronRight size={19} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
