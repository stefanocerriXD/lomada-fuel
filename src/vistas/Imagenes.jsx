import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useDatos, VENTANA_DIAS } from "../lib/datos.jsx";
import { aFecha, fechaLocal, haceDias, nombreDia } from "../lib/fechas.js";
import { TIPOS } from "../lib/macros.js";
import { Vacio } from "../componentes/Base.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import TarjetaComida from "../componentes/TarjetaComida.jsx";
import TarjetaSalida from "../componentes/TarjetaSalida.jsx";
import TiraDias from "../componentes/TiraDias.jsx";
import Visor from "../componentes/Visor.jsx";

const moverDia = (fecha, dias) => {
  const d = aFecha(fecha);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
};

export default function Imagenes({ onCargar, avisar }) {
  const { usuario, comidas, fotos, perfiles, cargarDia } = useDatos();
  const hoy = fechaLocal();
  const [fecha, setFecha] = useState(hoy);
  const [viejos, setViejos] = useState({});
  const [abiertos, setAbiertos] = useState([]);
  const [visor, setVisor] = useState(null);
  const [fallo, setFallo] = useState(false);

  // Lo reciente ya está en memoria; los días anteriores se piden cuando alguien llega hasta ahí.
  const antiguo = fecha < haceDias(VENTANA_DIAS);
  useEffect(() => {
    setFallo(false);
    if (!antiguo || viejos[fecha]) return;
    let activo = true;
    cargarDia(fecha)
      .then((lista) => activo && setViejos((prev) => ({ ...prev, [fecha]: lista })))
      .catch(() => activo && setFallo(true));
    return () => { activo = false; };
  }, [antiguo, fecha, viejos, cargarDia]);

  // Un día viejo también tiene que reflejar lo editado o borrado.
  useEffect(() => setViejos({}), [comidas]);

  // La fiesta se ve la noche en que se cargó y todo el día siguiente (la de anoche sigue arriba hasta la noche).
  const conFiesta = (c) => c.tipo === "fiesta" && ((c.alimentos || []).length > 0 || c.foto_path || typeof c.gol === "boolean");
  const delDia = useMemo(() => {
    const ayer = moverDia(fecha, -1);
    const base = antiguo ? viejos[fecha] || [] : comidas.filter((c) => c.fecha === fecha || (c.tipo === "fiesta" && c.fecha === ayer));
    // Una comida grupal se muestra una vez, con todos los que comieron.
    const ids = new Set(base.map((c) => c.id));
    const vistas = new Set();
    return base
      .filter((c) => c.tipo !== "resumen" && (c.tipo === "fiesta" ? conFiesta(c) : c.foto_path || c.postre_foto))
      .filter((c) => {
        if (!c.grupo_comida) return true;
        if (ids.has(c.grupo_comida)) return c.id === c.grupo_comida;
        if (vistas.has(c.grupo_comida)) return false;
        vistas.add(c.grupo_comida);
        return true;
      })
      .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en));
  }, [antiguo, comidas, fecha, viejos]);

  const conFotos = useMemo(() => new Set(comidas.filter((c) => c.foto_path).map((c) => c.fecha)), [comidas]);
  // La fiesta aparece solo si alguien salió y cargó vasos; va primera, bien a la vista.
  const grupos = [{ id: "fiesta", texto: "Fiesta", plural: "Fiesta" }, ...TIPOS]
    .map((t) => ({ ...t, lista: delDia.filter((c) => c.tipo === t.id) }))
    .filter((g) => g.id !== "fiesta" || g.lista.length);
  // Quiénes salieron, de qué noche y cuántos goles.
  function resumenFiesta(lista) {
    const nombres = [...new Set(lista.map((c) => (c.usuario_id === usuario.id ? "Vos" : perfiles[c.usuario_id]?.nombre || "Amigo")))];
    const goles = lista.filter((c) => c.gol === true).length;
    // "Anoche" o "Esta noche" solo si todas son de la misma noche.
    const noche = lista.every((c) => c.fecha !== fecha) ? "Anoche · " : lista.every((c) => c.fecha === fecha) ? (fecha === hoy ? "Esta noche · " : "Esa noche · ") : "";
    return `${noche}${nombres.join(", ")}${goles ? ` · ⚽ ${goles} ${goles === 1 ? "gol" : "goles"}` : ""}`;
  }
  // Las fiestas de una misma salida van juntas: cada uno con sus vasos.
  function salidasDe(lista) {
    const porSalida = new Map();
    for (const c of lista) {
      const clave = c.salida || c.id;
      porSalida.set(clave, [...(porSalida.get(clave) || []), c]);
    }
    return [...porSalida.values()];
  }
  const conLista = grupos.filter((g) => g.lista.length).map((g) => g.id);
  const todasAbiertas = conLista.length > 0 && conLista.every((id) => abiertos.includes(id));
  const secciones = useRef({});
  // La cabecera de cada comida queda fija arriba mientras bajás: al agruparla desde abajo, vuelve a quedar a la vista.
  function alternar(id) {
    const cerrando = abiertos.includes(id);
    setAbiertos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (!cerrando) return;
    const seccion = secciones.current[id];
    const tope = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tope-fotos")) || 118;
    if (seccion && seccion.getBoundingClientRect().top < tope) {
      requestAnimationFrame(() => window.scrollTo({ top: window.scrollY + seccion.getBoundingClientRect().top - tope }));
    }
  }

  return (
    <>
      <TiraDias fecha={fecha} onElegir={setFecha} conComidas={conFotos} />

      <div className="dia-selector">
        <button className="boton-icono" onClick={() => setFecha(moverDia(fecha, -1))} aria-label="Día anterior"><ChevronLeft size={20} /></button>
        <strong>{nombreDia(fecha)}</strong>
        <button className="boton-icono" onClick={() => setFecha(moverDia(fecha, 1))} disabled={fecha >= hoy} aria-label="Día siguiente"><ChevronRight size={20} /></button>
      </div>

      {fallo && <p className="error" role="alert">No pudimos traer ese día. Probá de nuevo.</p>}

      {!delDia.length && !fallo ? (
        <Vacio icono={Images} titulo="Sin fotos este día" texto="Cuando alguien suba una foto, va a aparecer acá." />
      ) : (
        <>
          <button className="boton-texto alternar-todas" onClick={() => setAbiertos(todasAbiertas ? [] : conLista)}>
            {todasAbiertas ? "Agrupar todas" : "Abrir todas"}
          </button>
          {grupos.map((g) => {
            const abierto = abiertos.includes(g.id);
            const vacio = !g.lista.length;
            return (
              <section key={g.id} className={["tarjeta grupo-fotos", abierto && "abierto", g.id === "fiesta" && "grupo-fiesta"].filter(Boolean).join(" ")} ref={(n) => { secciones.current[g.id] = n; }}>
                <button className="grupo-fotos-cabecera" onClick={() => alternar(g.id)} aria-expanded={abierto} disabled={vacio}>
                  <span className="grupo-fotos-icono"><IconoComida tipo={g.id} size={21} /></span>
                  <span className="grupo-fotos-datos">
                    <strong>{g.id === "fiesta" ? "🪩 Fiesta" : g.plural || g.texto}</strong>
                    <small>{vacio ? "Sin fotos" : g.id === "fiesta" ? resumenFiesta(g.lista) : `${g.lista.length} ${g.lista.length === 1 ? "foto" : "fotos"}`}</small>
                  </span>
                  {!abierto && !vacio && (
                    <span className="pila-fotos" aria-hidden="true">
                      {g.lista.filter((c) => fotos[c.foto_path || c.postre_foto]).slice(0, 3).map((c) => <img key={c.id} src={fotos[c.foto_path || c.postre_foto]} alt="" loading="lazy" />)}
                    </span>
                  )}
                  {abierto && <span className="grupo-fotos-agrupar">Agrupar</span>}
                  {!vacio && <motion.span animate={{ rotate: abierto ? 180 : 0 }} className="amigo-flecha"><ChevronDown size={18} /></motion.span>}
                </button>
                <AnimatePresence initial={false}>
                  {abierto && (
                    <motion.div className="fotos-lista" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      {g.id === "fiesta" && salidasDe(g.lista).filter((s) => s.length > 1).map((s) => (
                        <TarjetaSalida
                          key={s[0].salida}
                          miembros={s}
                          avisar={avisar}
                          onZoom={(comida, n) => {
                            const conFoto = g.lista.filter((x) => x.foto_path || x.postre_foto);
                            setVisor({ lista: conFoto, inicio: Math.max(0, conFoto.findIndex((x) => x.id === comida.id)), foto: n });
                          }}
                        />
                      ))}
                      {(g.id === "fiesta" ? salidasDe(g.lista).filter((s) => s.length === 1).map((s) => s[0]) : g.lista).map((c) => (
                        <TarjetaComida
                          key={c.id}
                          comida={c}
                          perfil={perfiles[c.usuario_id]}
                          foto={fotos[c.foto_path]}
                          propia={c.usuario_id === usuario.id}
                          indice={0}
                          onZoom={(z) => {
                            const conFoto = g.lista.filter((x) => x.foto_path || x.postre_foto);
                            setVisor({ lista: conFoto, inicio: Math.max(0, conFoto.findIndex((x) => x.id === c.id)), foto: z?.n || 0 });
                          }}
                          onEditar={() => onCargar({ comida: c })}
                          avisar={avisar}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </>
      )}

      <AnimatePresence>
        {visor && <Visor lista={visor.lista} inicio={visor.inicio} inicioFoto={visor.foto} onCerrar={() => setVisor(null)} />}
      </AnimatePresence>
    </>
  );
}
