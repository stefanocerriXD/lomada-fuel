import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Award, Droplets, Flame, Moon, Sparkles, Target, TrendingUp, Utensils } from "lucide-react";
import { useDatos } from "../lib/datos.jsx";
import { calcularPlan } from "../lib/cuerpo.js";
import { armarInforme } from "../lib/informe.js";
import { nombreDia } from "../lib/fechas.js";
import { tipoInfo } from "../lib/macros.js";
import { Hoja, Numero } from "./Base.jsx";

export const EVENTO_INFORME = "lomada:informe";
export const abrirInforme = () => window.dispatchEvent(new Event(EVENTO_INFORME));

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const miles = (n) => Math.round(n).toLocaleString("es-AR");
const fechaCorta = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
const diaSemana = (texto) => new Date(`${texto}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" }).replace(",", "");
const horaTexto = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

// Flechita contra la semana anterior.
function Cambio({ ahora, antes, unidad }) {
  if (!antes) return null;
  const dif = Math.round(ahora - antes);
  if (!dif) return <small className="informe-cambio igual">igual que la semana pasada</small>;
  const Icono = dif > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <small className="informe-cambio">
      <Icono size={13} aria-hidden="true" /> {dif > 0 ? "+" : "−"}{miles(Math.abs(dif))} {unidad} vs. semana pasada
    </small>
  );
}

// El informe de los domingos: se abre desde la notificación, el resumen o la pestaña Semana.
export default function InformeSemanal({ abiertoAlInicio = false }) {
  const { usuario, yo, comidas, perfiles, salud, extras } = useDatos();
  const [abierto, setAbierto] = useState(abiertoAlInicio);
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener(EVENTO_INFORME, abrir);
    return () => window.removeEventListener(EVENTO_INFORME, abrir);
  }, []);

  const informe = useMemo(() => {
    if (!abierto) return null;
    const plan = salud ? calcularPlan(salud) : null;
    return armarInforme({ comidas, usuarioId: usuario.id, meta: yo.meta_calorias, metaProteina: plan?.proteinas || null, agua: extras.agua, perfiles });
  }, [abierto, comidas, usuario.id, yo.meta_calorias, salud, extras.agua, perfiles]);

  return (
    <Hoja abierta={abierto} onCerrar={() => setAbierto(false)} titulo="Tu semana" ancha>
      {informe && <Contenido informe={informe} />}
    </Hoja>
  );
}

function Contenido({ informe: i }) {
  const techo = Math.max(...i.porDia.map((d) => d.kcal), i.meta || 0, 1) * 1.1;
  if (!i.actual.dias) {
    return (
      <div className="informe">
        <p className="informe-rango">{fechaCorta(i.desde)} al {fechaCorta(i.hasta)}</p>
        <p className="ajuste-texto">No cargaste comidas esta semana. Cuando cargues, acá vas a ver tus promedios, tu mejor día y cómo vas contra la semana anterior.</p>
      </div>
    );
  }
  return (
    <div className="informe">
      <p className="informe-rango">{fechaCorta(i.desde)} al {fechaCorta(i.hasta)} · {i.actual.dias} de 7 días cargados</p>

      <section className="informe-heroe">
        <span className="informe-etiqueta"><Flame size={15} aria-hidden="true" /> Promedio por día</span>
        <strong className="informe-numero"><Numero valor={i.actual.kcal} /> <small>kcal</small></strong>
        {i.meta ? <small className="informe-meta">Meta {miles(i.meta)} kcal · {i.enMeta ? `${i.enMeta} ${i.enMeta === 1 ? "día" : "días"} en meta` : "ningún día en meta"}</small> : null}
        <Cambio ahora={i.actual.kcal} antes={i.previo.dias ? i.previo.kcal : 0} unidad="kcal" />
      </section>

      <section className="informe-barras" aria-label="Calorías de cada día">
        {i.porDia.map((d, n) => (
          <span key={d.fecha} className={`informe-dia${d.kcal === 0 ? " sin-datos" : ""}${i.mejorDia?.fecha === d.fecha ? " mejor" : ""}`} title={`${nombreDia(d.fecha)}: ${miles(d.kcal)} kcal`}>
            <motion.i initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: n * 0.05, duration: 0.4 }} style={{ height: Math.max(4, Math.round((d.kcal / techo) * 92)) }} />
            <small>{DIAS[n]}</small>
          </span>
        ))}
      </section>

      <section className="informe-macros">
        {[["Proteínas", "p", i.actual.p, i.previo.p, i.metaProteina], ["Carbos", "c", i.actual.c, i.previo.c], ["Grasas", "g", i.actual.g, i.previo.g]].map(([nombre, k, valor, antes, meta]) => (
          <div key={k} className={`informe-macro macro-${k}`}>
            <span>{nombre}</span>
            <strong>{valor} g</strong>
            <small>{i.reparto[k]}% de las kcal{meta ? ` · meta ${meta} g` : ""}</small>
            {i.previo.dias ? <small className="informe-cambio">{valor - antes >= 0 ? "+" : "−"}{Math.abs(valor - antes)} g</small> : null}
          </div>
        ))}
      </section>

      {(i.bien.length > 0 || i.mejorar.length > 0) && (
        <section className="informe-veredicto">
          {i.bien.length > 0 && (
            <div>
              <h3><Sparkles size={16} aria-hidden="true" /> Lo mejor</h3>
              <ul>{i.bien.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
          {i.mejorar.length > 0 && (
            <div>
              <h3><Target size={16} aria-hidden="true" /> Para la próxima</h3>
              <ul>{i.mejorar.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="informe-datos">
        {i.mejorDia && <Dato icono={Award} titulo="Tu mejor día" texto={`${nombreDia(i.mejorDia.fecha)}: ${miles(i.mejorDia.kcal)} kcal, el más cerca de tu meta`} />}
        {i.diaPesado && i.diaPesado.fecha !== i.mejorDia?.fecha && <Dato icono={TrendingUp} titulo="El día más pesado" texto={`${nombreDia(i.diaPesado.fecha)}: ${miles(i.diaPesado.kcal)} kcal`} />}
        {i.comidaTop && <Dato icono={Utensils} titulo="La comida más grande" texto={`${i.comidaTop.descripcion || tipoInfo(i.comidaTop.tipo).texto} (${tipoInfo(i.comidaTop.tipo).texto.toLowerCase()} del ${diaSemana(i.comidaTop.fecha)}): ${miles(i.comidaTop.calorias)} kcal`} />}
        {i.favorito && <Dato icono={Sparkles} titulo="Lo que más se repitió" texto={`${i.favorito.nombre}, ${i.favorito.veces} veces`} />}
        {i.finde > 0 && i.habiles > 0 && <Dato icono={Flame} titulo="Finde contra semana" texto={`${miles(i.finde)} kcal por día el finde y ${miles(i.habiles)} de lunes a viernes`} />}
        {i.horaCena !== null && <Dato icono={Moon} titulo="La cena" texto={`La subís a las ${horaTexto(i.horaCena)} en promedio`} />}
        {i.aguaPromedio > 0 && <Dato icono={Droplets} titulo="Agua" texto={`${(i.aguaPromedio / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} L por día`} />}
        <Dato icono={Utensils} titulo="Comidas y fotos" texto={`${i.platos} comidas cargadas y ${i.fotos} ${i.fotos === 1 ? "foto" : "fotos"} · desayunaste ${i.conDesayuno} de 7 días`} />
        {i.integrantes > 1 && i.puesto > 0 && <Dato icono={Award} titulo="Constancia en el grupo" texto={`Puesto ${i.puesto} de ${i.integrantes}`} />}
      </section>
      <p className="nota">Son estimaciones para llevar la cuenta entre amigos. No reemplazan a un profesional de la nutrición.</p>
    </div>
  );
}

function Dato({ icono: Icono, titulo, texto }) {
  return (
    <div className="informe-dato">
      <span className="informe-dato-icono"><Icono size={17} aria-hidden="true" /></span>
      <span><strong>{titulo}</strong><small>{texto}</small></span>
    </div>
  );
}
