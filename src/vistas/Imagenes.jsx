import { useEffect, useMemo, useState } from "react";
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
      .filter((c) => c.foto_path && c.tipo !== "resumen")
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
  const grupos = TIPOS.map((t) => ({ ...t, lista: delDia.filter((c) => c.tipo === t.id) }));
  const conLista = grupos.filter((g) => g.lista.length).map((g) => g.id);
  const todasAbiertas = conLista.length > 0 && conLista.every((id) => abiertos.includes(id));
  const alternar = (id) => setAbiertos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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
              <section key={g.id} className="tarjeta grupo-fotos">
                <button className="grupo-fotos-cabecera" onClick={() => alternar(g.id)} aria-expanded={abierto} disabled={vacio}>
                  <span className="grupo-fotos-icono"><IconoComida tipo={g.id} size={21} /></span>
                  <span className="grupo-fotos-datos">
                    <strong>{g.plural || g.texto}</strong>
                    <small>{vacio ? "Sin fotos" : `${g.lista.length} ${g.lista.length === 1 ? "foto" : "fotos"}`}</small>
                  </span>
                  {!abierto && !vacio && (
                    <span className="pila-fotos" aria-hidden="true">
                      {g.lista.slice(0, 3).map((c) => <img key={c.id} src={fotos[c.foto_path]} alt="" loading="lazy" />)}
                    </span>
                  )}
                  {!vacio && <motion.span animate={{ rotate: abierto ? 180 : 0 }} className="amigo-flecha"><ChevronDown size={18} /></motion.span>}
                </button>
                <AnimatePresence initial={false}>
                  {abierto && (
                    <motion.div className="fotos-lista" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      {g.lista.map((c, i) => (
                        <TarjetaComida
                          key={c.id}
                          comida={c}
                          perfil={perfiles[c.usuario_id]}
                          foto={fotos[c.foto_path]}
                          propia={c.usuario_id === usuario.id}
                          indice={0}
                          onZoom={() => setVisor({ lista: g.lista, inicio: i })}
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
        {visor && <Visor lista={visor.lista} inicio={visor.inicio} onCerrar={() => setVisor(null)} />}
      </AnimatePresence>
    </>
  );
}
