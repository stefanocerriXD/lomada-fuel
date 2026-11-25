import { useCallback, useEffect, useMemo, useState } from "react";
import { IconoCorona, IconoGol, IconoResaca, IconoTrago } from "../componentes/IconosFiesta.jsx";
import { abrirFestejo } from "../lib/fiestaEstado.js";
import { AnimatePresence } from "motion/react";
import { Award, Camera, Pencil, Pin, UtensilsCrossed } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { esDeAppleSalud } from "../lib/importar.js";
import { nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { cantidades, LOGROS, nivelGeneral, nivelesGuardados } from "../lib/medallas.js";
import { comidasFavoritas, estadisticas, porDia } from "../lib/perfil.js";
import { Indicador, Avatar, Hoja, Vacio, vibrar } from "../componentes/Base.jsx";
import DetalleLogro from "../componentes/DetalleLogro.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import NivelGeneral from "../componentes/NivelGeneral.jsx";
import { inicioSemana } from "../lib/multas.js";
import TarjetaLogro from "../componentes/TarjetaLogro.jsx";
import Visor from "../componentes/Visor.jsx";
import Destacadas from "../componentes/Destacadas.jsx";
import { useFotoPerfil, VerFotoPerfil } from "../componentes/FotoPerfil.jsx";

const SECCIONES = [["dias", "Días"], ["fotos", "Fotos"], ["logros", "Logros"]];
// De otra persona no se ve su plan, su peso ni su agua: esos logros muestran solo el nivel.
const SOLO_PROPIOS = new Set(["proteina", "agua", "peso", "reto", "gym", "creatina", "futbol", "running", "padel", "caminata"]);
const numero = (v) => Math.round(v).toLocaleString("es-AR");

export default function Perfil({ onEditar, onEditarComida, avisar }) {
  const { perfiles, perfilId, abrirPerfil } = useDatos();
  const perfil = perfiles[perfilId];
  const cerrar = useCallback(() => abrirPerfil(null), [abrirPerfil]);
  return (
    <Hoja abierta={!!perfil} onCerrar={cerrar} titulo={perfil?.nombre || "Perfil"} ancha>
      {perfil && <Contenido key={perfil.id} perfil={perfil} onEditar={onEditar} onEditarComida={onEditarComida} avisar={avisar} />}
    </Hoja>
  );
}

// Hasta 3 fotos fijadas arriba de todo en la galería del perfil (SQL 065).
const MAX_FIJADAS = 3;

function Contenido({ perfil, onEditar, onEditarComida, avisar }) {
  const { usuario, comidas, fotos, extras, cargarHistorial, perfiles, progreso, reacciones, castigo } = useDatos();
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
  // Las fijadas primero (la última que fijaste, arriba de todo); después, las demás como venían.
  const conFoto = useMemo(() => {
    const todas = (lista || []).filter((c) => c.foto_path && fotos[c.foto_path]);
    const fijadas = todas.filter((c) => c.fijada_en).sort((a, b) => (a.fijada_en < b.fijada_en ? 1 : -1));
    return [...fijadas, ...todas.filter((c) => !c.fijada_en)];
  }, [lista, fotos]);
  const sePuedeFijar = propio && (lista || []).some((c) => "fijada_en" in c);
  const cantidadFijadas = conFoto.filter((c) => c.fijada_en).length;

  async function alternarFijada(c) {
    if (!c.fijada_en && cantidadFijadas >= MAX_FIJADAS) return avisar?.(`Podés fijar hasta ${MAX_FIJADAS} fotos. Soltá una para fijar otra.`);
    const fijada_en = c.fijada_en ? null : new Date().toISOString();
    const { error: err } = await supabase.from("comidas").update({ fijada_en }).eq("id", c.id);
    if (err) return avisar?.(/demasiadas_fijadas/.test(err.message || "") ? `Podés fijar hasta ${MAX_FIJADAS} fotos.` : "No se pudo fijar la foto");
    vibrar(10);
    setLista((prev) => prev.map((x) => (x.id === c.id ? { ...x, fijada_en } : x)));
    avisar?.(fijada_en ? "Foto fijada arriba de tu perfil" : "Foto soltada");
  }
  const niveles = useMemo(() => nivelesGuardados(extras.medallas.filter((m) => m.usuario_id === perfil.id).map((m) => m.codigo)), [extras.medallas, perfil.id]);
  const nivel = useMemo(() => nivelGeneral(niveles).nivel, [niveles]);
  const avance = useMemo(() => {
    if (propio) return progreso;
    return lista ? cantidades({ usuarioId: perfil.id, comidas: lista, agua: [], reacciones, perfiles, salud: null, pesos: [] }) : null;
  }, [lista, perfil.id, perfiles, progreso, propio, reacciones]);
  const logros = useMemo(() => LOGROS.filter((l) => niveles[l.codigo]).map((l) => ({
    logro: l,
    nivel: niveles[l.codigo],
    ...(avance && (propio || !SOLO_PROPIOS.has(l.codigo)) ? { cantidad: avance[l.codigo] || 0 } : {}),
  })), [avance, niveles, propio]);

  const [verFoto, setVerFoto] = useState(false);
  const cambiarFoto = useFotoPerfil(avisar);
  const cacasSemana = (extras.multas || []).filter((m) => m.usuario_id === perfil.id && m.fecha >= inicioSemana()).length;
  const abrirFoto = (comida) => setVisor({ lista: conFoto, inicio: Math.max(conFoto.findIndex((c) => c.id === comida.id), 0) });

  return (
    <div className={castigo.calavera && !propio ? "perfil fotos-ocultas" : "perfil"}>
      {propio && cambiarFoto.elementos}
      <VerFotoPerfil
        perfil={perfil}
        abierta={verFoto}
        propio={propio}
        onCerrar={() => setVerFoto(false)}
        onCambiar={() => { setVerFoto(false); cambiarFoto.elegir(); }}
        onQuitar={() => { setVerFoto(false); cambiarFoto.quitar(); }}
      />
      {/* Como en Instagram: la foto con tres números al lado, y abajo el nombre, la bio y lo demás. */}
      <div className="perfil-ig">
        <div className="perfil-ig-fila">
          {perfil.foto || propio ? (
            <button type="button" className="perfil-avatar" onClick={() => { setVerFoto(true); vibrar(5); }} aria-label={perfil.foto ? `Ver foto de perfil de ${perfil.nombre}` : "Poner foto de perfil"}>
              <Avatar perfil={perfil} tam={84} />
              {propio && <span className="perfil-avatar-camara" aria-hidden="true"><Camera size={13} /></span>}
            </button>
          ) : <Avatar perfil={perfil} tam={84} />}
          <ul className="perfil-ig-numeros">
            <li><strong>{lista ? stats.fotos : "–"}</strong><small>Fotos</small></li>
            <li><strong>{lista ? stats.racha : "–"}</strong><small>Racha</small></li>
            <li><strong>{nivel}</strong><small>Nivel</small></li>
          </ul>
        </div>
        <div className="perfil-ig-datos">
          <strong>{perfil.nombre}</strong>
          {perfil.usuario && <small className="perfil-usuario">@{perfil.usuario}</small>}
          {perfil.bio && <p className="perfil-bio">{perfil.bio}</p>}
          <small>Meta: {numero(perfil.meta_calorias)} kcal por día</small>
          {perfil.fiesta && (
            <button type="button" className={`sello-multas sello-fiesta ${perfil.fiesta.modo}${perfil.fiesta.gol && perfil.fiesta.modo === "resaca" ? " gol" : ""}`} onClick={() => abrirFestejo(perfil.id)}>
              {perfil.fiesta.modo === "fiesta"
                ? <><IconoTrago tam={15} /> En modo fiesta · {perfil.fiesta.vasos} {perfil.fiesta.vasos === 1 ? "vaso" : "vasos"}</>
                : perfil.fiesta.gol ? <><IconoCorona tam={15} /><IconoGol tam={15} /> Hizo gol anoche</> : <><IconoResaca tam={15} /> Resaca: salió anoche</>}
            </button>
          )}
          {perfil.calavera && <span className="sello-multas calavera">💀 Dos semanas sin subir fotos</span>}
          {perfil.caca === "evo" && <span className="sello-multas evo">BOCHA EVO esta semana</span>}
          {cacasSemana > 0 && <span className="sello-multas">{"💩".repeat(Math.min(cacasSemana, 7))} esta semana</span>}
        </div>
        {propio && <button className="boton boton-secundario perfil-editar" onClick={onEditar}><Pencil size={15} /> Editar perfil</button>}
      </div>

      <Destacadas perfil={perfil} propio={propio} fotosComidas={propio ? conFoto : []} avisar={avisar} />

      <div className="tarjeta nivel-propio"><NivelGeneral niveles={niveles} perfil={perfil} /></div>

      {error && <p className="error" role="alert">No pudimos traer el historial. Probá de nuevo.</p>}

      <ul className="perfil-stats">
        <li><strong>{stats.dias}</strong><small>Días</small></li>
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
                          <small>{c.planeada ? "Planeada · " : ""}{tipoInfo(c.tipo).texto} · {numero(c.calorias || 0)} kcal · P {numero(c.proteinas || 0)} · C {numero(c.carbohidratos || 0)} · G {numero(c.grasas || 0)}</small>
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
              <li key={c.id} className={c.fijada_en ? "fijada" : undefined}>
                <button onClick={() => setVisor({ lista: conFoto, inicio: i })} aria-label={`Ver foto: ${c.descripcion || tipoInfo(c.tipo).texto}${c.fijada_en ? " (fijada)" : ""}`}>
                  <img src={fotos[c.foto_path]} alt="" loading="lazy" />
                </button>
                {sePuedeFijar ? (
                  <button type="button" className={c.fijada_en ? "fijar activo" : "fijar"} onClick={() => alternarFijada(c)} aria-pressed={!!c.fijada_en} aria-label={c.fijada_en ? `Soltar la foto ${c.descripcion || tipoInfo(c.tipo).texto}` : `Fijar la foto ${c.descripcion || tipoInfo(c.tipo).texto}`}>
                    <Pin size={14} fill={c.fijada_en ? "currentColor" : "none"} />
                  </button>
                ) : c.fijada_en ? (
                  <span className="fijar activo" aria-hidden="true"><Pin size={14} fill="currentColor" /></span>
                ) : null}
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

