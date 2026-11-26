// Links dentro de un texto del chat: "https://...", "www...." o un dominio conocido ("instagram.com/algo").
// Devuelve las partes en orden: { texto } para lo común y { texto, url } para cada link.
const TERMINACIONES = "com|ar|net|org|io|app|me|ly|gl|co|tv|es|uy|cl|mx|info|dev|link|gg|be|to";
const ENLACE = new RegExp(
  `(?:https?:\\/\\/|www\\.)[^\\s<>"]+|\\b(?:[a-z0-9-]+\\.)+(?:${TERMINACIONES})\\b(?:\\/[^\\s<>"]*)?`,
  "gi",
);

// El punto, la coma o el paréntesis de cierre del final suelen ser de la oración, no del link.
function recortarFinal(url) {
  let fin = url;
  for (;;) {
    const ultimo = fin.at(-1);
    if (/[.,;:!?'"¡¿…]/.test(ultimo)) fin = fin.slice(0, -1);
    else if (ultimo === ")" && (fin.match(/\(/g) || []).length < (fin.match(/\)/g) || []).length) fin = fin.slice(0, -1);
    else return fin;
  }
}

export function partirEnlaces(texto) {
  const partes = [];
  let desde = 0;
  for (const m of texto.matchAll(ENLACE)) {
    const antes = texto[m.index - 1];
    // Un mail (algo@gmail.com) o una mención no son links.
    if (antes === "@" || (antes && /[\w.-]/.test(antes) && !/^(https?:|www\.)/i.test(m[0]))) continue;
    const crudo = recortarFinal(m[0]);
    if (!crudo || !/[a-z]/i.test(crudo)) continue;
    if (m.index > desde) partes.push({ texto: texto.slice(desde, m.index) });
    const url = /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`;
    partes.push({ texto: crudo, url });
    desde = m.index + crudo.length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde) });
  return partes;
}
