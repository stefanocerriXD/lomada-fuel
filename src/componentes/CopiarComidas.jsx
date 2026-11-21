import { useState } from "react";
import { CalendarClock, Copy } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, haceDias, nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Hoja, vibrar } from "./Base.jsx";
import IconoComida from "./IconoComida.jsx";

// Las comidas que se pueden repetir: con alimentos o calorías (no la foto sola, ni la fiesta, ni los resúmenes).
export const copiables = (lista) => lista.filter((c) => !["resumen", "fiesta"].includes(c.tipo) && ((c.calorias || 0) > 0 || (c.alimentos || []).some((a) => a.fuente !== "foto")));

const ORDEN = ["desayuno", "almuerzo", "merienda", "cena", "colacion"];

// Copia una combinación de comidas a otro día. Quedan planeadas (SQL 062): sin foto y sin aviso
// hasta que se comen y se toca "Ya la comí".
export default function CopiarComidas({ abierta, onCerrar, comidas, fecha, onListo, avisar }) {
  const { usuario, cargarComidas, comidas: todas } = useDatos();
  const hoy = fechaLocal();
  const destinos = [hoy, haceDias(-1), haceDias(-2)].filter((d) => d !== fecha);
  const [destino, setDestino] = useState(() => (fecha < hoy ? hoy : haceDias(-1)));
  const lista = [...copiables(comidas)].sort((a, b) => ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo));
  const [elegidas, setElegidas] = useState(() => new Set(lista.map((c) => c.id)));
  const [guardando, setGuardando] = useState(false);
  const columnaPlaneada = todas.some((c) => "planeada" in c);
  const alternar = (id) => setElegidas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const kcal = lista.filter((c) => elegidas.has(c.id)).reduce((t, c) => t + (c.calorias || 0), 0);

  async function copiar() {
    const filas = lista.filter((c) => elegidas.has(c.id)).map((c) => ({
      id: crypto.randomUUID(),
      usuario_id: usuario.id,
      fecha: destino,
      tipo: c.tipo,
      descripcion: c.descripcion,
      calorias: c.calorias,
      proteinas: c.proteinas,
      carbohidratos: c.carbohidratos,
      grasas: c.grasas,
      macros_editados: c.macros_editados,
      alimentos: (c.alimentos || []).filter((a) => a.fuente !== "foto"),
      ...("privada" in c ? { privada: c.privada } : {}),
      ...(c.grupos ? { grupos: c.grupos } : {}),
      ...(columnaPlaneada ? { planeada: true } : {}),
    }));
    if (!filas.length) return;
    setGuardando(true);
    const { error } = await supabase.from("comidas").insert(filas);
    setGuardando(false);
    if (error) return avisar("No se pudieron copiar las comidas");
    await cargarComidas().catch(() => {});
    vibrar(15);
    avisar(`${filas.length === 1 ? "Copiada" : `${filas.length} comidas copiadas`} a ${nombreDia(destino).toLowerCase()}`);
    onListo(destino);
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Copiar comidas">
      <div className="copiar-comidas">
        <p className="ajuste-texto">Elegí las que repetís. Se copian con sus alimentos y cantidades, sin la foto: cuando las comas, les sumás la foto y ahí le llega el aviso al grupo.</p>
        <ul className="copiar-lista">
          {lista.map((c) => (
            <li key={c.id}>
              <label className="copiar-fila">
                <input type="checkbox" checked={elegidas.has(c.id)} onChange={() => alternar(c.id)} />
                <span className="planeada-icono"><IconoComida tipo={c.tipo} size={18} /></span>
                <span className="planeada-datos">
                  <strong>{c.descripcion || tipoInfo(c.tipo).texto}</strong>
                  <small>{tipoInfo(c.tipo).texto} · {Math.round(c.calorias || 0).toLocaleString("es-AR")} kcal</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="copiar-destino" role="group" aria-label="A qué día">
          <span>Copiar a</span>
          <div className="chips-grupos">
            {destinos.map((d) => (
              <button key={d} type="button" className={d === destino ? "chip-grupo activo" : "chip-grupo"} aria-pressed={d === destino} onClick={() => setDestino(d)}>
                <CalendarClock size={14} /> {d === haceDias(-2) ? "Pasado mañana" : nombreDia(d)}
              </button>
            ))}
          </div>
        </div>
        <button className="boton boton-grande" onClick={copiar} disabled={guardando || !elegidas.size}>
          <Copy size={18} /> {guardando ? "Copiando…" : `Copiar ${elegidas.size === 1 ? "1 comida" : `${elegidas.size} comidas`} · ${Math.round(kcal).toLocaleString("es-AR")} kcal`}
        </button>
      </div>
    </Hoja>
  );
}
