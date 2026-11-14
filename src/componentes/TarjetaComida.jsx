import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Lock, Maximize2, PenLine, Pencil, Reply, SmilePlus, Star, Trash2, Users } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { marcaDelNombre } from "../lib/multas.js";
import { Avatar, Hoja, vibrar } from "./Base.jsx";
import DetalleAlimentos, { alimentosVisibles } from "./DetalleAlimentos.jsx";
import IconoComida from "./IconoComida.jsx";

const OPCIONES = ["🔥", "🤤", "😂", "👏", "🐷", "🤮", "🏳️‍🌈"];

// Las reacciones no ocupan lugar: un resumen con el total (que muestra quién reaccionó)
// y un botón que abre los emojis solo cuando querés reaccionar.
export function Reacciones({ comidaId, avisar }) {
  const { usuario, perfiles, salud, reacciones, alternarReaccion, castigo, grupo } = useDatos();
  const [eligiendo, setEligiendo] = useState(false);
  const [quienes, setQuienes] = useState(false);
  if (salud === undefined) return null; // Las reacciones llegan con la misma actualización de la base.
  const propias = reacciones.filter((r) => r.comida_id === comidaId);
  const mias = new Set(propias.filter((r) => r.usuario_id === usuario.id).map((r) => r.emoji));
  const masUsados = OPCIONES.map((e) => [e, propias.filter((r) => r.emoji === e).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const porPersona = Object.values(
    propias.reduce((t, r) => ({ ...t, [r.usuario_id]: { id: r.usuario_id, emojis: [...(t[r.usuario_id]?.emojis || []), r.emoji] } }), {}),
  );

  function abrir() {
    if (castigo.activo) return avisar?.(grupo.conBocha ? "Castigado por el Bocha: no podés reaccionar hasta que subas tu foto de hoy." : "Subí tu foto de hoy para reaccionar a las del grupo.");
    setEligiendo(!eligiendo);
  }

  return (
    <div className="reacciones-compactas">
      {propias.length > 0 && (
        <button className="reacciones-resumen" onClick={() => setQuienes(true)} aria-label={`${propias.length} ${propias.length === 1 ? "reacción" : "reacciones"}: ver quién reaccionó`}>
          <span aria-hidden="true">{masUsados.map(([e]) => e).join("")}</span>
          <small>{propias.length}</small>
        </button>
      )}
      <button className={eligiendo ? "boton-reaccionar activo" : "boton-reaccionar"} onClick={abrir} aria-expanded={eligiendo} aria-label="Reaccionar">
        <SmilePlus size={18} />
      </button>
      <AnimatePresence>
        {eligiendo && (
          <motion.div className="selector-reacciones" role="group" aria-label="Elegí una reacción" initial={{ opacity: 0, scale: 0.8, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 6 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
            {OPCIONES.map((e) => (
              <motion.button
                key={e}
                whileTap={{ scale: 1.35 }}
                className={mias.has(e) ? "mia" : undefined}
                aria-pressed={mias.has(e)}
                aria-label={`Reaccionar con ${e}`}
                onClick={() => { alternarReaccion(comidaId, e); vibrar(8); setEligiendo(false); }}
              >
                {e}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Fuera de la tarjeta: con su animación, la hoja quedaría encerrada adentro. */}
      {createPortal(
      <Hoja abierta={quienes} onCerrar={() => setQuienes(false)} titulo="Reacciones">
        <ul className="lista-reacciones">
          {porPersona.map(({ id, emojis }) => (
            <li key={id}>
              <Avatar perfil={perfiles[id]} tam={34} />
              <span>{id === usuario.id ? "Vos" : perfiles[id]?.nombre || "Amigo"}</span>
              <span className="lista-reacciones-emojis">{emojis.join(" ")}</span>
            </li>
          ))}
        </ul>
      </Hoja>,
      document.body,
      )}
    </div>
  );
}

const alimentosDe = (c) => (Array.isArray(c.alimentos) ? c.alimentos : []);
const listaNombres = (n) => (n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}` : n[0]);

export default function TarjetaComida({ comida, perfil, foto, propia, indice, onZoom, onEditar, avisar }) {
  const { castigo, usuario, perfiles, comidas, invitaciones, cargarComidas, extras, cargarExtras, abrirPerfil, responder, fotos } = useDatos();
  const fotosExtra = (comida.fotos_extra || []).map((r) => fotos[r]);
  // El postre va como una foto más, al final, marcada.
  const fotoPostre = comida.postre_foto ? fotos[comida.postre_foto] : null;
  const conPostre = Boolean(comida.postre_foto || comida.postre_nombre);
  // Modo fiesta: si hubo gol (beso) o no, bien a la vista.
  const gol = comida.tipo === "fiesta" && typeof comida.gol === "boolean" ? comida.gol : null;
  const cartelGol = gol === null ? null : <span className={gol ? "cartel-gol si" : "cartel-gol no"}>{gol ? "⚽ ¡HUBO GOL!" : "🥅 SIN GOL"}</span>;
  // Los tragos de la noche, agrupados: "3 × Fernet con coca".
  const esFiesta = comida.tipo === "fiesta";
  const tragos = esFiesta
    ? Object.values(alimentosDe(comida).reduce((t, v) => {
        const clave = `${v.nombre}|${v.ml || ""}`;
        t[clave] = { nombre: v.nombre, ml: v.ml, cuantos: (t[clave]?.cuantos || 0) + 1 };
        return t;
      }, {}))
    : [];
  const alcohol = esFiesta ? Math.round(alimentosDe(comida).reduce((t, v) => t + (v.alcohol || 0), 0)) : 0;
  // Comida grupal: los que comieron lo mismo y, para quien la publicó, los que todavía no respondieron.
  const grupo = comida.grupo_comida;
  const nombresDe = (ids) => [...new Set(ids)].map((id) => (id === usuario.id ? "vos" : perfiles[id]?.nombre)).filter(Boolean);
  const conQuien = grupo ? nombresDe(comidas.filter((c) => c.grupo_comida === grupo && c.usuario_id !== comida.usuario_id).map((c) => c.usuario_id)) : [];
  const esperando = grupo && propia ? nombresDe(invitaciones.filter((i) => i.comida_id === comida.id && i.estado === "pendiente").map((i) => i.para_usuario)) : [];
  const [confirmar, setConfirmar] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const cuerpo = useRef(null);
  const tipo = tipoInfo(comida.tipo);
  // Con la maldición del Bocha, las fotos del grupo se ven borrosas hasta subir la propia.
  const tapada = castigo.diario && !propia;
  // Dos semanas sin subir: no se ve ninguna foto de los demás, ni borrosa.
  const oculta = castigo.calavera && !propia;
  const fotoPrincipal = comida.foto_path ? foto : fotoPostre;
  const srcs = comida.foto_path ? [foto, ...fotosExtra, ...(comida.postre_foto ? [fotoPostre] : [])] : [];
  const ampliar = (n = 0) => (tapada || oculta ? avisar?.(oculta ? "Hace dos semanas que no subís fotos. Subí la tuya para volver a ver las del grupo." : "Subí tu foto de hoy para ver las del grupo.") : onZoom({ n }));
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
    // La foto de una comida grupal la siguen usando los demás.
    if ((comida.foto_path || comida.postre_foto) && !comida.grupo_comida) await supabase.storage.from("fotos").remove([comida.foto_path, ...(comida.fotos_extra || []), comida.postre_foto].filter(Boolean));
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
            <strong>{perfil?.nombre || "Amigo"}{marcaDelNombre(perfil)}</strong>
            <span>{tipo.texto} · {haceCuanto(comida.creado_en)}{comida.privada && <><Lock size={12} className="candado" /> Solo vos</>}</span>
          </span>
        </button>
      </header>
      {(conQuien.length > 0 || esperando.length > 0) && (
        <p className="comida-grupal-linea">
          <Users size={14} aria-hidden="true" />
          {conQuien.length > 0 && `Con ${listaNombres(conQuien)}`}
          {conQuien.length > 0 && esperando.length > 0 && " · "}
          {esperando.length > 0 && `Esperando a ${listaNombres(esperando)}`}
        </p>
      )}

      {oculta && (comida.foto_path || comida.postre_foto) ? (
        <button className="comida-foto foto-oculta" onClick={() => ampliar()} aria-label="Foto oculta">
          <span className="foto-oculta-texto"><span aria-hidden="true">💀</span> Dos semanas sin subir fotos.<small>Subí la tuya para volver a ver las del grupo.</small></span>
        </button>
      ) : srcs.length > 1 ? (
        <CarruselFotos srcs={srcs} alt={texto} onZoom={ampliar} tapada={tapada} postre={comida.postre_foto ? srcs.length - 1 : -1} nombrePostre={comida.postre_nombre} encima={cartelGol} />
      ) : fotoPrincipal ? (
        <button className="comida-foto" onClick={() => ampliar()} aria-label={`Ampliar foto: ${texto}`}>
          <img src={fotoPrincipal} alt={texto} loading="lazy" className={tapada ? "foto-castigo" : undefined} />
          {tapada && <span className="foto-castigo-texto">Subí tu foto de hoy para ver las del grupo</span>}
          {cartelGol}
          {!comida.foto_path && comida.postre_foto && <span className="etiqueta-postre">🍮 Postre{comida.postre_nombre ? ` · ${comida.postre_nombre}` : ""}</span>}
          <span className="comida-foto-ampliar" aria-hidden="true"><Maximize2 size={15} /></span>
        </button>
      ) : (
        <div className={esFiesta ? "comida-sinfoto fiesta-sinfoto" : "comida-sinfoto"}>
          {cartelGol}
          <IconoComida tipo={comida.tipo} size={32} />
          <strong>{esFiesta ? `${tragos.reduce((t, x) => t + x.cuantos, 0)} vasos · ` : ""}{(comida.calorias || 0).toLocaleString("es-AR")} kcal</strong>
        </div>
      )}

      <div className="comida-cuerpo" ref={cuerpo}>
        <p className="comida-texto">{texto}</p>
        {esFiesta && (tragos.length > 0 || gol !== null) && (
          <div className="fiesta-resumen">
            {tragos.length > 0 && (
              <ul className="fiesta-tragos" aria-label="Tragos de la noche">
                {tragos.map((t) => <li key={`${t.nombre}|${t.ml}`}><strong>{t.cuantos} ×</strong> {t.nombre}{t.ml ? <small> · {t.ml} ml</small> : null}</li>)}
              </ul>
            )}
            <p className="fiesta-datos">
              {alcohol > 0 && <span>🍸 {alcohol} g de alcohol</span>}
              {gol !== null && <span className={gol ? "gol-si" : "gol-no"}>{gol ? "⚽ Hubo gol" : "🥅 Sin gol"}</span>}
            </p>
          </div>
        )}
        {conPostre && <p className="comida-postre">🍮 <span>Postre</span>{comida.postre_nombre && <strong>{comida.postre_nombre}</strong>}</p>}
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
        {!soloFoto && conDetalle && !esFiesta && (
          <>
            <button className="boton-texto ver-alimentos" onClick={() => setDetalle(!detalle)} aria-expanded={detalle}>
              <motion.span animate={{ rotate: detalle ? 180 : 0 }}><ChevronDown size={16} /></motion.span>
              {detalle ? "Ocultar alimentos" : "Ver alimentos"}
            </button>
            {/* Al cerrar desde abajo, la tarjeta vuelve a quedar a la vista en vez de dejarte en otra comida. */}
            <AnimatePresence initial={false} onExitComplete={() => cuerpo.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>
              {detalle && (
                <motion.div className="detalle-pliegue" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <DetalleAlimentos alimentos={alimentos} autorComida={comida.usuario_id} />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {!comida.privada && (
          <div className="comida-interacciones">
            <Reacciones comidaId={comida.id} avisar={avisar} />
            <button className="boton-texto" onClick={() => responder(comida)} aria-label="Responder en el chat"><Reply size={15} /> Responder</button>
          </div>
        )}
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

// Varias fotos de una misma comida: se pasan de costado, con puntitos abajo.
// La del postre va al final, con su cartel, y desde la primera se ve que hay postre.
export function CarruselFotos({ srcs, alt, onZoom, tapada, postre = -1, nombrePostre, encima }) {
  const [actual, setActual] = useState(0);
  const pista = useRef(null);
  // El deslizar de las fotos no cambia de pantalla.
  const frenar = (e) => e.stopPropagation();
  const irA = (n) => pista.current?.scrollTo({ left: n * pista.current.clientWidth, behavior: "smooth" });
  return (
    <div className="carrusel-fotos">
      {encima}
      {postre > 0 && actual !== postre && (
        <button type="button" className="ir-postre" onClick={() => irA(postre)} aria-label="Ver la foto del postre">
          🍮 Postre <span aria-hidden="true">›</span>
        </button>
      )}
      <div
        ref={pista}
        className="carrusel-pista"
        onScroll={(e) => setActual(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        onTouchStart={frenar}
        onTouchEnd={frenar}
      >
        {srcs.map((src, n) => (
          <button key={n} type="button" className="comida-foto" onClick={() => src && onZoom(n)} aria-label={n === postre ? `Ampliar la foto del postre${nombrePostre ? `: ${nombrePostre}` : ""}` : `Ampliar foto ${n + 1} de ${srcs.length}: ${alt}`}>
            {src ? <img src={src} alt={n === postre ? `Postre${nombrePostre ? `: ${nombrePostre}` : ""}` : `${alt} (${n + 1} de ${srcs.length})`} loading="lazy" className={tapada ? "foto-castigo" : undefined} /> : <span className="adjunto-cargando" />}
            {n === postre && <span className="etiqueta-postre">🍮 Postre{nombrePostre ? ` · ${nombrePostre}` : ""}</span>}
          </button>
        ))}
      </div>
      <span className="carrusel-contador" aria-hidden="true">{actual + 1}/{srcs.length}</span>
      <div className="carrusel-puntos" aria-hidden="true">{srcs.map((_, n) => <i key={n} className={[n === actual && "activo", n === postre && "postre"].filter(Boolean).join(" ") || undefined} />)}</div>
    </div>
  );
}

