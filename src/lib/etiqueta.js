// Lee el texto de una tabla de información nutricional (sacado con el lector del celu) y saca kcal y macros.
// Las etiquetas argentinas traen los valores por porción; muchas importadas, cada 100 g; algunas, las dos columnas.
const normal = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NUTRIENTES = {
  kcal: /valor energetic|energia|calorias|energy|\bkcal\b/,
  c: /carbohidrat|hidratos de carbono|carbohydrat|glucidos/,
  p: /proteina|protein/,
  g: /grasas? totales?|lipidos totales|total fat|grasas?\b|lipidos|\bfat\b/,
};
// Filas que se parecen pero no son el total.
const NO_ES = {
  kcal: /^$/,
  c: /azucar|sugar/,
  p: /^$/,
  g: /saturad|trans|monoinsat|poliinsat|colesterol/,
};

// El lector confunde letras con números dentro de los valores: "3,O g", "l5 g".
function arreglarNumeros(linea) {
  return linea
    .replace(/(\d)[oO](?=\s*(g|kcal|kj|mg|,|\.|\s|$))/g, "$10")
    .replace(/\b[oO](?=[.,]\d)/g, "0")
    .replace(/\b[oO](?=\s*g\b)/g, "0")
    .replace(/\b[lI|](?=\d)/g, "1")
    .replace(/(\d)\s*[,.]\s*(\d)/g, "$1.$2");
}

const numero = (t) => Number(String(t).replace(",", "."));

function valoresDe(linea, clave) {
  const texto = arreglarNumeros(linea);
  if (clave === "kcal") {
    const kcal = [...texto.matchAll(/(\d+(?:\.\d+)?)\s*k\s*c\s*a\s*[l1i]/g)].map((m) => numero(m[1]));
    if (kcal.length) return kcal;
    const kj = [...texto.matchAll(/(\d+(?:\.\d+)?)\s*k\s*j/g)].map((m) => Math.round(numero(m[1]) / 4.184));
    if (kj.length) return kj;
    return [...texto.matchAll(/(\d+(?:\.\d+)?)(?!\s*%)/g)].map((m) => numero(m[1])).slice(0, 1);
  }
  // Los gramos llevan "g"; el % de valor diario, no.
  const conG = [...texto.matchAll(/(\d+(?:\.\d+)?)\s*g\b/g)].map((m) => numero(m[1]));
  if (conG.length) return conG;
  // Sin "g": el lector suele leer la "g" pegada como un 9 ("2,4g" sale "249" o "3,0g" sale "3,09").
  return [...texto.matchAll(/(\d+(?:\.\d+)?)(?!\s*(%|mg))/g)].map((m) => alternativas(m[1])).slice(0, 1);
}

// Lecturas posibles de un número sin unidad: tal cual, sin el 9 del final, y con la coma perdida.
function alternativas(crudo) {
  const lista = [numero(crudo)];
  if (/9$/.test(crudo) && crudo.length > 1) {
    const sin9 = crudo.slice(0, -1).replace(/\.$/, "");
    lista.unshift(numero(sin9));
    if (!sin9.includes(".") && sin9.length >= 2) lista.splice(1, 0, numero(`${sin9.slice(0, -1)}.${sin9.slice(-1)}`));
  }
  return { opciones: [...new Set(lista)] };
}

const opcionesDe = (v) => (v && typeof v === "object" ? v.opciones : v == null ? [null] : [v]);

// Entre las lecturas posibles, la que mejor cierra con las calorías de la etiqueta.
function elegirConCalorias(r) {
  const [ps, cs, gs] = [r.p, r.c, r.g].map(opcionesDe);
  if (ps.length * cs.length * gs.length === 1) return { ...r, p: ps[0], c: cs[0], g: gs[0] };
  let mejor = null;
  ps.forEach((p, ip) => cs.forEach((c, ic) => gs.forEach((g, ig) => {
    const kcal = (p || 0) * 4 + (c || 0) * 4 + (g || 0) * 9;
    const error = r.kcal ? Math.abs(kcal - r.kcal) / Math.max(r.kcal, 50) : 0;
    const puntaje = error + (ip + ic + ig) * 0.03;
    if (!mejor || puntaje < mejor.puntaje) mejor = { puntaje, p, c, g };
  })));
  return { ...r, p: mejor.p, c: mejor.c, g: mejor.g };
}

