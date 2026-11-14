import { useState } from "react";
import { ImageUp } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { vibrar } from "./Base.jsx";

const IMAGENES = [
  ["bocha", "dia", "Bocha", "Le aparece al que ayer no subió fotos."],
  ["bocha_evo", "evo", "Bocha Evo", "Le aparece toda la semana al que más cacas juntó."],
];

// Las reglas de la caca y, para quien administra, las imágenes del Bocha.
export default function LaCaca({ avisar }) {
  const { usuario, fotos, extras, imagenesBocha, cargarExtras, grupo } = useDatos();
  const [subiendo, setSubiendo] = useState(null);

  async function subir(clave, archivo) {
    if (!archivo) return;
    setSubiendo(clave);
    const extension = archivo.type === "image/webp" ? "webp" : archivo.type === "image/png" ? "png" : "jpg";
    const ruta = `${usuario.id}/bocha/${clave}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("fotos").upload(ruta, archivo, { contentType: archivo.type || "image/png" });
    const { error: errGuardar } = error ? { error } : await supabase.rpc("guardar_imagen_bocha", { p_clave: clave, p_ruta: ruta });
    setSubiendo(null);
    if (error || errGuardar) return avisar("No se pudo subir la imagen");
    vibrar(15);
    avisar("Imagen guardada");
    await cargarExtras();
  }

  if (!grupo.conBocha) {
    return (
      <section className="tarjeta ajuste la-caca">
        <ul className="la-caca-reglas">
          <li><strong>Mínimo 1 foto de comida por día.</strong> La foto del resumen del día no cuenta.</li>
          <li><strong>Si no subís ninguna,</strong> al día siguiente tenés 💩 al lado del nombre y ves borrosas las fotos de los demás, como en BeReal. Tampoco podés reaccionar.</li>
          <li><strong>Se levanta subiendo tu foto del día.</strong> La 💩 queda hasta el día siguiente.</li>
          <li>El bot cuenta en el chat solo a los que caen con caca por primera vez: el que ya venía con caca no se repite.</li>
          <li><strong>Dos semanas seguidas sin subir fotos:</strong> 💀 al lado del nombre y no ves ninguna foto del grupo, ni borrosa, hasta que subas la tuya.</li>
          <li>A las 22 te llega un aviso si todavía no subiste ninguna foto.</li>
        </ul>
      </section>
    );
  }

  return (
    <section className="tarjeta ajuste la-caca">
      <ul className="la-caca-reglas">
        <li><strong>Mínimo 1 foto de comida por día.</strong> La foto del resumen del día no cuenta.</li>
        <li><strong>Si no subís ninguna,</strong> al día siguiente tenés 💩 al lado del nombre y te cae la maldición del Bocha: se asoma, se ríe y te mancha la pantalla. Además ves borrosas las fotos del grupo, no podés reaccionar y en el chat solo podés mandar texto.</li>
        <li><strong>Se levanta subiendo tu foto del día.</strong> La 💩 queda hasta el día siguiente.</li>
        <li><strong>La caca se limpia fácil:</strong> tocá Limpiar y tocá o frotá las manchas.</li>
        <li><strong>El que más cacas junta en la semana</strong> se come al BOCHA EVO de lunes a domingo: app marrón, caca en la pantalla y el teclado del chat tapado. Le llega un aviso a todo el grupo.</li>
        <li><strong>Dos semanas seguidas sin subir fotos:</strong> 💀 al lado del nombre y no ves ninguna foto del grupo, ni borrosa, hasta que subas la tuya.</li>
        <li>En el chat el bot nombra solo a los que caen con caca por primera vez: el que ya venía con caca no se repite.</li>
        <li>A las 22 te llega un aviso si todavía no subiste ninguna foto.</li>
      </ul>

      {extras.admin && (!imagenesBocha.dia || !imagenesBocha.evo) && (
        <div className="la-caca-imagenes">
          <h3 className="perfil-subtitulo">Imágenes</h3>
          <small className="nota">Se cargan una sola vez. Después ya no se pueden cambiar desde la app.</small>
          {IMAGENES.filter(([, tipo]) => !imagenesBocha[tipo]).map(([clave, tipo, nombre, texto]) => (
            <div key={clave} className="la-caca-imagen">
              {fotos[imagenesBocha[tipo]] ? <img src={fotos[imagenesBocha[tipo]]} alt={nombre} /> : <span className="la-caca-vacia" aria-hidden="true">?</span>}
              <span>
                <strong>{nombre}</strong>
                <small>{texto}</small>
              </span>
              <label className={subiendo === clave ? "boton-chico ocupado" : "boton-chico"}>
                <ImageUp size={15} /> {subiendo === clave ? "Subiendo…" : "Subir"}
                <input className="oculto" type="file" accept="image/png,image/webp,image/jpeg" onChange={(e) => subir(clave, e.target.files[0])} disabled={Boolean(subiendo)} aria-label={`Imagen del ${nombre}`} />
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
