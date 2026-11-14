import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useDatos, VENTANA_DIAS } from "../lib/datos.jsx";
import { aFecha, fechaLocal, haceDias, nombreDia } from "../lib/fechas.js";
import { TIPOS } from "../lib/macros.js";
import { Vacio } from "../componentes/Base.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import TarjetaComida from "../componentes/TarjetaComida.jsx";
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

  const delDia = useMemo(() => {
    const base = antiguo ? viejos[fecha] || [] : comidas.filter((c) => c.fecha === fecha);
    // Una comida grupal se muestra una vez, con todos los que comieron.
    const ids = new Set(base.map((c) => c.id));
    const vistas = new Set();
    return base
      .filter((c) => c.tipo !== "resumen" && (c.foto_path || c.postre_foto || (c.tipo === "fiesta" && typeof c.gol === "boolean")))
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
  // La fiesta aparece solo si alguien la subió (con foto o diciendo si hubo gol).
  const grupos = [...TIPOS, { id: "fiesta", texto: "Fiesta", plural: "Fiesta" }]
    .map((t) => ({ ...t, lista: delDia.filter((c) => c.tipo === t.id) }))
    .filter((g) => g.id !== "fiesta" || g.lista.length);
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
              <section key={g.id} className={abierto ? "tarjeta grupo-fotos abierto" : "tarjeta grupo-fotos"} ref={(n) => { secciones.current[g.id] = n; }}>
                <button className="grupo-fotos-cabecera" onClick={() => alternar(g.id)} aria-expanded={abierto} disabled={vacio}>
                  <span className="grupo-fotos-icono"><IconoComida tipo={g.id} size={21} /></span>
                  <span className="grupo-fotos-datos">
                    <strong>{g.plural || g.texto}</strong>
                    <small>{vacio ? "Sin fotos" : `${g.lista.length} ${g.lista.length === 1 ? "foto" : "fotos"}`}</small>
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
                      {g.lista.map((c) => (
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
