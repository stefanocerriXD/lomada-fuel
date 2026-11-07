import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Users } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { sumarComidas } from "../lib/macros.js";
import { Avatar, Hoja, vibrar } from "../componentes/Base.jsx";
import Chat from "./Chat.jsx";
import Imagenes from "./Imagenes.jsx";

const SECCIONES = [["chat", "Chat"], ["imagenes", "Imágenes"]];

function Integrantes({ abierta, onCerrar }) {
  const { usuario, perfiles, comidas, abrirPerfil } = useDatos();
  const hoy = fechaLocal();
  const deHoy = useMemo(() => comidas.filter((c) => c.fecha === hoy), [comidas, hoy]);
  const lista = Object.values(perfiles).sort((a, b) => (a.id === usuario.id ? -1 : b.id === usuario.id ? 1 : a.nombre.localeCompare(b.nombre)));

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Integrantes">
      <ul className="integrantes">
        {lista.map((p) => {
          const kcal = Math.round(sumarComidas(deHoy.filter((c) => c.usuario_id === p.id)).kcal);
          return (
            <li key={p.id}>
              <button className="tarjeta integrante" onClick={() => { onCerrar(); abrirPerfil(p.id); }}>
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
    </Hoja>
  );
}

export default function Grupo({ seccion, onSeccion, onCargar, avisar }) {
  const [viendo, setViendo] = useState(false);

  const barra = (
    <div className="grupo-barra">
      <div className="selector" role="tablist" aria-label="Sección del grupo">
        {SECCIONES.map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={seccion === id} className={seccion === id ? "activo" : ""} onClick={() => { onSeccion(id); vibrar(5); }}>
            {seccion === id && <motion.span className="selector-fondo" layoutId="selector-grupo" />}
            <span>{texto}</span>
          </button>
        ))}
      </div>
      <button className="boton-icono" onClick={() => setViendo(true)} aria-label="Integrantes"><Users size={20} /></button>
    </div>
  );

  return (
    <>
      {seccion === "chat"
        ? <Chat avisar={avisar} cabecera={barra} />
        : <Imagenes cabecera={barra} onCargar={onCargar} avisar={avisar} />}
      <Integrantes abierta={viendo} onCerrar={() => setViendo(false)} />
    </>
  );
}
