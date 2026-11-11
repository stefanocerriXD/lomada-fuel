import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { avisarGrupo } from "../lib/api.js";
import { useDatos } from "../lib/datos.jsx";
import { comprimirImagen } from "../lib/imagen.js";
import { descripcionImportada, destinosDeImportacion, itemImportado, ranurasDeFotos } from "../lib/importar.js";
import { macrosDeItem } from "../lib/macros.js";
import { prepararItem } from "../lib/unidades.js";
import { nombreDia } from "../lib/fechas.js";
import { TIPOS, TIPOS_TODOS, tipoInfo } from "../lib/macros.js";
import { Hoja, vibrar } from "../componentes/Base.jsx";
import DetalleAlimentos from "../componentes/DetalleAlimentos.jsx";
import IconoComida from "../componentes/IconoComida.jsx";
import Lector from "../componentes/Lector.jsx";

const CAMPOS = [["kcal", "kcal"], ["p", "Prote"], ["c", "Carbos"], ["g", "Grasas"]];
const FILA_VACIA = { tipo: "resumen", kcal: 0, p: 0, c: 0, g: 0 };

function alimentosParaGuardar(fila) {
  return fila.alimentos.map((a) => {
    const item = itemImportado(a);
    if (!item.por100) return item;
    const preparado = prepararItem(item);
    return { ...preparado, ...macrosDeItem(preparado) };
  });
}

const redondo = (v) => Math.round((Number(v) || 0) * 10) / 10;
const tocada = (f) => f.alimentos?.length && ["kcal", "p", "c", "g"].some((k) => Math.abs(redondo(f[k]) - redondo(f.alimentos.reduce((t, a) => t + a[k], 0))) > 1);

export default function Importar({ pedido, onCerrar, onGuardar }) {
  return (
    <Hoja abierta={!!pedido} onCerrar={onCerrar} titulo="Importar todo el día" ancha>
      {pedido && <Contenido fecha={pedido.fecha} filasIniciales={pedido.filas} onGuardar={onGuardar} />}
    </Hoja>
  );
}

function Contenido({ fecha, filasIniciales, onGuardar }) {
  const [filas, setFilas] = useState(filasIniciales || null);
  const [guardadas, setGuardadas] = useState(null);
  const [aviso, setAviso] = useState("");

  function leido(halladas) {
    setAviso(halladas.length ? "" : "No encontramos calorías ni macros. Probá con otra captura, o cargalos a mano acá abajo.");
    setFilas(halladas.length ? halladas : [FILA_VACIA]);
  }

  if (guardadas) return <Fotos fecha={fecha} guardadas={guardadas} onListo={onGuardar} />;
  if (filas) {
    return <Revisar fecha={fecha} filas={filas} setFilas={setFilas} aviso={aviso} onVolver={() => { setFilas(null); setAviso(""); }} onGuardadas={setGuardadas} />;
  }
  return (
    <Lector
      nota={`Para ${nombreDia(fecha).toLowerCase()}. Usá una captura o el texto de tu otra app donde se vean las calorías y los macros.`}
      onLeido={leido}
    />
  );
}

// Lo que se importó antes con una lista de alimentos también se puede renombrar.
const esListaImportada = (c) => c.alimentos?.[0]?.fuente === "importado";

