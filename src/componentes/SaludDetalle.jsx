import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { haceDias, nombreDia } from "../lib/fechas.js";

const DIAS = 3;
const URL_PARA_SALUD = "https://lomada-fuel.vercel.app/api/para-salud";
const hora = (iso) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
const miles = (n) => Math.round(Number(n) || 0).toLocaleString("es-AR");

function porDia(filas, campoFecha) {
  const dias = new Map();
  for (const f of filas) {
    const lista = dias.get(f[campoFecha]) || [];
    lista.push(f);
    dias.set(f[campoFecha], lista);
  }
  return [...dias.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

// Cada comida que llegó de Apple Salud, día por día: para comparar con MyFitnessPal si un total no coincide.
export function LoQueLlego() {
  const { usuario } = useDatos();
  const [filas, setFilas] = useState(null);
  useEffect(() => {
    supabase.from("salud_comidas").select("fecha, momento, kcal, proteinas, carbohidratos, grasas").eq("usuario_id", usuario.id)
      .gte("fecha", haceDias(DIAS - 1)).order("momento", { ascending: true })
      .then(({ data, error }) => setFilas(error ? null : data || []));
  }, [usuario.id]);
  if (!filas) return null;
  return (
    <section className="tarjeta ajuste con-titulo salud-detalle">
      <h3 className="perfil-subtitulo">Lo que llegó de Apple Salud</h3>
      {filas.length === 0 ? (
        <p className="ajuste-texto">Todavía no llegó ninguna comida en los últimos {DIAS} días.</p>
      ) : (
        <>
          <p className="ajuste-texto">Cada comida con su hora. Si un día no coincide con MyFitnessPal, fijate cuál falta: puede que MyFitnessPal todavía no la haya pasado a Salud, o que el Atajo no haya corrido después del cambio.</p>
          {porDia(filas, "fecha").map(([fecha, lista]) => (
            <div key={fecha} className="salud-dia">
              <p className="salud-dia-titulo"><strong>{nombreDia(fecha)}</strong><span>{miles(lista.reduce((t, f) => t + f.kcal, 0))} kcal</span></p>
              <ul>
                {lista.map((f) => (
                  <li key={f.momento}><span>{hora(f.momento)}</span><span>{miles(f.kcal)} kcal · P {Math.round(f.proteinas)} · C {Math.round(f.carbohidratos)} · G {Math.round(f.grasas)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// Lomada -> Apple Salud (para WHOOP): los pasos del Atajo y lo que ya se mandó.
export function MandarASalud({ avisar }) {
  const { usuario } = useDatos();
  const [mandadas, setMandadas] = useState(null);
  useEffect(() => {
    supabase.from("salud_exportadas").select("fecha, momento, kcal").eq("usuario_id", usuario.id)
      .gte("fecha", haceDias(DIAS - 1)).order("momento", { ascending: true })
      .then(({ data, error }) => setMandadas(error ? undefined : data || []));
  }, [usuario.id]);
  // Sin el SQL 057 todavía no está disponible.
  if (mandadas === undefined || mandadas === null) return null;

  async function copiarUrl() {
    try {
      await navigator.clipboard.writeText(URL_PARA_SALUD);
      avisar("Dirección copiada");
    } catch {
      avisar("Mantené apretada la dirección para copiarla");
    }
  }

  return (
    <section className="tarjeta ajuste con-titulo salud-mandar">
      <h3 className="perfil-subtitulo">Mandá tus comidas a Apple Salud</h3>
      <p className="ajuste-texto">Para que WHOOP (u otra app) vea lo que cargás en Lomada. Cada comida se manda una sola vez, a la noche. Lo que vino de Apple Salud o importaste de otra app no se manda: ya está en Salud.</p>
      <ol className="pasos-salud">
        <li>
          <strong>Copiá tu llave</strong>
          <span>Abrí el Atajo de Apple Salud que ya tenés, mantené apretado el primer bloque (el Texto con tu llave) y tocá Copiar. No crees una llave nueva: el otro Atajo dejaría de andar.</span>
        </li>
        <li>
          <strong>Armá el Atajo "Lomada a Salud"</strong>
          <span>En Atajos tocá + y pegá el bloque de la llave. Después agregá, en este orden:</span>
          <ul className="automatizaciones">
            <li><b>Obtener contenido de URL</b> con esta dirección. En Mostrar más: Método POST, Cuerpo JSON y un campo Texto <code>token</code> con el Texto de tu llave.</li>
            <li><b>Obtener valor del diccionario</b>: clave <code>comidas</code> del Contenido de URL.</li>
            <li><b>Repetir con cada</b> elemento de ese valor. Adentro: cinco <b>Obtener valor del diccionario</b> del Elemento de repetición, con las claves <code>fecha</code>, <code>kcal</code>, <code>proteinas</code>, <code>carbohidratos</code> y <code>grasas</code>.</li>
            <li>Y adentro también, cuatro <b>Registrar muestra de salud</b>: Energía alimentaria con kcal, Proteína con proteinas, Carbohidratos con carbohidratos y Grasa total con grasas. En todas, Fecha: el valor de fecha.</li>
          </ul>
          <div className="dato-copiable">
            <code>{URL_PARA_SALUD}</code>
            <button className="boton-icono" onClick={copiarUrl} aria-label="Copiar dirección"><Copy size={16} /></button>
          </div>
        </li>
        <li>
          <strong>Que corra solo a la noche</strong>
          <span>Automatización y +: Hora del día 23:50, Diariamente, Ejecutar inmediatamente, Atajo "Lomada a Salud". WHOOP lee el día a la mañana siguiente.</span>
        </li>
      </ol>
      <p className="nota">Lo que edites o borres después de mandarlo no cambia en Salud (los Atajos no pueden borrar de Salud). Por eso se manda a la noche, con el día cerrado.</p>
      {mandadas.length > 0 && (
        <div className="salud-dia">
          <p className="salud-dia-titulo"><strong>Mandado a Salud</strong><span>últimos {DIAS} días</span></p>
          <ul>
            {porDia(mandadas, "fecha").map(([fecha, lista]) => (
              <li key={fecha}><span>{nombreDia(fecha)}</span><span>{lista.length} {lista.length === 1 ? "comida" : "comidas"} · {miles(lista.reduce((t, f) => t + f.kcal, 0))} kcal</span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
