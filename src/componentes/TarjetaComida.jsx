import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Lock, Pencil, PenLine, Reply, Star, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar, vibrar } from "./Base.jsx";
import DetalleAlimentos, { alimentosVisibles } from "./DetalleAlimentos.jsx";
import IconoComida from "./IconoComida.jsx";

const OPCIONES = ["🔥", "🤤", "😂", "👏", "🐷"];

export function Reacciones({ comidaId }) {
  const { usuario, salud, reacciones, alternarReaccion } = useDatos();
  if (salud === undefined) return null; // Las reacciones llegan con la misma actualización de la base.
  const propias = reacciones.filter((r) => r.comida_id === comidaId);

  return (
    <div className="reacciones" role="group" aria-label="Reaccionar">
      {OPCIONES.map((e) => {
        const cantidad = propias.filter((r) => r.emoji === e).length;
        const mia = propias.some((r) => r.emoji === e && r.usuario_id === usuario.id);
        return (
          <motion.button
            key={e}
            className={mia ? "reaccion mia" : "reaccion"}
            whileTap={{ scale: 1.3 }}
            onClick={() => { alternarReaccion(comidaId, e); vibrar(8); }}
            aria-pressed={mia}
            aria-label={`Reaccionar con ${e}`}
          >
            <span aria-hidden="true">{e}</span>
            {cantidad > 0 && <motion.small key={cantidad} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{cantidad}</motion.small>}
          </motion.button>
        );
      })}
    </div>
  );
}

export default function TarjetaComida({ comida, perfil, foto, propia, indice, onZoom, onEditar, avisar }) {
  const { usuario, cargarComidas, extras, cargarExtras, abrirPerfil, responder } = useDatos();
  const [confirmar, setConfirmar] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const tipo = tipoInfo(comida.tipo);
  const alimentos = comida.alimentos || [];
  const texto = comida.descripcion || tipo.texto;
  // Foto de una comida cuyas calorías ya entraron con el total importado del día.
  const soloFoto = alimentos[0]?.fuente === "foto" && !comida.calorias;
  const conDetalle = alimentosVisibles(alimentos).length > 0;

  const nombreFavorita = texto.slice(0, 200);
  const favorita = extras.favoritas.find((f) => f.nombre === nombreFavorita);

  async function alternarFavorita() {
    if (favorita) {
      await supabase.from("favoritas").delete().eq("id", favorita.id);
    } else {
      const items = alimentos.length
        ? alimentos
        : [{ nombre: texto, fuente: "manual", kcal: comida.calorias, p: comida.proteinas, c: comida.carbohidratos, g: comida.grasas }];
      const { error } = await supabase.from("favoritas").insert({ usuario_id: usuario.id, nombre: nombreFavorita, alimentos: items });
      if (error) return avisar("No se pudo guardar");
      vibrar(12);
      avisar("Guardada en favoritas");
    }
    await cargarExtras();
  }

  async function borrar() {
    const { data, error } = await supabase.from("comidas").delete().eq("id", comida.id).select("id");
    // Sin permiso, la base responde sin error pero no borra nada.
    if (error || data?.length === 0) return avisar("No se pudo borrar");
    if (comida.foto_path) await supabase.storage.from("fotos").remove([comida.foto_path]);
    await cargarComidas();
    avisar("Comida borrada");
  }

  return (
    <motion.article
      className="tarjeta comida"
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(indice, 8) * 0.03 }}
    >
      <header className="comida-cabecera">
        <button className="comida-autor" onClick={() => abrirPerfil(comida.usuario_id)} aria-label={`Ver perfil de ${perfil?.nombre || "Amigo"}`}>
          <Avatar perfil={perfil} tam={38} />
          <span className="comida-autor-datos">
            <strong>{perfil?.nombre || "Amigo"}</strong>
            <span>{tipo.texto} · {haceCuanto(comida.creado_en)}{comida.privada && <><Lock size={12} className="candado" /> Solo vos</>}</span>
          </span>
        </button>
      </header>

      {foto ? (
        <button className="comida-foto" onClick={() => onZoom({ src: foto, alt: texto })} aria-label={`Ampliar foto: ${texto}`}>
          <img src={foto} alt={texto} loading="lazy" />
        </button>
      ) : (
        <div className="comida-sinfoto">
          <IconoComida tipo={comida.tipo} size={32} />
          <strong>{(comida.calorias || 0).toLocaleString("es-AR")} kcal</strong>
        </div>
      )}

      <div className="comida-cuerpo">
        <p className="comida-texto">{texto}</p>
        {soloFoto && <p className="comida-items">Contada en el total del día</p>}
        {!soloFoto && <ul className="comida-macros">
          <li><strong>{(comida.calorias || 0).toLocaleString("es-AR")} kcal</strong></li>
          <li><span className="punto s-p" /> P <strong>{Math.round(comida.proteinas || 0)} g</strong></li>
          <li><span className="punto s-c" /> C <strong>{Math.round(comida.carbohidratos || 0)} g</strong></li>
          <li><span className="punto s-g" /> G <strong>{Math.round(comida.grasas || 0)} g</strong></li>
          {comida.macros_editados && (
            <li className="comida-editado"><PenLine size={12} /> ajustado</li>
          )}
        </ul>}
        {!soloFoto && conDetalle && (
          <>
            <button className="boton-texto ver-alimentos" onClick={() => setDetalle(!detalle)} aria-expanded={detalle}>
              <motion.span animate={{ rotate: detalle ? 180 : 0 }}><ChevronDown size={16} /></motion.span>
              {detalle ? "Ocultar alimentos" : "Ver alimentos"}
            </button>
            <AnimatePresence initial={false}>
              {detalle && (
                <motion.div className="detalle-pliegue" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <DetalleAlimentos alimentos={alimentos} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {!comida.privada && <Reacciones comidaId={comida.id} />}
        {!comida.privada && <button className="boton-texto" onClick={() => responder(comida)}><Reply size={15} /> Responder en el chat</button>}
        {propia && (
          <div className="comida-acciones">
            <button className="boton-texto" onClick={onEditar}><Pencil size={15} /> Editar</button>
            {extras.disponible && !soloFoto && (
              <button className={favorita ? "boton-texto favorita" : "boton-texto"} onClick={alternarFavorita} aria-pressed={!!favorita}>
                <Star size={15} fill={favorita ? "currentColor" : "none"} /> Favorita
              </button>
            )}
            {confirmar ? (
              <button className="boton-texto peligro" onClick={borrar}><Trash2 size={15} /> ¿Seguro? Tocá de nuevo</button>
            ) : (
              <button className="boton-texto" onClick={() => setConfirmar(true)} onBlur={() => setConfirmar(false)}>
                <Trash2 size={15} /> Borrar
              </button>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
