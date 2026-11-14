import { motion } from "motion/react";
import { Reply } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { haceCuanto } from "../lib/fechas.js";
import { marcaDelNombre } from "../lib/multas.js";
import { Avatar } from "./Base.jsx";
import { MarcaFiesta } from "./MarcaFiesta.jsx";
import { IconoGol } from "./IconosFiesta.jsx";
import { CarruselFotos, Reacciones } from "./TarjetaComida.jsx";

const vasosDe = (c) => (Array.isArray(c.alimentos) ? c.alimentos : []);
const numero = (n) => Math.round(n).toLocaleString("es-AR");

// Los tragos de cada uno, agrupados: "3 × Fernet con coca, 1 × Gin tonic".
function tragosDe(c) {
  const grupos = vasosDe(c).reduce((t, v) => ({ ...t, [v.nombre]: (t[v.nombre] || 0) + 1 }), {});
  return Object.entries(grupos).map(([nombre, n]) => `${n} × ${nombre}`).join(", ");
}

// Una salida en grupo: las fotos de todos y lo que tomó cada uno, del que más al que menos.
export default function TarjetaSalida({ miembros, onZoom, avisar }) {
  const { perfiles, usuario, fotos, castigo, responder, abrirPerfil } = useDatos();
  const principal = miembros.find((c) => c.id === c.salida) || miembros[0];
  const ranking = [...miembros].sort((a, b) => vasosDe(b).length - vasosDe(a).length || (b.calorias || 0) - (a.calorias || 0));
  const nombre = (c) => (c.usuario_id === usuario.id ? "Vos" : perfiles[c.usuario_id]?.nombre || "Amigo");

  // Las fotos de todos, en orden; cada una recuerda de quién es para abrirla en el visor.
  const fotosSalida = miembros.flatMap((c) => [c.foto_path, ...(c.fotos_extra || [])].filter(Boolean).map((ruta, n) => ({ comida: c, n, src: fotos[ruta] })));
  const propia = (c) => c.usuario_id === usuario.id;
  const oculta = castigo.calavera && miembros.some((c) => !propia(c));
  const tapada = castigo.diario && miembros.some((c) => !propia(c));
  const ampliar = (i = 0) => {
    if (oculta || tapada) return avisar?.(oculta ? "Hace dos semanas que no subís fotos. Subí la tuya para volver a ver las del grupo." : "Subí tu foto de hoy para ver las del grupo.");
    const f = fotosSalida[i];
    if (f) onZoom(f.comida, f.n);
  };

  const goles = miembros.filter((c) => c.gol === true).length;
  const marcados = miembros.filter((c) => typeof c.gol === "boolean").length;
  const cartel = goles
    ? <span className="cartel-gol si"><IconoGol tam={18} /> {goles === 1 ? "¡HUBO GOL!" : `${goles} GOLES`}</span>
    : marcados ? <span className="cartel-gol no"><IconoGol tam={18} apagado /> SIN GOL</span> : null;
  const totalVasos = miembros.reduce((t, c) => t + vasosDe(c).length, 0);
  const totalKcal = miembros.reduce((t, c) => t + (c.calorias || 0), 0);

  return (
    <motion.article className="tarjeta comida salida" layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
      <header className="salida-cabecera">
        <span className="salida-avatares">
          {ranking.slice(0, 5).map((c) => <Avatar key={c.id} perfil={perfiles[c.usuario_id]} tam={34} />)}
        </span>
        <span>
          <strong>🪩 Salida en grupo</strong>
          <small>{ranking.map(nombre).join(", ")} · {haceCuanto(principal.creado_en)}</small>
        </span>
      </header>

      {fotosSalida.length > 0 && (oculta ? (
        <button className="comida-foto foto-oculta" onClick={() => ampliar()} aria-label="Fotos ocultas">
          <span className="foto-oculta-texto"><span aria-hidden="true">💀</span> Dos semanas sin subir fotos.<small>Subí la tuya para volver a ver las del grupo.</small></span>
        </button>
      ) : (
        <CarruselFotos srcs={fotosSalida.map((f) => f.src)} alt="Fotos de la salida" onZoom={ampliar} tapada={tapada} encima={cartel} />
      ))}
      {!fotosSalida.length && cartel && <div className="comida-sinfoto fiesta-sinfoto">{cartel}<strong>{totalVasos} vasos entre todos</strong></div>}

      <div className="comida-cuerpo">
        <ul className="salida-ranking" aria-label="Lo que tomó cada uno">
          {ranking.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => abrirPerfil(c.usuario_id)} aria-label={`Ver perfil de ${nombre(c)}`}><Avatar perfil={perfiles[c.usuario_id]} tam={32} /></button>
              <span className="salida-nombre">
                <strong>{nombre(c)}{marcaDelNombre(perfiles[c.usuario_id])}<MarcaFiesta perfil={perfiles[c.usuario_id]} /> · {vasosDe(c).length} {vasosDe(c).length === 1 ? "vaso" : "vasos"}</strong>
                <small>{vasosDe(c).length ? `${tragosDe(c)} · ${numero(c.calorias || 0)} kcal` : "Todavía no cargó vasos"}</small>
              </span>
              {typeof c.gol === "boolean" ? <span className={c.gol ? "salida-gol si" : "salida-gol no"}><IconoGol tam={14} apagado={!c.gol} /> {c.gol ? "Gol" : "No"}</span> : <span />}
            </li>
          ))}
        </ul>
        <p className="salida-total">Entre todos: {totalVasos} {totalVasos === 1 ? "vaso" : "vasos"} · {numero(totalKcal)} kcal</p>
        <div className="comida-interacciones">
          <Reacciones comidaId={principal.id} avisar={avisar} />
          <button className="boton-texto" onClick={() => responder(principal)} aria-label="Responder en el chat"><Reply size={15} /> Responder</button>
        </div>
      </div>
    </motion.article>
  );
}
