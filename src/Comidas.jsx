import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { estimarMacros } from "./App.jsx";

const TIPOS = ["desayuno", "almuerzo", "merienda", "cena"];

export default function Comidas({ usuario }) {
  const [comidas, setComidas] = useState([]);
  const [fotos, setFotos] = useState({});
  const [subiendo, setSubiendo] = useState(false);
  const [tipo, setTipo] = useState("almuerzo");
  const [error, setError] = useState("");

  async function cargar() {
    const { data, error: err } = await supabase
      .from("comidas")
      .select("*, perfiles(nombre)")
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(60);
    if (err) return setError(err.message);
    setComidas(data);
    const rutas = data.filter((c) => c.foto_path).map((c) => c.foto_path);
    if (rutas.length) {
      const { data: urls } = await supabase.storage.from("fotos").createSignedUrls(rutas, 3600);
      const mapa = {};
      (urls || []).forEach((u) => (mapa[u.path] = u.signedUrl));
      setFotos(mapa);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function subirFoto(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setError("");
    setSubiendo(true);
    try {
      // 1) La IA estima los macros desde la foto.
      const { estimacion, blob } = await estimarMacros(archivo);
      // 2) La foto se guarda en la carpeta del usuario.
      const id = crypto.randomUUID();
      const ruta = `${usuario.id}/${id}.jpg`;
      const { error: errSubida } = await supabase.storage.from("fotos").upload(ruta, blob, { contentType: "image/jpeg" });
      if (errSubida) throw errSubida;
      // 3) Se crea la comida con los macros estimados. El usuario los puede corregir después.
      const { error: errInsert } = await supabase.from("comidas").insert({
        id,
        usuario_id: usuario.id,
        tipo,
        foto_path: ruta,
        descripcion: estimacion.descripcion,
        calorias: Math.round(estimacion.calorias),
        proteinas: estimacion.proteinas,
        carbohidratos: estimacion.carbohidratos,
        grasas: estimacion.grasas,
      });
      if (errInsert) throw errInsert;
      await cargar();
    } catch (err) {
      setError(err.message || "No se pudo subir la comida");
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  }

  return (
    <section>
      <div className="subir">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <label className="boton">
          {subiendo ? "Calculando macros…" : "Subir foto"}
          <input type="file" accept="image/*" capture="environment" onChange={subirFoto} disabled={subiendo} hidden />
        </label>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="grilla">
        {comidas.map((c) => (
          <Tarjeta key={c.id} comida={c} foto={fotos[c.foto_path]} propia={c.usuario_id === usuario.id} onCambio={cargar} />
        ))}
      </div>
    </section>
  );
}

function Tarjeta({ comida, foto, propia, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState(comida);

  async function guardar() {
    const { error } = await supabase
      .from("comidas")
      .update({
        calorias: Number(valores.calorias),
        proteinas: Number(valores.proteinas),
        carbohidratos: Number(valores.carbohidratos),
        grasas: Number(valores.grasas),
        descripcion: valores.descripcion,
        macros_editados: true,
      })
      .eq("id", comida.id);
    if (!error) {
      setEditando(false);
      onCambio();
    }
  }

  async function borrar() {
    if (!confirm("¿Borrar esta comida?")) return;
    await supabase.from("comidas").delete().eq("id", comida.id);
    if (comida.foto_path) await supabase.storage.from("fotos").remove([comida.foto_path]);
    onCambio();
  }

  return (
    <article className="tarjeta">
      {foto && <img src={foto} alt={comida.descripcion || "comida"} />}
      <div className="tarjeta-texto">
        <strong>{comida.perfiles?.nombre}</strong> · {comida.tipo} · {comida.fecha}
        {!editando ? (
          <>
            <p>{comida.descripcion}</p>
            <p className="macros">
              {comida.calorias} kcal · P {comida.proteinas}g · C {comida.carbohidratos}g · G {comida.grasas}g
              {comida.macros_editados && <span className="etiqueta"> editado</span>}
            </p>
          </>
        ) : (
          <div className="editar">
            <input value={valores.descripcion || ""} onChange={(e) => setValores({ ...valores, descripcion: e.target.value })} />
            {["calorias", "proteinas", "carbohidratos", "grasas"].map((k) => (
              <label key={k}>
                {k}
                <input type="number" value={valores[k] ?? ""} onChange={(e) => setValores({ ...valores, [k]: e.target.value })} />
              </label>
            ))}
            <button onClick={guardar}>Guardar</button>
          </div>
        )}
        {propia && !editando && (
          <div className="acciones">
            <button className="secundario" onClick={() => setEditando(true)}>Corregir macros</button>
            <button className="secundario" onClick={borrar}>Borrar</button>
          </div>
        )}
      </div>
    </article>
  );
}
