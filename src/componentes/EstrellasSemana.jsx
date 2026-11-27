import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { ChefHat, Crown, Star } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { aFecha, fechaLocal, haceDias } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { MIN_PLATOS_CHEF, MIN_VOTOS_PLATO, promedioTexto, rankingSemana } from "../lib/estrellas.js";
import { Avatar, Indicador, vibrar } from "./Base.jsx";
import Visor from "./Visor.jsx";

const diaMes = (f) => aFecha(f).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" });

// Las estrellas de la semana (de lunes a domingo): el chef (mejor promedio), el plato mejor puntuado y la tabla.
export default function EstrellasSemana() {
  const { usuario, perfiles, comidas, puntajes, fotos } = useDatos();
  const [cual, setCual] = useState("esta");
  const [viendo, setViendo] = useState(null);
  const fecha = cual === "esta" ? fechaLocal() : haceDias(7);
  const r = useMemo(() => rankingSemana({ comidas, puntajes: puntajes || [], perfiles, fecha }), [comidas, puntajes, perfiles, fecha]);
  if (!puntajes) return null;

  const enCurso = cual === "esta";
  const nombre = (p) => (p.id === usuario.id ? "Vos" : p.nombre);
  const plato = r.plato;
  const fotoPlato = plato && fotos[plato.comida.foto_path];

  return (
    <section className="tarjeta estrellas-semana" aria-label="Estrellas de la semana">
      <div className="estrellas-semana-cabecera">
        <h2><Star size={18} fill="currentColor" aria-hidden="true" /> Estrellas</h2>
        <span className="estrellas-semana-fechas">{diaMes(r.lunes)} al {diaMes(r.domingo)}</span>
      </div>
      <div className="selector" role="tablist" aria-label="Qué semana">
        {[["esta", "Esta semana"], ["pasada", "La pasada"]].map(([id, texto]) => (
          <button key={id} role="tab" aria-selected={cual === id} className={cual === id ? "activo" : ""} onClick={() => { setCual(id); vibrar(5); }}>
            <span>{texto}</span>
          </button>
        ))}
        <Indicador indice={cual === "esta" ? 0 : 1} total={2} />
      </div>

      <div className="ganadores">
        {r.chefs.length ? (
          <div className="ganador">
            <Crown size={18} className="ganador-corona" aria-hidden="true" />
            <small>{enCurso ? "Va ganando" : "Chef de la semana"}</small>
            <span className="ganador-foto"><Avatar perfil={r.chefs[0].perfil} tam={58} /></span>
            <strong>{r.chefs.map((c) => nombre(c.perfil)).join(" y ")}</strong>
            <span><Star size={12} fill="currentColor" aria-hidden="true" /> {promedioTexto(r.chefs[0].promedio)} · {r.chefs[0].votos} {r.chefs[0].votos === 1 ? "voto" : "votos"}</span>
          </div>
        ) : (
          <div className="ganador vacio">
            <ChefHat size={26} aria-hidden="true" />
            <small>Chef de la semana</small>
            <span>Hace falta tener {MIN_PLATOS_CHEF} platos puntuados</span>
          </div>
        )}
        {plato ? (
          <button type="button" className="ganador" onClick={() => plato.comida.foto_path && setViendo(plato.comida)} aria-label={`Plato de la semana: ${plato.comida.descripcion || tipoInfo(plato.comida.tipo).texto}`}>
            <small>Plato de la semana</small>
            <span className="ganador-foto">{fotoPlato ? <img src={fotoPlato} alt="" /> : null}</span>
            <strong>{plato.comida.descripcion || tipoInfo(plato.comida.tipo).texto}</strong>
            <span>{nombre(perfiles[plato.comida.usuario_id] || { nombre: "Alguien" })} · <Star size={12} fill="currentColor" aria-hidden="true" /> {promedioTexto(plato.promedio)}</span>
          </button>
        ) : (
          <div className="ganador vacio">
            <Star size={26} aria-hidden="true" />
            <small>Plato de la semana</small>
            <span>Hace falta un plato con {MIN_VOTOS_PLATO} votos</span>
          </div>
        )}
      </div>

      {r.personas.length > 0 ? (
        <ol className="tabla-estrellas">
          {r.personas.map((p, i) => (
            <li key={p.perfil.id}>
              <span className="lugar">{i + 1}</span>
              <Avatar perfil={p.perfil} tam={34} />
              <span className="datos">
                <strong>{nombre(p.perfil)}</strong>
                <small>{p.platos} {p.platos === 1 ? "plato" : "platos"} · {p.votos} {p.votos === 1 ? "voto" : "votos"}{p.cincos ? ` · ${p.cincos} ${p.cincos === 1 ? "plato perfecto" : "platos perfectos"}` : ""}</small>
              </span>
              <span className="promedio" aria-label={`Promedio ${promedioTexto(p.promedio)}`}><Star size={15} fill="currentColor" aria-hidden="true" /> {promedioTexto(p.promedio)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="estrellas-semana-nota">{enCurso ? "Todavía no hay estrellas esta semana. Abrí las historias del Resumen y puntuá los platos del grupo." : "La semana pasada nadie puntuó platos."}</p>
      )}
      {r.personas.length > 0 && <p className="estrellas-semana-nota">Gana el mejor promedio con al menos {MIN_PLATOS_CHEF} platos puntuados. El domingo a la noche se cierra la semana.</p>}

      <AnimatePresence>{viendo && <Visor lista={[viendo]} onCerrar={() => setViendo(null)} />}</AnimatePresence>
    </section>
  );
}
