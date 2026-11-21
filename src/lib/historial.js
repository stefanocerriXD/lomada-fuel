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

// Las comidas completas que cada uno ya cargó para ese momento del día, para repetirlas con un toque.
export function combosDe(comidas, usuarioId, tipo, tope = 5) {
  const vistos = new Set();
  const combos = [];
  const propias = comidas
    .filter((c) => c.usuario_id === usuarioId && c.tipo === tipo)
    .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
  for (const c of propias) {
    const alimentos = (c.alimentos || []).filter((a) => a.nombre && a.fuente !== "foto" && !GENERICOS.test(a.nombre));
    if (!alimentos.length) continue;
    const firma = alimentos.map((a) => normal(a.nombre)).sort().join("|");
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    combos.push({ id: c.id, fecha: c.fecha, nombre: c.descripcion || alimentos.map((a) => a.nombre).join(", "), kcal: Number(c.calorias) || 0, alimentos: alimentos.map(limpio) });
    if (combos.length >= tope) break;
  }
  return combos;
}

// Al buscar: tus comidas anteriores (de cualquier momento del día) que tengan esas palabras en el título o en un alimento.
export function buscarCombos(comidas, usuarioId, texto, tope = 3) {
  const palabras = normal(texto).split(/\s+/).filter((p) => p.length >= 2);
  if (!palabras.length) return [];
  const vistos = new Set();
  const combos = [];
  const propias = comidas
    .filter((c) => c.usuario_id === usuarioId && !["resumen", "fiesta"].includes(c.tipo))
    .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
  for (const c of propias) {
    const alimentos = (c.alimentos || []).filter((a) => a.nombre && a.fuente !== "foto" && !GENERICOS.test(a.nombre));
    if (!alimentos.length) continue;
    const donde = normal([c.descripcion, ...alimentos.map((a) => a.nombre)].join(" "));
    if (!palabras.every((p) => donde.includes(p))) continue;
    const firma = alimentos.map((a) => normal(a.nombre)).sort().join("|");
    if (vistos.has(firma)) continue;
    vistos.add(firma);
    combos.push({ id: c.id, tipo: c.tipo, fecha: c.fecha, nombre: c.descripcion || alimentos.map((a) => a.nombre).join(", "), kcal: Number(c.calorias) || 0, alimentos: alimentos.map(limpio) });
    if (combos.length >= tope) break;
  }
  return combos;
}

// Lo que cargaron los demás del grupo (solo comidas que el grupo puede ver), para encontrarlo al buscar.
export function alimentosDelGrupo(comidas, usuarioId) {
  const vistos = new Map();
  const ajenas = comidas.filter((c) => c.usuario_id !== usuarioId).sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
  for (const c of ajenas) {
    for (const a of c.alimentos || []) {
      if (!a.nombre || a.fuente === "foto" || GENERICOS.test(a.nombre)) continue;
      const clave = normal(a.nombre);
      const previo = vistos.get(clave);
      if (previo) {
        previo.veces += 1;
        previo.personas.add(c.usuario_id);
      } else vistos.set(clave, { alimento: limpio(a), veces: 1, ultima: c.creado_en, personas: new Set([c.usuario_id]) });
    }
  }
  return [...vistos.values()];
}

// Para marcar en los resultados del buscador los productos que ya cargaste (por nombre y marca).
export const claveAlimento = (a) => `${normal(a.nombre)}|${normal(a.marca)}`;
export function vecesPorAlimento(lista) {
  const mapa = new Map();
  for (const { alimento, veces, ultima } of lista) {
    mapa.set(claveAlimento(alimento), { veces, ultima });
    if (!mapa.has(`${normal(alimento.nombre)}|`)) mapa.set(`${normal(alimento.nombre)}|`, { veces, ultima });
  }
  return mapa;
}

// "hoy", "ayer", "hace 5 días", "hace 3 semanas".
export function haceTanto(iso) {
  if (!iso) return "";
  const dias = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
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
