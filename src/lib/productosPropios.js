// Productos que no estaban en la base y alguien cargó leyendo la etiqueta.
// Quedan guardados en el celu y viajan dentro de las comidas (con su código), así el grupo también los encuentra al escanear.
// Además (SQL 054) todo producto que alguien usa queda en el catálogo compartido de TODA la app.
import { supabase } from "./supabase.js";

const CLAVE = "lomada-productos";

function leer() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "{}");
  } catch {
    return {};
  }
}

export function guardarProducto(alimento) {
  if (!alimento.codigo) return;
  const { nombre, marca, fuente, por100, porcion, codigo } = alimento;
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), [codigo]: { id: `etiqueta-${codigo}`, nombre, marca, fuente, por100, porcion, codigo } }));
  } catch {
    // Sin lugar: igual queda en la comida.
  }
}

export function buscarProductoPropio(codigo, comidas = []) {
  const guardado = leer()[codigo];
  if (guardado) return guardado;
  for (const c of comidas) {
    const a = (c.alimentos || []).find((x) => x.codigo === codigo && x.por100);
    if (a) {
      const { nombre, marca, fuente, por100, porcion } = a;
      return { id: `etiqueta-${codigo}`, nombre, marca: marca || "", fuente: fuente || "etiqueta", por100, porcion: porcion || null, codigo };
    }
  }
  return null;
}

// ---------- Catálogo compartido de la app (SQL 054) ----------
const CAMPOS = "id, codigo, nombre, marca, por100, porcion, fuente, veces, usuarios";
const numero = (v) => Number(v) || 0;
const aAlimento = (r) => ({
  id: `app-${r.id}`,
  nombre: r.nombre,
  marca: r.marca || "",
  fuente: "app",
  por100: { kcal: numero(r.por100?.kcal), p: numero(r.por100?.p), c: numero(r.por100?.c), g: numero(r.por100?.g) },
  porcion: r.porcion || null,
  ...(r.codigo ? { codigo: r.codigo } : {}),
  usuarios: r.usuarios || 1,
  veces: r.veces || 1,
  // SQL 071: el nombre si es de tu grupo, "otro" si no; null si es tuyo o de Open Food Facts.
  cargadoPor: r.cargado_por || null,
});

export async function buscarEnCatalogo(codigo) {
  try {
    const conQuien = await supabase.rpc("producto_por_codigo", { p_codigo: codigo });
    if (!conQuien.error) return conQuien.data?.[0] ? aAlimento(conQuien.data[0]) : null;
    const { data, error } = await supabase.from("productos").select(CAMPOS).eq("codigo", codigo).maybeSingle();
    return !error && data ? aAlimento(data) : null;
  } catch {
    return null;
  }
}

export async function buscarCatalogo(texto) {
  try {
    const { data, error } = await supabase.rpc("buscar_productos", { p_texto: texto });
    return error ? [] : (data || []).map(aAlimento);
  } catch {
    return [];
  }
}

// Cada producto de marca que alguien carga suma al catálogo (o cuenta un uso). Si falla, no pasa nada.
const FUENTES_DE_TIENDA = new Set(["argentina", "mundo", "etiqueta", "app"]);
export function sumarAlCatalogo(alimento) {
  if (!alimento?.por100 || !FUENTES_DE_TIENDA.has(alimento.fuente)) return;
  const id = String(alimento.id || "");
  const codigo = alimento.codigo || (id.startsWith("off-") ? id.slice(4) : null);
  const valido = codigo && /^\d{6,14}$/.test(codigo) ? codigo : null;
  if (!valido && !alimento.marca) return;
  const fuente = alimento.fuente === "etiqueta" ? "etiqueta" : alimento.fuente === "app" ? "usuario" : "off";
  supabase
    .rpc("guardar_producto", { p_codigo: valido, p_nombre: alimento.nombre, p_marca: alimento.marca || "", p_por100: alimento.por100, p_porcion: alimento.porcion || null, p_fuente: fuente })
    .then(() => {}, () => {});
}

// Un alimento cargado a mano entra al buscador de todos (los demás lo ven "importado por" quien lo cargó).
export async function guardarAMano({ nombre, marca, por100 }) {
  const { error } = await supabase.rpc("guardar_producto", { p_codigo: null, p_nombre: nombre, p_marca: marca || "", p_por100: por100, p_porcion: null, p_fuente: "usuario" });
  return !error;
}