function Revisar({ fecha, filas, setFilas, aviso, onVolver, onGuardadas }) {
  const { usuario, yo, comidas, fotos, cargarComidas, extras } = useDatos();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiar = (i, campo, valor) => setFilas(filas.map((f, n) => (n === i ? { ...f, [campo]: valor } : f)));
  const total = Math.round(filas.reduce((t, f) => t + (Number(f.kcal) || 0), 0));
  const propias = comidas.filter((c) => c.usuario_id === usuario.id && c.fecha === fecha);
  const yaCargadas = Math.round(propias.filter((c) => c.tipo !== "resumen").reduce((t, c) => t + (Number(c.calorias) || 0), 0));
  // Cada comida importada completa la que ya está en Lomada (con su foto), en vez de duplicarla.
  const destinos = useMemo(() => destinosDeImportacion(filas, propias), [filas, propias]);

  async function guardar() {
    const validas = filas.filter((f) => Number(f.kcal) > 0);
    if (!validas.length) return setError("Poné al menos las calorías.");
    setGuardando(true);
    setError("");
    try {
      const guardadas = [];
      for (const f of validas) {
        const previa = destinos[filas.indexOf(f)];
        const macros = { kcal: Math.round(Number(f.kcal)), p: Number(f.p) || 0, c: Number(f.c) || 0, g: Number(f.g) || 0 };
        // Si la comida de Lomada ya tenía un nombre propio ("Milanesa con puré"), se queda.
        const generica = !previa?.descripcion || previa.descripcion === tipoInfo(previa.tipo).texto || / importado$/.test(previa.descripcion) || esListaImportada(previa);
        const fila = {
          tipo: previa?.tipo || f.tipo,
          fecha,
          descripcion: f.tipo === "resumen" ? "Resumen importado" : generica ? descripcionImportada(f.alimentos, tipoInfo(f.tipo).texto) : previa.descripcion,
          calorias: macros.kcal,
          proteinas: macros.p,
          carbohidratos: macros.c,
          grasas: macros.g,
          macros_editados: Boolean(tocada(f)),
          alimentos: f.alimentos?.length ? alimentosParaGuardar(f) : [{ nombre: "Importado", fuente: "importado", ...macros }],
          ...(extras.disponible && !previa ? { privada: yo.comidas_privadas ?? false } : {}),
        };
        const id = previa?.id || crypto.randomUUID();
        const { error: err } = previa
          ? await supabase.from("comidas").update(fila).eq("id", id)
          : await supabase.from("comidas").insert({ ...fila, id, usuario_id: usuario.id });
        if (err) throw err;
        guardadas.push({ ...fila, id, foto_path: previa?.foto_path || null, privada: previa ? Boolean(previa.privada) : fila.privada ?? false });
      }
      await cargarComidas();
      vibrar(20);
      onGuardadas(guardadas);
    } catch (err) {
      await cargarComidas().catch(() => {});
      setError(err.message || "No se pudo guardar");
      setGuardando(false);
    }
  }

  return (
    <div className="formulario">
      {aviso ? <p className="error" role="alert">{aviso}</p> : <p className="nota">Revisá que los números estén bien antes de guardar.</p>}
      {filas.some((f) => f.tipo === "resumen") && yaCargadas > 0 && (
        <p className="nota">Este día ya tenés {yaCargadas.toLocaleString("es-AR")} kcal cargadas. No se suman: por defecto cuenta el mayor de los dos. Lo cambiás en Ajustes, en Apple Salud.</p>
      )}
      {filas.map((f, i) => (
        <section key={i} className="tarjeta fila-importada">
          <select value={f.tipo} onChange={(e) => cambiar(i, "tipo", e.target.value)} aria-label="Comida">
            {TIPOS_TODOS.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
          <div className="campos-importados">
            {CAMPOS.map(([k, texto]) => (
              <label key={k}>
                <span>{texto}</span>
                <input type="number" min="0" inputMode="decimal" value={f[k]} onChange={(e) => cambiar(i, k, e.target.value)} />
              </label>
            ))}
          </div>
          {destinos[i] && (
            <p className="destino-importado">
              {destinos[i].foto_path && fotos[destinos[i].foto_path] ? <img src={fotos[destinos[i].foto_path]} alt="" /> : <IconoComida tipo={destinos[i].tipo} size={18} />}
              <span>
                {destinos[i].foto_path ? "Completa tu " : "Reemplaza tu "}
                {tipoInfo(destinos[i].tipo).texto.toLowerCase()}
                {destinos[i].foto_path ? ` publicad${["merienda", "cena", "colacion"].includes(destinos[i].tipo) ? "a" : "o"} con foto` : Number(destinos[i].calorias) > 0 ? ` de ${Math.round(destinos[i].calorias).toLocaleString("es-AR")} kcal` : ""}
              </span>
            </p>
          )}
          {f.alimentos?.length > 0 && <DetalleAlimentos alimentos={f.alimentos} />}
        </section>
      ))}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="pie-publicar">
        <div className="pie-fila">
          <div className="pie-total"><strong>{total.toLocaleString("es-AR")} kcal</strong><span>{filas.length === 1 ? "1 registro" : `${filas.length} comidas`}</span></div>
          <button className="boton boton-secundario" onClick={onVolver}>Volver</button>
          <button className="boton" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}

function Fotos({ fecha, guardadas, onListo }) {
  const { usuario, yo, comidas, cargarComidas, extras } = useDatos();
  const [ranuras] = useState(() => ranurasDeFotos(
    guardadas,
    comidas.filter((c) => c.usuario_id === usuario.id && c.fecha === fecha),
    TIPOS.map((t) => t.id),
  ));
  const [elegidas, setElegidas] = useState({});
  const [listas, setListas] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const vistas = useRef([]);

  useEffect(() => {
    if (!ranuras.length) onListo(0);
    return () => vistas.current.forEach((v) => URL.revokeObjectURL(v));
  }, []);

  const pendientes = ranuras.filter((r) => elegidas[r.clave] && !listas.includes(r.clave));

  async function elegir(ranura, e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    setError("");
    try {
      const blob = await comprimirImagen(archivo);
      const vista = URL.createObjectURL(blob);
      vistas.current.push(vista);
      setElegidas((prev) => ({ ...prev, [ranura.clave]: { blob, vista } }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function subir() {
    setSubiendo(true);
    setError("");
    let paraAvisar = null;
    let subidas = listas.length;
    try {
      for (const r of pendientes) {
        const id = r.id || crypto.randomUUID();
        const ruta = `${usuario.id}/${id}-${Date.now()}.jpg`;
        const { error: errFoto } = await supabase.storage.from("fotos").upload(ruta, elegidas[r.clave].blob, { contentType: "image/jpeg" });
        if (errFoto) throw errFoto;
        const privada = r.id ? r.privada : (yo.comidas_privadas ?? false);
        // La foto se publica ahora: pasa a ser lo último del chat aunque la comida sea anterior.
        const { error: errFila } = r.id
          ? await supabase.from("comidas").update({ foto_path: ruta, creado_en: new Date().toISOString() }).eq("id", id)
          : await supabase.from("comidas").insert({
            id,
            usuario_id: usuario.id,
            tipo: r.tipo,
            fecha,
            foto_path: ruta,
            descripcion: tipoInfo(r.tipo).texto,
            calorias: 0,
            proteinas: 0,
            carbohidratos: 0,
            grasas: 0,
            macros_editados: false,
            // Las calorías ya están en el total importado: esta foto no suma nada.
            alimentos: [{ nombre: "Foto", fuente: "foto", kcal: 0, p: 0, c: 0, g: 0 }],
            ...(extras.disponible ? { privada } : {}),
          });
        if (errFila) {
          await supabase.storage.from("fotos").remove([ruta]);
          throw errFila;
        }
        subidas += 1;
        setListas((prev) => [...prev, r.clave]);
        if (!privada) paraAvisar = id;
      }
      await cargarComidas();
      // Un solo aviso por tanda, para no llenarle el celular al grupo.
      if (paraAvisar) avisarGrupo("comida", paraAvisar);
      vibrar(25);
      onListo(subidas);
    } catch (err) {
      await cargarComidas().catch(() => {});
      if (paraAvisar) avisarGrupo("comida", paraAvisar);
      setError(err.message || "No se pudo subir");
      setSubiendo(false);
    }
  }

  if (!ranuras.length) return null;

  return (
    <div className="formulario">
      <div>
        <h3 className="fotos-titulo">¿Subís las fotos?</h3>
        <p className="nota">Se publican en el chat del grupo y no cambian tus calorías.</p>
      </div>
      <ul className="ranuras-foto">
        {ranuras.map((r) => {
          const t = tipoInfo(r.tipo);
          const elegida = elegidas[r.clave];
          const lista = listas.includes(r.clave);
          return (
            <li key={r.clave}>
              <label className={elegida ? "ranura-foto con-foto" : "ranura-foto"}>
                <input className="oculto" type="file" accept="image/*" disabled={subiendo || lista} onChange={(e) => elegir(r, e)} aria-label={`Foto de ${t.texto.toLowerCase()}`} />
                {elegida ? <img src={elegida.vista} alt="" /> : <Camera size={24} />}
                {lista && <span className="ranura-foto-lista"><Check size={15} /></span>}
              </label>
              <span className="ranura-foto-nombre"><IconoComida tipo={r.tipo} size={16} /> {t.texto}</span>
            </li>
          );
        })}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="pie-publicar">
        <div className="pie-fila">
          <button className="boton boton-secundario" onClick={() => onListo(listas.length)} disabled={subiendo}>Ahora no</button>
          <button className="boton" onClick={subir} disabled={subiendo || !pendientes.length}>
            {subiendo ? "Subiendo…" : pendientes.length === 1 ? "Subir 1 foto" : pendientes.length ? `Subir ${pendientes.length} fotos` : "Subir fotos"}
          </button>
        </div>
      </div>
    </div>
  );
}
