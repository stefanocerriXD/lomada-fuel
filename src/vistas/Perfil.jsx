import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Award, Camera, Pencil, UtensilsCrossed } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { esDeAppleSalud } from "../lib/importar.js";
import { nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { cantidades, LOGROS, nivelesGuardados } from "../lib/medallas.js";
import { comidasFavoritas, estadisticas, porDia } from "../lib/perfil.js";
import { Indicador, Avatar, Hoja, Vacio, vibrar } from "../componentes/Base.jsx";
import DetalleLogro from "../componentes/DetalleLogro.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import NivelGeneral from "../componentes/NivelGeneral.jsx";
import { inicioSemana } from "../lib/multas.js";
import TarjetaLogro from "../componentes/TarjetaLogro.jsx";
import Visor from "../componentes/Visor.jsx";

const SECCIONES = [["dias", "Días"], ["fotos", "Fotos"], ["logros", "Logros"]];
// De otra persona no se ve su plan, su peso ni su agua: esos logros muestran solo el nivel.
const SOLO_PROPIOS = new Set(["proteina", "agua", "peso", "reto"]);
const numero = (v) => Math.round(v).toLocaleString("es-AR");

export default function Perfil({ onEditar, onEditarComida }) {
  const { perfiles, perfilId, abrirPerfil } = useDatos();
  const perfil = perfiles[perfilId];
  const cerrar = useCallback(() => abrirPerfil(null), [abrirPerfil]);
  return (
    <Hoja abierta={!!perfil} onCerrar={cerrar} titulo={perfil?.nombre || "Perfil"} ancha>
      {perfil && <Contenido key={perfil.id} perfil={perfil} onEditar={onEditar} onEditarComida={onEditarComida} />}
    </Hoja>
  );
}

function Contenido({ perfil, onEditar, onEditarComida }) {
  const { usuario, comidas, fotos, extras, cargarHistorial, perfiles, progreso, reacciones } = useDatos();
  const [abierto, setAbierto] = useState(null);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(false);
  const [seccion, setSeccion] = useState("dias");
  const [visor, setVisor] = useState(null);
  const propio = perfil.id === usuario.id;

  useEffect(() => {
    let activo = true;
    // Se vuelve a pedir cada vez que cambian las comidas: lo editado o borrado se ve al instante.
    cargarHistorial(perfil.id).then(
      (d) => {
        if (!activo) return;
        setLista(d);
        setError(false);
      },
      () => activo && setError(true),
    );
    return () => { activo = false; };
  }, [perfil.id, cargarHistorial, comidas]);

  const stats = useMemo(() => estadisticas(lista || []), [lista]);
  const dias = useMemo(() => porDia(lista || []), [lista]);
  const favoritas = useMemo(() => comidasFavoritas(lista || []), [lista]);
  const conFoto = useMemo(() => (lista || []).filter((c) => c.foto_path && fotos[c.foto_path]), [lista, fotos]);
  const niveles = useMemo(() => nivelesGuardados(extras.medallas.filter((m) => m.usuario_id === perfil.id).map((m) => m.codigo)), [extras.medallas, perfil.id]);
  const avance = useMemo(() => {
    if (propio) return progreso;
    return lista ? cantidades({ usuarioId: perfil.id, comidas: lista, agua: [], reacciones, perfiles, salud: null, pesos: [] }) : null;
  }, [lista, perfil.id, perfiles, progreso, propio, reacciones]);
  const logros = useMemo(() => LOGROS.filter((l) => niveles[l.codigo]).map((l) => ({
    logro: l,
    nivel: niveles[l.codigo],
    ...(avance && (propio || !SOLO_PROPIOS.has(l.codigo)) ? { cantidad: avance[l.codigo] || 0 } : {}),
  })), [avance, niveles, propio]);

  const cacasSemana = (extras.multas || []).filter((m) => m.usuario_id === perfil.id && m.fecha >= inicioSemana()).length;
  const abrirFoto = (comida) => setVisor({ lista: conFoto, inicio: Math.max(conFoto.findIndex((c) => c.id === comida.id), 0) });

  return (
    <div className="perfil">
      <div className="perfil-cabecera">
        <Avatar perfil={perfil} tam={68} />
        <div>
          {perfil.usuario && <strong>@{perfil.usuario}</strong>}
          <small>Meta: {numero(perfil.meta_calorias)} kcal por día</small>
          {perfil.caca === "evo" && <span className="sello-multas evo">BOCHA EVO esta semana</span>}
          {cacasSemana > 0 && <span className="sello-multas">{"💩".repeat(Math.min(cacasSemana, 7))} esta semana</span>}
          {propio && <button className="boton-texto" onClick={onEditar}><Pencil size={14} /> Editar perfil</button>}
        </div>
      </div>

      <div className="tarjeta nivel-propio"><NivelGeneral niveles={niveles} perfil={perfil} /></div>

      {error && <p className="error" role="alert">No pudimos traer el historial. Probá de nuevo.</p>}

      <ul className="perfil-stats">
        <li><strong>{stats.racha}</strong><small>Racha</small></li>
        <li><strong>{stats.dias}</strong><small>Días</small></li>
        <li><strong>{stats.fotos}</strong><small>Fotos</small></li>
        <li><strong>{numero(stats.kcal)}</strong><small>kcal por día</small></li>
        <li><strong>{stats.proteinas} g</strong><small>Prote por día</small></li>
        <li><strong>{logros.length}</strong><small>Logros</small></li>
      </ul>

      <div className="selector tres" role="tablist" aria-label="Sección del perfil">
        {SECCIONES.map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={seccion === id} className={seccion === id ? "activo" : ""} onClick={() => { setSeccion(id); vibrar(5); }}>
            <span>{texto}</span>
          </button>
        ))}
        <Indicador indice={SECCIONES.findIndex(([id]) => id === seccion)} total={SECCIONES.length} />
      </div>

      {lista === null && !error && <p className="nota">Cargando historial…</p>}

      {lista && seccion === "dias" && (
        dias.length ? (
          <ul className="perfil-dias">
            {dias.map((d) => (
              <li key={d.fecha}>
                <details className="tarjeta perfil-dia">
                  <summary>
                    <span className="perfil-dia-fecha">{nombreDia(d.fecha)}</span>
                    <strong>{numero(d.total.kcal)} kcal</strong>
                    <small>P {numero(d.total.p)} · C {numero(d.total.c)} · G {numero(d.total.g)}</small>
                  </summary>
                  <ul className="perfil-comidas">
                    {d.lista.filter((c) => !esDeAppleSalud(c)).map((c) => (
                      <li key={c.id}>
                        {c.foto_path && fotos[c.foto_path] ? (
                          <button className="perfil-miniatura" onClick={() => abrirFoto(c)} aria-label={`Ver foto: ${c.descripcion || tipoInfo(c.tipo).texto}`}>
                            <img src={fotos[c.foto_path]} alt="" loading="lazy" />
                          </button>
                        ) : (
                          <span className="perfil-miniatura sin-foto"><IconoComida tipo={c.tipo} size={19} /></span>
                        )}
                        <span className="perfil-comida-datos">
                          <strong>{c.descripcion || tipoInfo(c.tipo).texto}</strong>
                          <small>{tipoInfo(c.tipo).texto} · {numero(c.calorias || 0)} kcal · P {numero(c.proteinas || 0)} · C {numero(c.carbohidratos || 0)} · G {numero(c.grasas || 0)}</small>
                        </span>
                        {propio && <button className="boton-icono chico" onClick={() => onEditarComida(c)} aria-label={`Editar ${c.descripcion || tipoInfo(c.tipo).texto}`}><Pencil size={15} /></button>}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        ) : <Vacio icono={UtensilsCrossed} titulo="Todavía no hay comidas" />
      )}

      {lista && seccion === "fotos" && (
        conFoto.length ? (
          <ul className="galeria">
            {conFoto.map((c, i) => (
              <li key={c.id}>
                <button onClick={() => setVisor({ lista: conFoto, inicio: i })} aria-label={`Ver foto: ${c.descripcion || tipoInfo(c.tipo).texto}`}>
                  <img src={fotos[c.foto_path]} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        ) : <Vacio icono={Camera} titulo="Todavía no hay fotos" />
      )}

      {lista && seccion === "logros" && (
        <>
          <section>
            <h3 className="perfil-subtitulo">Comidas favoritas</h3>
            {favoritas.length ? (
              <ol className="perfil-favoritas">
                {favoritas.map((f, i) => (
                  <li key={f.nombre}>
                    <span className="ranking-lugar">{i + 1}</span>
                    <strong>{f.nombre}</strong>
                    <small>{f.veces} {f.veces === 1 ? "vez" : "veces"}</small>
                  </li>
                ))}
              </ol>
            ) : <p className="nota">Todavía no repitió ninguna comida.</p>}
          </section>
          <section>
            <h3 className="perfil-subtitulo">Logros</h3>
            {logros.length ? (
              <ul className="medallas">
                {logros.map(({ logro, nivel, cantidad }) => <TarjetaLogro key={logro.codigo} logro={logro} nivel={nivel} cantidad={cantidad} onAbrir={setAbierto} />)}
              </ul>
            ) : <Vacio icono={Award} titulo="Todavía sin logros" />}
          </section>
        </>
      )}

      <DetalleLogro abierto={abierto} onCerrar={() => setAbierto(null)} />
      <AnimatePresence>
        {visor && <Visor lista={visor.lista} inicio={visor.inicio} onCerrar={() => setVisor(null)} />}
      </AnimatePresence>
    </div>
  );
}

