import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useDatos } from "../lib/datos.jsx";
import { vibrar } from "./Base.jsx";

// Qué notificaciones recibe cada uno. Lo que se apaga acá no se manda (lo filtra la base).
const SECCIONES = [
  {
    titulo: "Del grupo",
    opciones: [
      ["mensajes", "Mensajes del chat"],
      ["reacciones", "Reacciones a tus comidas y mensajes"],
      ["comidas", "Comidas nuevas del grupo"],
      ["invitaciones", "Cuando te suman a una comida o salida"],
      ["logros", "Logros de los demás"],
    ],
  },
  {
    titulo: "Recordatorios",
    opciones: [
      ["recordatorio", "Cargar las comidas (21 h)"],
      ["caca", "La foto del día (22 h)"],
      ["registros", "Tus recordatorios y registros diarios"],
    ],
  },
  {
    titulo: "Resúmenes y otros",
    opciones: [
      ["semana", "Podios del lunes"],
      ["informe", "Informe semanal (domingo)"],
      ["lomada", "Tu viaje y tu Match Day"],
      ["grupos", "Pedidos para entrar a tus grupos"],
      ["mejoras", "Mejoras (cuando responden o hacen la tuya)"],
      ["anuncios", "Anuncios de la app"],
    ],
  },
];

export default function PreferenciasAvisos({ activas, avisar }) {
  const { usuario, grupo, misGrupos } = useDatos();
  const [apagados, setApagados] = useState(null);
  const [sinTabla, setSinTabla] = useState(false);
  const conBocha = grupo.conBocha || misGrupos.some((g) => g.conBocha);

  useEffect(() => {
    supabase.from("preferencias_avisos").select("apagados").eq("usuario_id", usuario.id).maybeSingle().then(({ data, error }) => {
      if (error) return setSinTabla(true);
      setApagados(data?.apagados || []);
    });
  }, [usuario.id]);

  if (sinTabla || apagados === null) return null;

  async function alternar(id) {
    const antes = apagados;
    const nuevos = apagados.includes(id) ? apagados.filter((x) => x !== id) : [...apagados, id];
    setApagados(nuevos);
    vibrar(8);
    const { error } = await supabase.from("preferencias_avisos").upsert({ usuario_id: usuario.id, apagados: nuevos, actualizado_en: new Date().toISOString() }, { onConflict: "usuario_id" });
    if (error) {
      setApagados(antes);
      avisar?.("No se pudo guardar");
    }
  }

  return (
    <div className={activas ? "preferencias-avisos" : "preferencias-avisos apagadas"}>
      <h3 className="perfil-subtitulo">Qué querés recibir</h3>
      {!activas && <p className="nota">Primero activá las notificaciones en este celu. Lo que elijas acá vale para todos tus celulares.</p>}
      {SECCIONES.map((s) => (
        <div key={s.titulo} className="preferencias-grupo">
          <p className="preferencias-titulo">{s.titulo}</p>
          {s.opciones.filter(([, , solo]) => solo !== "bocha" || conBocha).map(([id, texto]) => {
            const prendida = !apagados.includes(id);
            return (
              <button key={id} type="button" role="switch" aria-checked={prendida} className="preferencia" onClick={() => alternar(id)}>
                <span>{texto}</span>
                <span className={prendida ? "llave-aviso prendida" : "llave-aviso"} aria-hidden="true"><i /></span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
