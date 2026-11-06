import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, MessageCircle, Pencil, PenLine, SendHorizontal, Star, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Avatar, Vacio, vibrar } from "../componentes/Base.jsx";

export default function Muro({ onCargar, avisar }) {
  const { usuario, perfiles, comidas, fotos } = useDatos();
  const [filtro, setFiltro] = useState("todos");
  const [zoom, setZoom] = useState(null);

  const visibles = comidas.filter((c) => c.tipo !== "resumen" && (filtro === "todos" || c.usuario_id === filtro)).slice(0, 60);

  return (
    <>
      <header className="titulo-vista">
        <div>
          <p className="sobretitulo">Lo que comió el grupo</p>
          <h1>Muro</h1>
        </div>
      </header>

      <div className="fichas-personas" role="group" aria-label="Filtrar por persona">
        <button className={filtro === "todos" ? "ficha activa" : "ficha"} onClick={() => setFiltro("todos")} aria-pressed={filtro === "todos"}>
          Todos
        </button>
        {Object.values(perfiles).map((p) => (
          <button key={p.id} className={filtro === p.id ? "ficha activa" : "ficha"} onClick={() => setFiltro(p.id)} aria-pressed={filtro === p.id}>
            <Avatar perfil={p} tam={26} /> {p.id === usuario.id ? "Vos" : p.nombre}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <Vacio emoji="📸" titulo="El muro está vacío" texto="Subí la primera foto y arrancá la competencia.">
          <button className="boton" onClick={() => onCargar()}>Subir comida</button>
        </Vacio>
      ) : (
        <div className="muro">
          <AnimatePresence initial={false}>
            {visibles.map((c, i) => (
              <TarjetaComida
                key={c.id}
                comida={c}
                perfil={perfiles[c.usuario_id]}
                foto={fotos[c.foto_path]}
                propia={c.usuario_id === usuario.id}
                indice={i}
                onZoom={setZoom}
                onEditar={() => onCargar({ comida: c })}
                avisar={avisar}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {zoom && (
          <motion.div className="lupa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoom(null)}>
            <button className="boton-icono" aria-label="Cerrar foto"><X size={22} /></button>
            <motion.img src={zoom.src} alt={zoom.alt} initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const OPCIONES = ["🔥", "🤤", "😂", "👏", "🐷"];

function Reacciones({ comidaId }) {
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

function Comentarios({ comidaId, lista }) {
  const { usuario, perfiles, cargarExtras } = useDatos();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from("comentarios")
      .insert({ comida_id: comidaId, usuario_id: usuario.id, texto: limpio })
      .select()
      .single();
    setEnviando(false);
    if (error) return;
    setTexto("");
    await cargarExtras();
    avisarGrupo("comentario", data.id);
  }

  async function borrar(id) {
    await supabase.from("comentarios").delete().eq("id", id);
    await cargarExtras();
  }

  return (
    <motion.div className="comentarios" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
      {lista.map((c) => (
        <div key={c.id} className="comentario">
          <Avatar perfil={perfiles[c.usuario_id]} tam={28} />
          <p><strong>{perfiles[c.usuario_id]?.nombre || "Amigo"}</strong> {c.texto}</p>
          {c.usuario_id === usuario.id && (
            <button className="boton-icono chico" onClick={() => borrar(c.id)} aria-label="Borrar comentario"><Trash2 size={15} /></button>
          )}
        </div>
      ))}
      <form className="comentar" onSubmit={enviar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí un comentario…" aria-label="Comentario" maxLength={300} />
        <button className="boton-enviar" disabled={enviando || !texto.trim()} aria-label="Enviar comentario"><SendHorizontal size={18} /></button>
      </form>
    </motion.div>
  );
}

function TarjetaComida({ comida, perfil, foto, propia, indice, onZoom, onEditar, avisar }) {
  const { usuario, cargarComidas, extras, cargarExtras } = useDatos();
  const [confirmar, setConfirmar] = useState(false);
  const [charla, setCharla] = useState(false);
  const comentarios = extras.comentarios.filter((c) => c.comida_id === comida.id);
  const tipo = tipoInfo(comida.tipo);
  const alimentos = comida.alimentos || [];
  const texto = comida.descripcion || tipo.texto;

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
    const { error } = await supabase.from("comidas").delete().eq("id", comida.id);
    if (error) return avisar("No se pudo borrar");
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
        <Avatar perfil={perfil} tam={38} />
        <div>
          <strong>{perfil?.nombre || "Amigo"}</strong>
          <span>{tipo.emoji} {tipo.texto} · {haceCuanto(comida.creado_en)}{comida.privada && <><Lock size={12} className="candado" /> Solo vos</>}</span>
        </div>
      </header>

      {foto ? (
        <button className="comida-foto" onClick={() => onZoom({ src: foto, alt: texto })} aria-label={`Ampliar foto: ${texto}`}>
          <img src={foto} alt={texto} loading="lazy" />
          <span className="comida-kcal">{(comida.calorias || 0).toLocaleString("es-AR")} kcal</span>
        </button>
      ) : (
        <div className="comida-sinfoto">
          <span aria-hidden="true">{tipo.emoji}</span>
          <strong>{(comida.calorias || 0).toLocaleString("es-AR")} kcal</strong>
        </div>
      )}

      <div className="comida-cuerpo">
        <p className="comida-texto">{texto}</p>
        {alimentos.length > 0 && (
          <p className="comida-items">{alimentos.map((a) => a.nombre).join(" · ")}</p>
        )}
        <ul className="comida-macros">
          <li><span className="punto s-p" /> P <strong>{Math.round(comida.proteinas || 0)} g</strong></li>
          <li><span className="punto s-c" /> C <strong>{Math.round(comida.carbohidratos || 0)} g</strong></li>
          <li><span className="punto s-g" /> G <strong>{Math.round(comida.grasas || 0)} g</strong></li>
          {comida.macros_editados && (
            <li className="comida-editado"><PenLine size={12} /> ajustado</li>
          )}
        </ul>
        {!comida.privada && <Reacciones comidaId={comida.id} />}
        {!comida.privada && extras.disponible && (
          <button className="boton-texto" onClick={() => setCharla(!charla)} aria-expanded={charla}>
            <MessageCircle size={15} /> {comentarios.length ? `${comentarios.length} ${comentarios.length === 1 ? "comentario" : "comentarios"}` : "Comentar"}
          </button>
        )}
        <AnimatePresence initial={false}>
          {charla && <Comentarios comidaId={comida.id} lista={comentarios} />}
        </AnimatePresence>
        {propia && (
          <div className="comida-acciones">
            <button className="boton-texto" onClick={onEditar}><Pencil size={15} /> Editar</button>
            {extras.disponible && (
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
