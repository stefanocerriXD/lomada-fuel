import { useState } from "react";
import { ImageUp, Undo2 } from "lucide-react";
import { DIBUJOS_BOCHA } from "./Bocha.jsx";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { vibrar } from "./Base.jsx";
import { comprimirImagen } from "../lib/imagen.js";

const IMAGENES = [
  ["bocha", "dia", "Bocha", "Le aparece al que ayer no subió fotos."],
  ["bocha_evo", "evo", "Bocha Evo", "Le aparece el lunes, todo el día, al que más caconas juntó en la semana."],
];

// Las reglas de la caca y, para quien administra, las imágenes del Bocha.
export default function LaCaca({ avisar }) {
  const { usuario, fotos, extras, imagenesBocha, cargarExtras, grupo } = useDatos();
  const [subiendo, setSubiendo] = useState(null);
  const porGrupo = Boolean(imagenesBocha.porGrupo);

  async function usarDibujo(clave) {
    setSubiendo(clave);
    const { error } = await supabase.rpc("guardar_bocha_grupo", { p_clave: clave, p_ruta: null });
    setSubiendo(null);
    if (error) return avisar("No se pudo cambiar");
    vibrar(10);
    avisar("Listo: vuelve el dibujo");
    await cargarExtras();
  }

  async function subir(clave, archivo) {
    if (!archivo) return;
    setSubiendo(clave);
    // Se achica antes de subirla (los GIF quedan como están para no perder el movimiento; los PNG, con su transparencia).
    let imagen = archivo;
    if (archivo.type !== "image/gif") {
      const transparente = archivo.type === "image/png" || archivo.type === "image/webp";
      const chica = await comprimirImagen(archivo, 1024, 0.85, transparente ? "image/webp" : "image/jpeg").catch(() => null);
      if (chica && chica.size < archivo.size) imagen = chica;
    }
    const extension = { "image/webp": "webp", "image/png": "png", "image/gif": "gif" }[imagen.type] || "jpg";
    const ruta = `${usuario.id}/bocha/${clave}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("fotos").upload(ruta, imagen, { contentType: imagen.type || "image/png" });
    const { error: errGuardar } = error ? { error } : await supabase.rpc(porGrupo ? "guardar_bocha_grupo" : "guardar_imagen_bocha", { p_clave: clave, p_ruta: ruta });
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
          <li>El bot cuenta en el chat solo a los que caen con cacona por primera vez: el que ya venía con cacona no se repite.</li>
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
        <li><strong>La cacona se limpia fácil:</strong> tocá Limpiar y tocá o frotá las manchas.</li>
        <li><strong>El que más caconas junta en la semana</strong> se come al BOCHA EVO de lunes a domingo: app marrón, cacona en la pantalla y el teclado del chat tapado. Le llega un aviso a todo el grupo.</li>
        <li><strong>Dos semanas seguidas sin subir fotos:</strong> 💀 al lado del nombre y no ves ninguna foto del grupo, ni borrosa, hasta que subas la tuya.</li>
        <li>En el chat el bot nombra solo a los que caen con cacona por primera vez: el que ya venía con cacona no se repite.</li>
        <li>A las 22 te llega un aviso si todavía no subiste ninguna foto.</li>
      </ul>

      {extras.puedeBocha && (porGrupo || !imagenesBocha.dia || !imagenesBocha.evo) && (
        <div className="la-caca-imagenes">
          <h3 className="perfil-subtitulo">Imágenes del Bocha</h3>
          <small className="nota">{porGrupo ? "Son las de este grupo y las cambiás cuando quieras. Si no subís ninguna, sale el dibujo." : "Se cargan una sola vez. Después ya no se pueden cambiar desde la app."}</small>
          {IMAGENES.filter(([, tipo]) => porGrupo || !imagenesBocha[tipo]).map(([clave, tipo, nombre, texto]) => {
            const ruta = imagenesBocha[tipo];
            const src = ruta ? fotos[ruta] : DIBUJOS_BOCHA[tipo];
            return (
              <div key={clave} className="la-caca-imagen">
                {src ? <img src={src} alt={nombre} /> : <span className="la-caca-vacia" aria-hidden="true">?</span>}
                <span>
                  <strong>{nombre}</strong>
                  <small>{texto}{porGrupo && !ruta ? " Ahora sale el dibujo." : ""}</small>
                </span>
                <span className="la-caca-botones">
                  <label className={subiendo === clave ? "boton-chico ocupado" : "boton-chico"}>
                    <ImageUp size={15} /> {subiendo === clave ? "Subiendo…" : ruta ? "Cambiar" : "Subir"}
                    <input className="oculto" type="file" accept="image/png,image/webp,image/jpeg,image/gif" onChange={(e) => subir(clave, e.target.files[0])} disabled={Boolean(subiendo)} aria-label={`Imagen del ${nombre}`} />
                  </label>
                  {porGrupo && ruta && (
                    <button type="button" className="boton-chico" onClick={() => usarDibujo(clave)} disabled={Boolean(subiendo)}><Undo2 size={14} /> Dibujo</button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
