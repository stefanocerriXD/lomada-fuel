import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Lock, Plus, Swords, Trash2, Trophy } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { fechaLocal, haceDias } from "../lib/fechas.js";
import { desafioTerminado, diasRestantes, objetivoDesafio, puntajes, tipoDesafio, TIPOS_DESAFIO } from "../lib/desafios.js";
import { MEDALLAS } from "../lib/medallas.js";
import { Avatar, Hoja, Vacio, vibrar } from "../componentes/Base.jsx";

function DesafioIcono({ tipo, size = 18 }) {
  const Icono = tipo.icono;
  return <Icono size={size} aria-hidden="true" />;
}

export default function Retos({ avisar }) {
  const { usuario, extras, perfiles, comidas, cargarExtras } = useDatos();
  const [creando, setCreando] = useState(false);

  const activos = extras.desafios.filter((d) => !desafioTerminado(d));
  const terminados = extras.desafios.filter(desafioTerminado).slice(0, 5);

  if (!extras.disponible) {
    return <Vacio icono={Trophy} titulo="Retos todavía no está activo" texto="Se activa al terminar la configuración de la base de datos." />;
  }

  async function borrar(id) {
    const { error } = await supabase.from("desafios").delete().eq("id", id);
    if (error) return avisar("No se pudo borrar");
    await cargarExtras();
    avisar("Desafío borrado");
  }

  return (
    <>
      <header className="titulo-vista">
        <div>
          <p className="sobretitulo">Compiten todos los del grupo</p>
          <h1>Retos</h1>
        </div>
        <button className="boton-chico" onClick={() => setCreando(true)}><Plus size={15} /> Nuevo</button>
      </header>

      {activos.length === 0 ? (
        <Vacio icono={Swords} titulo="No hay desafíos en curso" texto="Armá uno y que gane el más constante.">
          <button className="boton" onClick={() => setCreando(true)}>Crear desafío</button>
        </Vacio>
      ) : (
        <div className="lista-desafios">
          {activos.map((d) => (
            <TarjetaDesafio key={d.id} desafio={d} ranking={puntajes(d, perfiles, comidas, extras.agua)} propio={d.creado_por === usuario.id} onBorrar={() => borrar(d.id)} />
          ))}
        </div>
      )}

      {terminados.length > 0 && (
        <section>
          <h2 className="titulo-seccion">Terminados</h2>
          <ul className="desafios-pasados">
            {terminados.map((d) => {
              const [primero] = puntajes(d, perfiles, comidas, extras.agua);
              const hubo = primero?.puntos > 0;
              return (
                <li key={d.id} className="tarjeta">
                  <DesafioIcono tipo={tipoDesafio(d.tipo)} />
                  <span>
                    <strong>{tipoDesafio(d.tipo).titulo}</strong>
                    <small>{hubo ? `Ganó ${primero.perfil.nombre}` : "Sin ganador"}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="titulo-seccion">Logros</h2>
        <Medallas />
      </section>

      <NuevoDesafio abierto={creando} onCerrar={() => setCreando(false)} avisar={avisar} />
    </>
  );
}

function TarjetaDesafio({ desafio, ranking, propio, onBorrar }) {
  const { usuario } = useDatos();
  const tipo = tipoDesafio(desafio.tipo);
  const objetivo = objetivoDesafio(desafio);
  const restantes = diasRestantes(desafio);
  const meta = Number(desafio.meta);

  return (
    <motion.article className="tarjeta desafio" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <header>
        <span className="desafio-icono"><DesafioIcono tipo={tipo} size={24} /></span>
        <div>
          <h2>{tipo.titulo}</h2>
          <p>{tipo.regla(meta)}</p>
        </div>
        <span className="desafio-dias">{restantes === 1 ? "Último día" : `${restantes} días`}</span>
      </header>
      <ol>
        {ranking.map((r, i) => (
          <li key={r.perfil.id}>
            <span className="desafio-lugar">{i + 1}</span>
            <Avatar perfil={r.perfil} tam={30} />
            <span className="desafio-persona">
              <span>
                <strong>{r.perfil.id === usuario.id ? "Vos" : r.perfil.nombre}</strong>
                <small>{r.puntos} de {objetivo}</small>
              </span>
              <span className="pista-progreso">
                <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(r.puntos / objetivo, 1) }} transition={{ duration: 0.7, delay: i * 0.05 }} />
              </span>
            </span>
          </li>
        ))}
      </ol>
      {propio && (
        <button className="boton-texto" onClick={onBorrar}><Trash2 size={15} /> Borrar desafío</button>
      )}
    </motion.article>
  );
}

function Medallas() {
  const { usuario, extras, perfiles, abrirPerfil } = useDatos();
  const mias = useMemo(() => new Set(extras.medallas.filter((m) => m.usuario_id === usuario.id).map((m) => m.codigo)), [extras.medallas, usuario.id]);

  return (
    <>
      {[["objetivos", "Objetivos"], ["alimentacion", "Alimentación"]].map(([grupo, titulo]) => (
        <div key={grupo} className="grupo-medallas">
          <h3 className="perfil-subtitulo">{titulo}</h3>
          <ul className="medallas">
            {MEDALLAS.filter((m) => m.grupo === grupo).map((m) => {
              const ganada = mias.has(m.codigo);
              return (
                <li key={m.codigo} className={ganada ? "tarjeta medalla ganada" : "tarjeta medalla"}>
                  <span className="medalla-icono" aria-hidden="true">{ganada ? <m.icono size={24} /> : <Lock size={20} />}</span>
                  <strong>{m.nombre}</strong>
                  <small>{m.detalle}</small>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {extras.medallas.some((m) => m.usuario_id !== usuario.id) && (
        <div className="medallas-grupo">
          <h3>El grupo</h3>
          <ul>
            {Object.values(perfiles).filter((p) => p.id !== usuario.id).map((p) => {
              const cantidad = extras.medallas.filter((m) => m.usuario_id === p.id).length;
              return (
                <li key={p.id}><button onClick={() => abrirPerfil(p.id)}><Avatar perfil={p} tam={28} /> <span>{p.nombre}</span> <strong>{cantidad}</strong></button></li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function NuevoDesafio({ abierto, onCerrar, avisar }) {
  const { usuario, cargarExtras } = useDatos();
  const [tipo, setTipo] = useState("proteina");
  const [meta, setMeta] = useState(TIPOS_DESAFIO[0].meta);
  const [dias, setDias] = useState(7);
  const [guardando, setGuardando] = useState(false);
  const elegido = tipoDesafio(tipo);

  function elegir(t) {
    setTipo(t.id);
    setMeta(t.meta);
  }

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from("desafios").insert({
      tipo,
      meta: Number(meta),
      inicio: fechaLocal(),
      fin: haceDias(-(dias - 1)),
      creado_por: usuario.id,
    });
    setGuardando(false);
    if (error) return avisar("No se pudo crear el desafío");
    await cargarExtras();
    vibrar(20);
    avisar("¡Desafío en marcha!");
    onCerrar();
  }

  return (
    <Hoja abierta={abierto} onCerrar={onCerrar} titulo="Nuevo desafío">
      <form className="formulario" onSubmit={crear}>
        <div className="tipos-desafio" role="radiogroup" aria-label="Tipo de desafío">
          {TIPOS_DESAFIO.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} className={tipo === t.id ? "activo" : ""} onClick={() => elegir(t)}>
              <DesafioIcono tipo={t} /> {t.titulo}
            </button>
          ))}
        </div>
        <label className="campo">
          <span>{elegido.etiqueta}</span>
          <input type="number" inputMode="numeric" min="1" value={meta} onChange={(e) => setMeta(e.target.value)} required />
        </label>
        <div className="campo">
          <span id="etiqueta-duracion">Duración</span>
          <div className="opciones-dobles tres" role="radiogroup" aria-labelledby="etiqueta-duracion">
            {[3, 7, 14].map((d) => (
              <button key={d} type="button" role="radio" aria-checked={dias === d} className={dias === d ? "activo" : ""} onClick={() => setDias(d)}>{d} días</button>
            ))}
          </div>
        </div>
        <p className="nota">{elegido.regla(meta || 0)}. Participa todo el grupo y las comidas privadas no cuentan.</p>
        <button className="boton boton-grande" disabled={guardando || !(Number(meta) > 0)}>{guardando ? "Creando…" : "Empezar desafío"}</button>
      </form>
    </Hoja>
  );
}
