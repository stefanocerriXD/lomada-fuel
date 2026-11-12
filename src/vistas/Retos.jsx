import { useState } from "react";
import { Trophy } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { LOGROS, nivelGeneral, nivelesGuardados } from "../lib/medallas.js";
import { Avatar, Vacio } from "../componentes/Base.jsx";
import DetalleLogro from "../componentes/DetalleLogro.jsx";
import NivelGeneral from "../componentes/NivelGeneral.jsx";
import TarjetaLogro from "../componentes/TarjetaLogro.jsx";
import Multas from "../componentes/Multas.jsx";

// Los logros de cada uno, el nivel del grupo y, al final, la maldición del Bocha.
export default function Retos() {
  const { extras, grupo } = useDatos();

  if (!extras.disponible) {
    return <Vacio icono={Trophy} titulo="Los logros todavía no están activos" texto="Se activan al terminar la configuración de la base de datos." />;
  }

  return (
    <>
      <header className="titulo-vista">
        <div>
          <p className="sobretitulo">Tu nivel y el del grupo</p>
          <h1>Logros</h1>
        </div>
      </header>

      <section>
        <Medallas />
      </section>

      {extras.multasActivas && (
        <section>
          <h2 className="titulo-seccion">{grupo.conBocha ? "La maldición del Bocha" : "La caca 💩"}</h2>
          <Multas />
        </section>
      )}
    </>
  );
}

function Medallas() {
  const { usuario, extras, perfiles, progreso, abrirPerfil } = useDatos();
  const [abierto, setAbierto] = useState(null);
  const nivelesDe = (id) => nivelesGuardados(extras.medallas.filter((m) => m.usuario_id === id).map((m) => m.codigo));
  const otros = Object.values(perfiles)
    .filter((p) => p.id !== usuario.id)
    .map((p) => ({ perfil: p, general: nivelGeneral(nivelesDe(p.id)) }))
    .sort((a, b) => b.general.puntos - a.general.puntos);

  return (
    <>
      <div className="tarjeta nivel-propio"><NivelGeneral niveles={nivelesDe(usuario.id)} /></div>
      {[["objetivos", "Objetivos"], ["alimentacion", "Alimentación"]].map(([grupo, titulo]) => (
        <div key={grupo} className="grupo-medallas">
          <h3 className="perfil-subtitulo">{titulo}</h3>
          <ul className="medallas">
            {LOGROS.filter((l) => l.grupo === grupo).map((l) => <TarjetaLogro key={l.codigo} logro={l} cantidad={progreso?.[l.codigo] || 0} onAbrir={setAbierto} />)}
          </ul>
        </div>
      ))}
      {otros.length > 0 && (
        <div className="medallas-grupo">
          <h3>El grupo</h3>
          <ul>
            {otros.map(({ perfil: p, general }) => (
              <li key={p.id}><button onClick={() => abrirPerfil(p.id)}><Avatar perfil={p} tam={28} /> <span>{p.nombre}</span> <strong>Nivel {general.nivel}</strong></button></li>
            ))}
          </ul>
        </div>
      )}
      <DetalleLogro abierto={abierto} onCerrar={() => setAbierto(null)} />
    </>
  );
}
