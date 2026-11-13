// Productos que no estaban en la base y alguien cargó leyendo la etiqueta.
// Quedan guardados en el celu y viajan dentro de las comidas (con su código), así el grupo también los encuentra al escanear.
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
