// "Fulano está escribiendo…": va aparte del chat para que el chat se baje recién al abrirlo.
import { useDatos } from "../lib/datos.jsx";

export const listaDeNombres = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0]);

// "Nahuel está escribiendo…" o "Juan está publicando su comida…", en vivo.
export function EnVivo({ que }) {
  const { presentes, perfiles } = useDatos();
  const nombres = Object.entries(presentes).filter(([, e]) => e[que]).map(([id]) => perfiles[id]?.nombre).filter(Boolean);
  if (!nombres.length) return null;
  const verbo = que === "escribiendo" ? "escribiendo" : "publicando su comida";
  return (
    <p className="en-vivo" role="status">
      <span className="puntos" aria-hidden="true"><i /><i /><i /></span>
      {listaDeNombres(nombres)} {nombres.length > 1 ? "están" : "está"} {verbo}…
    </p>
  );
}
