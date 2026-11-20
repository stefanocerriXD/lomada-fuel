// El paso a paso de una receta se guarda como texto, un paso por renglón.
// Al mostrarlo se le saca la numeración que haya escrito cada uno ("1.", "Paso 2:", "-") y se numera prolijo.
const NUMERACION = /^\s*(?:paso\s*\d+\s*[:.)-]?|\d+\s*[.):-]|[-–•*·◦▪✓✔])\s*/iu;

export const MAX_PASOS = 4000;

export function listaDePasos(texto) {
  return String(texto || "")
    .split(/\r?\n/)
    .map((l) => l.replace(NUMERACION, "").trim())
    .filter(Boolean);
}

// Lo que se guarda: sin renglones vacíos de más. Vacío queda en null.
export function limpiarPasos(texto) {
  const limpio = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n").slice(0, MAX_PASOS);
  return limpio || null;
}

// Lo que viene después de "Preparación" (o "Pasos", "Procedimiento"...) en el texto de una receta.
const VIÑETA = /^[\s\-–•*·◦▪✓✔>#]+/u;
const TITULO_PASOS = /^(modo de preparaci[oó]n|preparaci[oó]n|procedimiento|pasos|instrucciones|elaboraci[oó]n)\b[\s:.-]*/i;

export function pasosDelTexto(texto) {
  const lineas = String(texto || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const desde = lineas.findIndex((l) => TITULO_PASOS.test(l.replace(VIÑETA, "")));
  if (desde < 0) return "";
  const primera = lineas[desde].replace(VIÑETA, "").replace(TITULO_PASOS, "").trim();
  return [primera, ...lineas.slice(desde + 1)].filter(Boolean).join("\n").slice(0, MAX_PASOS);
}
