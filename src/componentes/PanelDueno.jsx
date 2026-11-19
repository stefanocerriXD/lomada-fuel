import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { Avatar } from "./Base.jsx";
import EspacioApp from "./EspacioApp.jsx";
import AvisoATodos from "./AvisoATodos.jsx";

const num = (n) => Number(n || 0).toLocaleString("es-AR");
const diaCorto = (fecha) => new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }).replace(".", "");
const fechaCorta = (fecha) => (fecha ? new Date(`${String(fecha).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "") : "—");

// Solo para el dueño de la app: el espacio, números de toda la app y todos los usuarios.
export default function PanelDueno() {
  const [datos, setDatos] = useState(null);
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([supabase.rpc("admin_insights"), supabase.rpc("admin_usuarios")]).then(([i, u]) => {
      if (i.error || u.error) {
        const falta = /could not find|PGRST202/i.test(`${i.error?.message} ${i.error?.code}`);
        return setError(falta ? "Falta correr el SQL 048 en Supabase." : "No se pudieron leer los datos.");
      }
      setDatos(i.data);
      setUsuarios(u.data || []);
    });
  }, []);

  return (
    <div className="panel-dueno">
      <EspacioApp />
      <AvisoATodos />
      {error && <section className="tarjeta ajuste"><p className="nota">{error}</p></section>}
      {datos && (
        <>
          <section className="tarjeta ajuste">
            <h3 className="perfil-subtitulo">La app en números</h3>
            <div className="dueno-cifras">
              <Cifra valor={datos.usuarios} texto="usuarios" extra={datos.usuarios_nuevos_7 ? `+${datos.usuarios_nuevos_7} esta semana` : "ninguno nuevo esta semana"} />
              <Cifra valor={datos.activos_7} texto="activos (7 días)" extra={`${datos.activos_30} en 30 días`} />
              <Cifra valor={datos.comidas_7} texto="comidas (7 días)" extra={`${num(datos.fotos_7)} con foto`} />
              <Cifra valor={datos.mensajes_7} texto="mensajes (7 días)" />
              <Cifra valor={datos.grupos} texto="grupos" />
              <Cifra valor={datos.kcal_dia} texto="kcal por día" extra="promedio por persona" />
            </div>
          </section>

          <section className="tarjeta ajuste">
            <h3 className="perfil-subtitulo">Comidas por día</h3>
            <p className="dueno-sub">Últimos 14 días. Tocá una barra para ver el día.</p>
            <Barras
              valores={(datos.por_dia || []).map((d) => d.comidas)}
              etiqueta={(i) => {
                const d = datos.por_dia[i];
                return `${diaCorto(d.fecha)}: ${d.comidas} ${d.comidas === 1 ? "comida" : "comidas"} · ${d.personas} ${d.personas === 1 ? "persona" : "personas"}`;
              }}
              ejes={(datos.por_dia || []).map((d, i, todos) => (i === 0 || i === todos.length - 1 || i === 7 ? diaCorto(d.fecha) : ""))}
            />
          </section>

          <section className="tarjeta ajuste">
            <h3 className="perfil-subtitulo">A qué hora cargan</h3>
            <p className="dueno-sub">Comidas subidas por hora, últimos 30 días.</p>
            <Barras
              valores={datos.por_hora || []}
              etiqueta={(i) => `${i} a ${i + 1} h: ${datos.por_hora[i]} ${datos.por_hora[i] === 1 ? "comida" : "comidas"}`}
              ejes={Array.from({ length: 24 }, (_, i) => (i % 6 === 0 ? `${i} h` : ""))}
            />
          </section>

          <section className="tarjeta ajuste">
            <h3 className="perfil-subtitulo">Lo que más se come</h3>
            <p className="dueno-sub">Alimentos más cargados en los últimos 30 días.</p>
            {datos.top_alimentos?.length ? (
              <ol className="dueno-ranking">
                {datos.top_alimentos.map((a) => (
                  <li key={a.nombre}>
                    <span>{a.nombre}</span>
                    <i style={{ width: `${(a.veces / datos.top_alimentos[0].veces) * 100}%` }} aria-hidden="true" />
                    <strong>{num(a.veces)}</strong>
                  </li>
                ))}
              </ol>
            ) : <p className="nota">Todavía no hay alimentos cargados este mes.</p>}
          </section>

          <section className="tarjeta ajuste">
            <h3 className="perfil-subtitulo">Esta semana</h3>
            <ul className="dueno-datos">
              {datos.mas_activos?.length > 0 && <li><span>Los que más cargaron</span><strong>{datos.mas_activos.map((m) => `${m.nombre} (${m.comidas})`).join(", ")}</strong></li>}
              <li><span>Creatina tildada</span><strong>{num(datos.registros_7?.creatina)} veces</strong></li>
              <li><span>Días de gym</span><strong>{num(datos.registros_7?.gym)}</strong></li>
              <li><span>Vasos en modo fiesta (30 días)</span><strong>{num(datos.vasos_30)}</strong></li>
            </ul>
          </section>

          <section className="tarjeta ajuste">
            <h3 className="perfil-subtitulo">Grupos ({datos.grupos_lista?.length || 0})</h3>
            <ul className="dueno-datos">
              {(datos.grupos_lista || []).map((g) => (
                <li key={`${g.nombre}-${g.creado_en}`}>
                  <span>{g.nombre}{g.con_bocha ? " · con Bocha" : ""}</span>
                  <strong>{g.miembros} {g.miembros === 1 ? "integrante" : "integrantes"}</strong>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {usuarios && <Usuarios lista={usuarios} />}
    </div>
  );
}

function Cifra({ valor, texto, extra }) {
  return (
    <div className="dueno-cifra">
      <strong>{valor == null ? "—" : num(valor)}</strong>
      <span>{texto}</span>
      {extra && <small>{extra}</small>}
    </div>
  );
}

// Barras de una sola serie: tocá (o pasá el mouse) para ver el valor de cada una.
function Barras({ valores, etiqueta, ejes }) {
  const [elegida, setElegida] = useState(null);
  const maximo = Math.max(1, ...valores);
  const mostrada = elegida ?? valores.length - 1;
  return (
    <div className="dueno-barras">
      <p className="dueno-barras-valor" aria-live="polite">{valores.length ? etiqueta(mostrada) : ""}</p>
      <div className="dueno-barras-zona" onMouseLeave={() => setElegida(null)}>
        {valores.map((v, i) => (
          <button
            key={i}
            type="button"
            className={i === mostrada ? "activa" : ""}
            onClick={() => setElegida(i)}
            onMouseEnter={() => setElegida(i)}
            aria-label={etiqueta(i)}
          >
            <i style={{ height: `${v > 0 ? Math.max(4, (v / maximo) * 100) : 0}%` }} />
          </button>
        ))}
      </div>
      <div className="dueno-barras-ejes" aria-hidden="true">
        {ejes.map((e, i) => <span key={i}>{e}</span>)}
      </div>
    </div>
  );
}

function Usuarios({ lista }) {
  const [buscar, setBuscar] = useState("");
  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return q ? lista.filter((u) => `${u.nombre} ${u.usuario} ${(u.grupos || []).join(" ")}`.toLowerCase().includes(q)) : lista;
  }, [lista, buscar]);
  return (
    <section className="tarjeta ajuste">
      <h3 className="perfil-subtitulo">Usuarios registrados ({lista.length})</h3>
      <label className="dueno-buscar">
        <Search size={16} aria-hidden="true" />
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, usuario o grupo" aria-label="Buscar usuarios" />
      </label>
      <ul className="dueno-usuarios">
        {filtrados.map((u) => (
          <li key={u.id}>
            <Avatar perfil={u} tam={38} />
            <span className="dueno-usuario">
              <strong>{u.nombre}</strong>
              <small>@{u.usuario} · {u.grupos?.length ? u.grupos.join(", ") : "sin grupo"}</small>
              <small>Desde {fechaCorta(u.creado_en)} · última comida {fechaCorta(u.ultima_comida)}</small>
            </span>
            <span className="dueno-usuario-num">
              <strong>{num(u.comidas)}</strong>
              <small>{u.comidas_7_dias} esta sem.</small>
            </span>
          </li>
        ))}
      </ul>
      {!filtrados.length && <p className="nota">Nadie con ese nombre.</p>}
    </section>
  );
}
