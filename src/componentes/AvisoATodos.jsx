import { useState } from "react";
import { Megaphone, SendHorizontal } from "lucide-react";
import { mandarAnuncio } from "../lib/api.js";
import { vibrar } from "./Base.jsx";

// Panel del dueño: una notificación a todos (los que tienen los avisos prendidos y no apagaron "Anuncios de la app").
export const ANUNCIO_MEJORAS = {
  titulo: "💡 ¿Qué le mejorarías a Lomada Fuel?",
  cuerpo: "No te olvides de mandar tus pedidos de mejora en Ajustes › Mejoras. Los implementamos con el equipo de IT.",
  vista: "mejoras",
};
// La novedad del momento: viene elegida para mandarla con un toque.
export const ANUNCIO_HISTORIAS = {
  titulo: "📸 Nuevo: historias del día con estrellas ⭐",
  cuerpo: "Mirá lo que comió cada uno, comida por comida, como en Instagram. Puntuá los platos de 1 a 5 y peleá por ser el chef de la semana. Hay logros nuevos.",
  vista: "resumen",
};
const PLANTILLAS = [["Historias y estrellas", ANUNCIO_HISTORIAS], ["Mejoras", ANUNCIO_MEJORAS]];
const DESTINOS = [["mejoras", "Ajustes › Mejoras"], ["resumen", "Resumen"], ["chat", "Chat del grupo"]];

export default function AvisoATodos() {
  const [titulo, setTitulo] = useState(ANUNCIO_HISTORIAS.titulo);
  const [cuerpo, setCuerpo] = useState(ANUNCIO_HISTORIAS.cuerpo);
  const [vista, setVista] = useState(ANUNCIO_HISTORIAS.vista);
  function usar(plantilla) {
    setTitulo(plantilla.titulo);
    setCuerpo(plantilla.cuerpo);
    setVista(plantilla.vista);
    setSeguro(false);
    setEstado(null);
  }
  const [seguro, setSeguro] = useState(false);
  const [estado, setEstado] = useState(null);
  const listo = titulo.trim().length >= 3 && cuerpo.trim().length >= 3;

  async function mandar() {
    if (!seguro) return setSeguro(true);
    setEstado({ mandando: true });
    const r = await mandarAnuncio({ titulo: titulo.trim(), cuerpo: cuerpo.trim(), vista });
    setSeguro(false);
    vibrar(r.ok ? 15 : 8);
    setEstado(r);
  }

  return (
    <section className="tarjeta ajuste aviso-todos">
      <h3 className="perfil-subtitulo"><Megaphone size={16} /> Aviso a todos</h3>
      <div className="aviso-todos-plantillas" role="group" aria-label="Plantillas">
        {PLANTILLAS.map(([nombre, plantilla]) => (
          <button key={nombre} type="button" className={titulo === plantilla.titulo ? "ficha activa" : "ficha"} aria-pressed={titulo === plantilla.titulo} onClick={() => usar(plantilla)}>{nombre}</button>
        ))}
      </div>
      <label><span>Título</span><input value={titulo} maxLength={70} onChange={(e) => { setTitulo(e.target.value); setSeguro(false); }} /></label>
      <label><span>Texto</span><textarea rows={3} value={cuerpo} maxLength={200} onChange={(e) => { setCuerpo(e.target.value); setSeguro(false); }} /></label>
      <label><span>Al tocarla abre</span>
        <select value={vista} onChange={(e) => setVista(e.target.value)}>
          {DESTINOS.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
        </select>
      </label>
      <p className="nota">Así se ve en el celular:</p>
      <VistaPrevia titulo={titulo} cuerpo={cuerpo} />
      {estado?.ok && <p className="nota aviso-todos-ok" role="status">Mandado a {estado.enviadas} {estado.enviadas === 1 ? "celular" : "celulares"}.</p>}
      {estado && !estado.ok && !estado.mandando && <p className="error" role="alert">{estado.error}</p>}
      <button className={seguro ? "boton boton-peligro" : "boton"} onClick={mandar} disabled={!listo || estado?.mandando}>
        <SendHorizontal size={17} /> {estado?.mandando ? "Mandando…" : seguro ? "¿Seguro? Tocá de nuevo para mandar a todos" : "Mandar a todos"}
      </button>
    </section>
  );
}

// Como una notificación del iPhone.
export function VistaPrevia({ titulo, cuerpo }) {
  return (
    <div className="noti-previa" aria-label="Vista previa de la notificación">
      <img src="/disco-180.png" alt="" />
      <div>
        <p><strong>Lomada Fuel</strong><small>ahora</small></p>
        <strong className="noti-titulo">{titulo || "Título"}</strong>
        <span>{cuerpo || "Texto"}</span>
      </div>
    </div>
  );
}
