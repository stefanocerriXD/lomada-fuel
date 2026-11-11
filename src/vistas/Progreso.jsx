import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Scale, Sparkles, Target } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { aFecha, fechaLocal, nombreDia } from "../lib/fechas.js";
import { analizarGastoReal, calcularPlan } from "../lib/cuerpo.js";
import { Vacio, vibrar } from "../componentes/Base.jsx";
import Viaje from "../componentes/Viaje.jsx";

const kg = (n) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 });

export default function Progreso({ onEditarCuerpo, avisar }) {
  const { usuario, yo, salud, pesos, comidas, cargarSalud, cargarPerfiles } = useDatos();
  const [peso, setPeso] = useState("");
  const [guardando, setGuardando] = useState(false);

  if (salud === undefined) {
    return <><Viaje /><Vacio icono={Scale} titulo="Progreso todavía no está activo" texto="Se activa al terminar la configuración de la base de datos." /></>;
  }
  if (!salud) {
    return (
      <>
        <Viaje />
        <Vacio icono={Target} titulo="Armá tu plan" texto="Cargá tus medidas y tu objetivo para ver cuánto quemás y cómo vas.">
          <button className="boton" onClick={onEditarCuerpo}>Empezar</button>
        </Vacio>
      </>
    );
  }

  const plan = calcularPlan(salud);
  const inicial = Number(pesos[0]?.peso_kg ?? salud.peso_kg);
  const actual = Number(salud.peso_kg);
  const objetivo = Number(salud.peso_objetivo);
  const recorrido = Math.abs(inicial - objetivo);
  const avance = recorrido > 0 ? Math.min(Math.max((inicial - actual) / (inicial - objetivo), 0), 1) : 1;

  async function registrar(e) {
    e.preventDefault();
    const valor = Number(peso);
    if (!(valor >= 30 && valor <= 300)) return avisar("Poné un peso válido");
    setGuardando(true);
    const hoy = fechaLocal();
    const { error } = await supabase.from("pesos").upsert({ usuario_id: usuario.id, fecha: hoy, peso_kg: valor }, { onConflict: "usuario_id,fecha" });
    const { error: errSalud } = error ? { error } : await supabase.from("perfiles_salud").update({ peso_kg: valor }).eq("usuario_id", usuario.id);
    setGuardando(false);
    if (error || errSalud) return avisar("No se pudo guardar el peso");
    setPeso("");
    await cargarSalud();
    vibrar(15);
    avisar("Peso registrado");
  }

  return (
    <>
      <header className="titulo-vista">
        <div>
          <p className="sobretitulo">Solo lo ves vos</p>
          <h1>Tu progreso</h1>
        </div>
        <button className="boton-chico" onClick={onEditarCuerpo}><Target size={15} /> Editar plan</button>
      </header>

      <Viaje />

      <section className="tarjeta objetivo">
        <div className="objetivo-numeros">
          <div><span>Empezaste</span><strong>{kg(inicial)} kg</strong></div>
          <div className="centrado"><span>Hoy</span><strong className="grande">{kg(actual)} kg</strong></div>
          <div className="derecha"><span>Objetivo</span><strong>{kg(objetivo)} kg</strong></div>
        </div>
        <div className="pista-progreso gruesa" role="progressbar" aria-valuenow={Math.round(avance * 100)} aria-valuemin="0" aria-valuemax="100" aria-label="Avance hacia el objetivo">
          <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: avance }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        <p className="objetivo-texto">
          {plan.objetivo === "mantener"
            ? "Estás en tu objetivo. La meta es sostenerlo."
            : `Te faltan ${kg(Math.abs(objetivo - actual))} kg${plan.llegada ? `. Al ritmo del plan, llegarías cerca de ${plan.llegada}.` : "."}`}
        </p>
      </section>

      <div className="estadisticas">
        <div className="tarjeta estadistica"><span>Quemás por día</span><strong>{plan.gasto.toLocaleString("es-AR")}</strong><small>kcal estimadas</small></div>
        <div className="tarjeta estadistica"><span>Meta sugerida</span><strong>{plan.calorias.toLocaleString("es-AR")}</strong><small>kcal por día</small></div>
        <div className="tarjeta estadistica"><span>Proteína</span><strong>{plan.proteinas}</strong><small>g por día</small></div>
      </div>

      <MetaAdaptativa plan={plan} analisis={analizarGastoReal(pesos, comidas.filter((c) => c.usuario_id === usuario.id), plan)} metaActual={yo.meta_calorias} usuarioId={usuario.id} cargarPerfiles={cargarPerfiles} avisar={avisar} />

      <section className="tarjeta tarjeta-grafico">
        <h2>Tu peso</h2>
        <form className="registrar-peso" onSubmit={registrar}>
          <Scale size={19} />
          <input type="number" inputMode="decimal" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Peso de hoy" aria-label="Peso de hoy en kilos" />
          <button className="boton" disabled={guardando || !peso}>Guardar</button>
        </form>
        {pesos.length >= 2 ? (
          <GraficoPeso datos={pesos} objetivo={objetivo} />
        ) : (
          <p className="nota">Con dos registros vas a ver tu curva. Pesate en condiciones parecidas para compararlos mejor.</p>
        )}
        {pesos.length > 0 && (
          <details className="tabla-grafico">
            <summary>Ver como tabla</summary>
            <table>
              <thead><tr><th scope="col">Día</th><th scope="col">Peso</th></tr></thead>
              <tbody>
                {[...pesos].reverse().slice(0, 30).map((p) => (
                  <tr key={p.fecha}><td>{nombreDia(p.fecha)}</td><td>{kg(p.peso_kg)} kg</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>
      <p className="nota">Estimaciones con la fórmula de Mifflin-St Jeor. No reemplazan a un profesional de la salud.</p>
    </>
  );
}

function MetaAdaptativa({ plan, analisis, metaActual, usuarioId, cargarPerfiles, avisar }) {
  const [guardando, setGuardando] = useState(false);

  async function aplicar() {
    setGuardando(true);
    const { error } = await supabase.from("perfiles").update({ meta_calorias: analisis.calorias }).eq("id", usuarioId);
    setGuardando(false);
    if (error) return avisar("No se pudo cambiar la meta");
    await cargarPerfiles();
    vibrar(15);
    avisar("Meta actualizada");
  }

  if (!analisis.listo) {
    const { pesajes, dias, tramo } = analisis.faltan;
    const pendientes = [
      pesajes && `${pesajes} ${pesajes === 1 ? "pesaje" : "pesajes"} más`,
      dias && `${dias} ${dias === 1 ? "día completo" : "días completos"} de comidas`,
      tramo && `${Math.ceil(tramo)} ${Math.ceil(tramo) === 1 ? "día" : "días"} más de seguimiento`,
    ].filter(Boolean);
    return (
      <section className="tarjeta adaptativa">
        <h2><Sparkles size={17} /> Meta adaptativa</h2>
        <p>Compara lo que comés con tu peso real para ajustar el cálculo. Falta: {pendientes.join(", ")}.</p>
      </section>
    );
  }

  const diferencia = analisis.calorias - metaActual;
  return (
    <section className="tarjeta adaptativa">
      <h2><Sparkles size={17} /> Meta adaptativa</h2>
      <p>
        Comés unas {analisis.consumo.toLocaleString("es-AR")} kcal y tu peso cambia {analisis.kgPorSemana.toLocaleString("es-AR")} kg por semana. Tu gasto real ronda las <strong>{analisis.gasto.toLocaleString("es-AR")} kcal</strong>, contra {plan.gasto.toLocaleString("es-AR")} de la fórmula.
      </p>
      {Math.abs(diferencia) >= 50 ? (
        <button className="boton" onClick={aplicar} disabled={guardando}>Usar {analisis.calorias.toLocaleString("es-AR")} kcal como meta</button>
      ) : (
        <p>Tu meta actual ya va bien con estos datos.</p>
      )}
    </section>
  );
}

function GraficoPeso({ datos, objetivo }) {
  const caja = useRef(null);
  const [ancho, setAncho] = useState(320);
  const [activo, setActivo] = useState(null);
  const alto = 190;
  const margen = { arriba: 22, derecha: 16, abajo: 24, izquierda: 38 };

  useLayoutEffect(() => {
    const medir = () => setAncho(caja.current?.clientWidth || 320);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja.current);
    return () => observador.disconnect();
  }, []);

  const puntos = useMemo(() => {
    const valores = datos.map((d) => Number(d.peso_kg)).concat(objetivo);
    const min = Math.floor(Math.min(...valores) - 1);
    const max = Math.ceil(Math.max(...valores) + 1);
    const inicio = aFecha(datos[0].fecha).getTime();
    const fin = aFecha(datos[datos.length - 1].fecha).getTime();
    const x = (f) => margen.izquierda + ((aFecha(f).getTime() - inicio) / Math.max(fin - inicio, 1)) * (ancho - margen.izquierda - margen.derecha);
    const y = (v) => margen.arriba + ((max - v) / (max - min)) * (alto - margen.arriba - margen.abajo);
    return { min, max, y, lista: datos.map((d) => ({ ...d, x: x(d.fecha), y: y(Number(d.peso_kg)) })) };
  }, [datos, objetivo, ancho]);

  const linea = puntos.lista.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const ultimo = puntos.lista[puntos.lista.length - 1];
  const yObjetivo = puntos.y(objetivo);
  const marcado = activo != null ? puntos.lista[activo] : null;

  function mover(e) {
    const cuadro = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - cuadro.left;
    let cercano = 0;
    puntos.lista.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(puntos.lista[cercano].x - x)) cercano = i;
    });
    setActivo(cercano);
  }

  return (
    <div className="grafico-peso" ref={caja}>
      <svg width={ancho} height={alto} role="img" aria-label={`Peso de ${kg(datos[0].peso_kg)} a ${kg(ultimo.peso_kg)} kilos. Objetivo: ${kg(objetivo)} kilos.`} onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setActivo(null)}>
        {[puntos.max, puntos.min].map((v) => (
          <g key={v}>
            <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={puntos.y(v)} y2={puntos.y(v)} className="eje-linea" />
            <text x={margen.izquierda - 8} y={puntos.y(v) + 4} textAnchor="end" className="eje-texto">{v}</text>
          </g>
        ))}
        <line x1={margen.izquierda} x2={ancho - margen.derecha} y1={yObjetivo} y2={yObjetivo} className="meta-linea" />
        <text x={ancho - margen.derecha} y={yObjetivo - 6} textAnchor="end" className="eje-texto fuerte">Objetivo {kg(objetivo)}</text>
        <motion.path d={linea} className="peso-linea" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
        <circle cx={ultimo.x} cy={ultimo.y} r="5" className="peso-punto" />
        <text x={aFecha(datos[0].fecha) ? margen.izquierda : 0} y={alto - 6} className="eje-texto">{aFecha(datos[0].fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</text>
        <text x={ancho - margen.derecha} y={alto - 6} textAnchor="end" className="eje-texto">{aFecha(ultimo.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</text>
        {marcado && (
          <>
            <line x1={marcado.x} x2={marcado.x} y1={margen.arriba} y2={alto - margen.abajo} className="eje-linea" />
            <circle cx={marcado.x} cy={marcado.y} r="5" className="peso-punto" />
          </>
        )}
      </svg>
      {marcado && (
        <span className="grafico-globo" style={{ left: Math.min(Math.max(marcado.x - 50, 0), ancho - 110), top: 0 }}>
          <strong>{kg(marcado.peso_kg)} kg</strong>
          {nombreDia(marcado.fecha)}
        </span>
      )}
    </div>
  );
}