export function leerEtiqueta(textoCrudo) {
  const lineas = normal(textoCrudo).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valores = {};
  let primeraFila = lineas.length;

  for (const [clave, patron] of Object.entries(NUTRIENTES)) {
    const candidatas = lineas.map((l, i) => [l, i]).filter(([l]) => patron.test(l) && !NO_ES[clave].test(l));
    // "Grasas totales" gana sobre cualquier otra línea de grasas.
    if (clave === "g") candidatas.sort(([a], [b]) => Number(/totales?|total fat/.test(b)) - Number(/totales?|total fat/.test(a)));
    for (const [linea, i] of candidatas) {
      const despues = linea.slice(linea.search(patron));
      let lista = valoresDe(despues, clave);
      // A veces el número quedó en el renglón de abajo.
      if (!lista.length && lineas[i + 1] && !Object.values(NUTRIENTES).some((p) => p.test(lineas[i + 1]))) lista = valoresDe(lineas[i + 1], clave);
      if (lista.length) {
        valores[clave] = lista;
        primeraFila = Math.min(primeraFila, i);
        break;
      }
    }
  }

  // Porción: "Porción 30 g (1 taza)", "Porción: 2 galletitas (25 g)", "Serving size 30g".
  const texto = arreglarNumeros(lineas.join("\n"));
  const porcionLinea = texto.match(/(porcion|serving size|por porcion)[^\n]*/);
  let porcionG = null;
  if (porcionLinea) {
    const g = porcionLinea[0].match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/);
    if (g) porcionG = numero(g[1]);
  }

  // ¿Qué columna es cuál? Se mira el encabezado, antes de la primera fila de valores.
  const encabezado = lineas.slice(0, primeraFila).join(" ");
  const pos100 = encabezado.search(/(por|cada|per)?\s*100\s*(g|ml|gr)\b/);
  const posPorcion = encabezado.search(/(por|cantidad por) porcion|per serving|por porcion/);
  const columnas = Math.max(...Object.values(valores).map((l) => l.length), 0);
  let base = "porcion";
  let indice = 0;
  if (pos100 >= 0 && (posPorcion < 0 || columnas < 2)) base = "100g";
  if (pos100 >= 0 && posPorcion >= 0 && columnas >= 2) {
    base = "100g";
    indice = pos100 < posPorcion ? 0 : 1;
  }
  if (base === "porcion" && pos100 < 0 && posPorcion < 0 && !porcionG) base = "100g";

  const tomar = (clave) => {
    const lista = valores[clave];
    if (!lista?.length) return null;
    return lista[Math.min(indice, lista.length - 1)];
  };
  const kcalLeida = tomar("kcal");
  const resultado = elegirConCalorias({ kcal: opcionesDe(kcalLeida)[0], p: tomar("p"), c: tomar("c"), g: tomar("g") });
  // Si faltan las kcal pero están los macros, se calculan.
  if (resultado.kcal == null && [resultado.p, resultado.c, resultado.g].every((v) => v != null)) {
    resultado.kcal = Math.round(resultado.p * 4 + resultado.c * 4 + resultado.g * 9);
  }
  const encontrados = Object.values(resultado).filter((v) => v != null).length;
  return { base, porcionG, valores: resultado, encontrados };
}

// Lo que se muestra (por porción o cada 100 g) pasado a valores cada 100 g, que es lo que usa la app.
export function aPor100({ base, porcionG, valores }) {
  const f = base === "100g" ? 1 : 100 / Number(porcionG);
  if (!Number.isFinite(f) || f <= 0) return null;
  const r = (v) => Math.round((Number(v) || 0) * f * 10) / 10;
  const por100 = { kcal: Math.round((Number(valores.kcal) || 0) * f), p: r(valores.p), c: r(valores.c), g: r(valores.g) };
  if (por100.kcal > 950 || por100.p + por100.c + por100.g > 105) return null;
  return por100;
}
