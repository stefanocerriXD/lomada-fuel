// Los alimentos que cada uno ya usó, para volver a cargarlos con un toque.
const GENERICOS = /^(importado|foto|apple salud|comida)$|\simportado$/i;
const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// Deja el alimento listo para volver a cargarlo, con la última cantidad que se usó.
function limpio({ id, indice, ...alimento }) {
  return alimento;
}

export function alimentosUsados(comidas, usuarioId) {
  const propias = comidas
    .filter((c) => c.usuario_id === usuarioId)
    .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
  const vistos = new Map();
  for (const c of propias) {
    for (const a of c.alimentos || []) {
      if (!a.nombre || a.fuente === "foto" || GENERICOS.test(a.nombre)) continue;
      const clave = normal(a.nombre);
      const previo = vistos.get(clave);
      if (previo) previo.veces += 1;
      else vistos.set(clave, { alimento: limpio(a), veces: 1, ultima: c.creado_en });
    }
  }
  const lista = [...vistos.values()];
  const recientes = lista.slice(0, 8);
  const frecuentes = [...lista].sort((a, b) => b.veces - a.veces).filter((x) => x.veces > 1 && !recientes.includes(x)).slice(0, 6);
  return { todos: lista, recientes, frecuentes };
}

export function buscarEnHistorial(lista, texto) {
  const partes = normal(texto).split(/\s+/).filter((p) => p.length > 1);
  if (!partes.length) return [];
  return lista
    .filter(({ alimento }) => {
      const palabras = normal(alimento.nombre).split(/[\s,]+/);
      return partes.every((p) => palabras.some((w) => w.startsWith(p)));
    })
    .sort((a, b) => b.veces - a.veces)
    .slice(0, 5);
}
