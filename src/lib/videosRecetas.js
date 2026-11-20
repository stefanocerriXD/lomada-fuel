// Videos de recetas: un link de TikTok, Instagram o YouTube con un nombre. No tienen ingredientes ni calorías.

export const REDES = {
  tiktok: { nombre: "TikTok" },
  instagram: { nombre: "Instagram" },
  youtube: { nombre: "YouTube" },
  otro: { nombre: "Video" },
};

// Lo que se comparte desde las apps suele traer texto alrededor ("Mirá este video... https://vm.tiktok.com/xyz/").
export function extraerLink(texto) {
  const hallado = String(texto || "").match(/https?:\/\/[^\s<>"']+/i);
  if (!hallado) return null;
  const limpio = hallado[0].replace(/[),.;!?]+$/, "");
  try {
    const url = new URL(limpio);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href.slice(0, 500) : null;
  } catch {
    return null;
  }
}

export function redDeLink(link) {
  let host = "";
  try {
    host = new URL(link).hostname.toLowerCase().replace(/^www\.|^m\./, "");
  } catch {
    return "otro";
  }
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)instagram\.com$/.test(host) || host === "instagr.am") return "instagram";
  if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be") return "youtube";
  return "otro";
}

// YouTube deja ver la miniatura sin pedir permiso. TikTok e Instagram no: van con su etiqueta.
export function miniaturaDe(link) {
  if (redDeLink(link) !== "youtube") return null;
  try {
    const url = new URL(link);
    const id = url.hostname.endsWith("youtu.be")
      ? url.pathname.slice(1)
      : url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    return id && /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

// Si no le ponen nombre: "Receta de TikTok".
export const nombrePorDefecto = (red) => `Receta de ${REDES[red]?.nombre === "Video" ? "un video" : REDES[red]?.nombre || "un video"}`;
