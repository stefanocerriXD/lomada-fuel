import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Users } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal } from "../lib/fechas.js";
import { sumarComidas } from "../lib/macros.js";
import { nivelGeneral, nivelesGuardados } from "../lib/medallas.js";
import { Indicador, Avatar, Hoja, vibrar } from "../componentes/Base.jsx";
import Chat from "./Chat.jsx";
import Imagenes from "./Imagenes.jsx";

const SECCIONES = [["chat", "Chat"], ["imagenes", "Imágenes"]];

function Integrantes({ abierta, onCerrar }) {
  const { usuario, perfiles, comidas, extras, abrirPerfil } = useDatos();
  const hoy = fechaLocal();
  const deHoy = useMemo(() => comidas.filter((c) => c.fecha === hoy), [comidas, hoy]);
  const lista = Object.values(perfiles).sort((a, b) => (a.id === usuario.id ? -1 : b.id === usuario.id ? 1 : a.nombre.localeCompare(b.nombre)));

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Integrantes">
      <ul className="integrantes">
        {lista.map((p) => {
          const kcal = Math.round(sumarComidas(deHoy.filter((c) => c.usuario_id === p.id)).kcal);
          const general = nivelGeneral(nivelesGuardados(extras.medallas.filter((m) => m.usuario_id === p.id).map((m) => m.codigo)));
          return (
            <li key={p.id}>
              <button className="tarjeta integrante" onClick={() => { onCerrar(); abrirPerfil(p.id); }}>
                <Avatar perfil={p} tam={44} />
                <span>
                  <strong>{p.id === usuario.id ? `${p.nombre} (vos)` : p.nombre}</strong>
                  <small>Nivel {general.nivel} · {general.rango}</small>
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

export default function Grupo({ seccion, onSeccion, onCargar, avisar, sentido }) {
  const [viendo, setViendo] = useState(false);

  const barra = (
    <div className="grupo-barra">
      <div className="selector" role="tablist" aria-label="Sección del grupo">
        {SECCIONES.map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={seccion === id} className={seccion === id ? "activo" : ""} onClick={() => { onSeccion(id); vibrar(5); }}>
            <span>{texto}</span>
          </button>
        ))}
        <Indicador indice={SECCIONES.findIndex(([id]) => id === seccion)} total={SECCIONES.length} />
      </div>
      <button className="boton-icono" onClick={() => setViendo(true)} aria-label="Integrantes"><Users size={20} /></button>
    </div>
  );

  return (
    <div className={seccion === "chat" ? "grupo grupo-chat" : "grupo"}>
      {barra}
      <motion.div
        key={seccion}
        className="grupo-contenido"
        initial={{ opacity: 0, x: sentido * 44 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        {seccion === "chat" ? <Chat avisar={avisar} /> : <Imagenes onCargar={onCargar} avisar={avisar} />}
      </motion.div>
      <Integrantes abierta={viendo} onCerrar={() => setViendo(false)} />
    </div>
  );
}
