import { useEffect, useState } from "react";
import { Copy, Download, HeartPulse, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { ATAJO_SALUD, CORRER_ATAJO, NOMBRE_ATAJO } from "../lib/api.js";

const MODOS = [
  ["salud", "Usar lo de Apple Salud", "Lo que cargás en la app no cambia el total del día."],
  ["mayor", "Usar el valor mayor", "Compara cada dato y toma el más alto."],
  ["sumar", "Sumar todo", "Suma Apple Salud y lo cargado en la app."],
];

export default function AppleSalud({ avisar }) {
  const { usuario, yo, extras, cargarPerfiles } = useDatos();
  const [conectado, setConectado] = useState(null);
  const [token, setToken] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!extras.disponible) return;
    supabase.from("tokens_salud").select("usuario_id").eq("usuario_id", usuario.id).maybeSingle()
      .then(({ data, error }) => setConectado(error ? null : Boolean(data)));
  }, [extras.disponible, usuario.id]);

  if (conectado === null) return null;

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      return false;
    }
  }

  async function crear() {
    setOcupado(true);
    const { data, error } = await supabase.rpc("crear_token_salud");
    setOcupado(false);
    if (error) return avisar("No se pudo crear la llave");
    setToken(data);
    setConectado(true);
    avisar((await copiar(data)) ? "Llave creada y copiada" : "Llave creada: copiala con el botón");
  }

  async function elegirModo(modo) {
    const { error } = await supabase.from("perfiles").update({ modo_total: modo }).eq("id", usuario.id);
    if (error) return avisar("No se pudo guardar");
    await cargarPerfiles();
    avisar("Guardado");
  }

  return (
    <section className="tarjeta ajuste salud">
      <h2>Apple Salud</h2>
      <p className="ajuste-texto">Solo en iPhone. Trae todos los días las calorías y los macros que tengas en Salud.</p>

      <ol className="pasos-salud">
        <li>
          <strong>Creá tu llave</strong>
          <span>Se copia sola. Es personal: no la compartas.</span>
          <button className={conectado ? "boton boton-secundario" : "boton"} onClick={crear} disabled={ocupado}>
            <HeartPulse size={17} /> {conectado ? "Crear otra llave" : "Crear mi llave"}
          </button>
          {token && (
            <div className="dato-copiable">
              <code>{token}</code>
              <button className="boton-icono" onClick={async () => avisar((await copiar(token)) ? "Llave copiada" : "Mantené apretado el texto para copiarlo")} aria-label="Copiar llave"><Copy size={17} /></button>
            </div>
          )}
        </li>
        <li>
          <strong>Instalá el Atajo</strong>
          {ATAJO_SALUD ? (
            <>
              <span>Tocá Agregar atajo y, cuando te pida la llave, pegala.</span>
              <a className="boton boton-secundario" href={ATAJO_SALUD} target="_blank" rel="noreferrer"><Download size={17} /> Instalar Atajo</a>
            </>
          ) : (
            <span>Todavía no está publicado. Pedíselo a quien administra la app.</span>
          )}
        </li>
        <li>
          <strong>Que se actualice solo</strong>
          <span>En la app Atajos tocá Automatización y +. Creá estas, todas con Ejecutar inmediatamente y el Atajo {NOMBRE_ATAJO}:</span>
          <ul className="automatizaciones">
            <li><b>App:</b> elegí Salud y marcá Se cierra. Así se actualiza cada vez que cargás algo ahí.</li>
            <li><b>Hora del día:</b> una por cada horario que quieras, por ejemplo 9, 12, 15, 18, 21 y 23:30.</li>
          </ul>
          <span>Y cuando quieras, tocá Actualizar Salud en Resumen o acá.</span>
          {conectado && <a className="boton boton-secundario" href={CORRER_ATAJO}><RefreshCw size={17} /> Actualizar ahora</a>}
        </li>
      </ol>

      {yo.modo_total !== undefined && (
        <fieldset className="modo-total">
          <legend>Si un día tenés datos de Salud y también comidas cargadas</legend>
          {MODOS.map(([id, titulo, detalle]) => (
            <label key={id} className={yo.modo_total === id ? "activo" : ""}>
              <input type="radio" name="modo-total" checked={yo.modo_total === id} onChange={() => elegirModo(id)} />
              <span><strong>{titulo}</strong><small>{detalle}</small></span>
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
