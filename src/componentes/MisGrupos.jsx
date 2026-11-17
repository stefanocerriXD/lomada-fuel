import { useCallback, useEffect, useState } from "react";
import { Check, LogOut, Plus, ShieldCheck, Users } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { vibrar } from "./Base.jsx";
import { cancelarPedido, EVENTO_PEDIDOS, gruposQueAdministro, misPedidos, pedirEntrar } from "../lib/grupos.js";
import CrearGrupo, { PedidosEnviados } from "./CrearGrupo.jsx";
import AdminGrupo from "./AdminGrupo.jsx";

const OPCIONES = [
  { id: "todos", titulo: "En todos mis grupos", detalle: "Cada comida se ve en todos los grupos donde estás." },
  { id: "actual", titulo: "Solo en el grupo que estoy viendo", detalle: "Se publica en el grupo que tenés abierto arriba." },
  { id: "elegir", titulo: "Elegir en cada comida", detalle: "Al subir una comida tocás en qué grupos va." },
];

// Ajustes → Grupos: en cuáles estás, pedir entrar a otro con un código, crear uno, salir,
// administrar los tuyos (aceptar a los que piden entrar) y dónde se publican tus comidas.
export default function MisGrupos({ avisar }) {
  const { usuario, yo, grupo, misGrupos, cambiarGrupo, recargarGrupos, cargarPerfiles } = useDatos();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [saliendo, setSaliendo] = useState(null);
  const publicarEn = yo.publicar_en || "todos";
  const [admin, setAdmin] = useState([]);
  const [pedidos, setPedidos] = useState([]);

  const cargarPedidos = useCallback(async () => {
    const [a, p] = await Promise.all([gruposQueAdministro(), misPedidos()]);
    setAdmin(a);
    setPedidos(p);
  }, []);
  useEffect(() => {
    cargarPedidos();
    window.addEventListener(EVENTO_PEDIDOS, cargarPedidos);
    return () => window.removeEventListener(EVENTO_PEDIDOS, cargarPedidos);
  }, [cargarPedidos]);

  async function sumarme(e) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setEnviando(true);
    setError("");
    try {
      const r = await pedirEntrar(codigo);
      if (r.estado === "ya_estas") return setError(`Ya estás en ${r.nombre}.`);
      vibrar(20);
      setCodigo("");
      if (r.estado === "adentro") {
        avisar?.(`Te sumaste a ${r.nombre}`);
        return await recargarGrupos();
      }
      avisar?.(`Le pedimos al admin de ${r.nombre} que te acepte`);
      await cargarPedidos();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id) {
    if (await cancelarPedido(id)) await cargarPedidos();
  }

  async function creado(nuevo) {
    avisar?.(`Creaste ${nuevo.nombre}. Compartí el código para que entren.`);
    // Pasa a ver el grupo nuevo: se recarga todo.
    await recargarGrupos();
  }

  async function salir(id) {
    if (saliendo !== id) return setSaliendo(id);
    const { error: err } = await supabase.rpc("salir_de_grupo", { p_grupo: id });
    setSaliendo(null);
    if (err) return avisar?.("No se pudo salir del grupo");
    avisar?.("Saliste del grupo");
    await recargarGrupos();
  }

  async function elegirPublicar(id) {
    const { error: err } = await supabase.from("perfiles").update({ publicar_en: id }).eq("id", usuario.id);
    if (err) return avisar?.("No se pudo guardar");
    vibrar(8);
    await cargarPerfiles();
  }

  return (
    <section className="tarjeta ajuste mis-grupos">
      <h3 className="perfil-subtitulo">Tus grupos</h3>
      <ul className="lista-grupos">
        {misGrupos.map((g) => (
          <li key={g.id} className="grupo-fila">
            <span className="grupo-icono" aria-hidden="true"><Users size={18} /></span>
            <span className="grupo-nombre">
              {g.nombre}
              {(g.id === grupo.id || admin.includes(g.id)) && <small>{[g.id === grupo.id && "Lo estás viendo", admin.includes(g.id) && "Lo administrás"].filter(Boolean).join(" · ")}</small>}
            </span>
            {admin.includes(g.id) && <ShieldCheck className="grupo-admin" size={16} aria-label="Lo administrás" />}
            {g.id !== grupo.id && <button className="boton-chico" onClick={() => cambiarGrupo(g.id)}>Ver</button>}
            {misGrupos.length > 1 && (
              <button className={saliendo === g.id ? "boton-chico peligro" : "boton-chico"} onClick={() => salir(g.id)} onBlur={() => setSaliendo(null)} aria-label={`Salir de ${g.nombre}`}>
                <LogOut size={15} /> {saliendo === g.id ? "¿Seguro?" : "Salir"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <PedidosEnviados pedidos={pedidos} onCancelar={cancelar} />

      <form className="sumarme-grupo" onSubmit={sumarme}>
        <label>
          <span>Sumarme a otro grupo</span>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código del grupo" autoCapitalize="none" autoCorrect="off" autoComplete="off" />
        </label>
        <button className="boton" type="submit" disabled={enviando || !codigo.trim()}><Plus size={17} /> {enviando ? "Pidiendo…" : "Pedir entrar"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <CrearGrupo onCreado={creado} />

      {misGrupos.filter((g) => admin.includes(g.id)).map((g) => (
        <AdminGrupo key={g.id} grupo={g} esVista={g.id === grupo.id} avisar={avisar} />
      ))}

      <h3 className="perfil-subtitulo">Dónde se publican tus comidas</h3>
      {misGrupos.length > 1 ? (
        <div className="opciones-publicar" role="radiogroup" aria-label="Dónde se publican tus comidas">
          {OPCIONES.map((o) => (
            <button key={o.id} role="radio" aria-checked={publicarEn === o.id} className={publicarEn === o.id ? "opcion-publicar activa" : "opcion-publicar"} onClick={() => elegirPublicar(o.id)}>
              <span className="opcion-marca" aria-hidden="true">{publicarEn === o.id && <Check size={14} />}</span>
              <span><strong>{o.titulo}</strong><small>{o.detalle}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <p className="nota">Cuando estés en más de un grupo vas a poder elegir si tus comidas se publican en todos, solo en uno, o en cada comida.</p>
      )}
    </section>
  );
}
