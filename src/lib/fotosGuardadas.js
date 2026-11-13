// Las fotos quedan guardadas en el celu, como en WhatsApp: se bajan una vez y después abren al instante, aun sin señal.
// Cada foto tiene una ruta única (nunca se pisa), así que lo guardado siempre es lo correcto.
const CACHE = "lomada-fotos-v1";
const MAXIMO = 900; // Las más viejas se van solas para no llenar el teléfono.
const clave = (ruta) => `/foto-guardada/${encodeURIComponent(ruta)}`;
const esImagen = (ruta) => /\.(jpe?g|png|gif|webp|heic)$/i.test(ruta);
// Un link por foto para toda la app: no se revocan porque los comparten varias pantallas.
const links = new Map();

async function abrir() {
  try {
    return "caches" in window ? await caches.open(CACHE) : null;
  } catch {
    return null; // Navegación privada o sin espacio: se usan los links de siempre.
  }
}

// Las que ya están en el celu, como links locales.
export async function fotosGuardadas(rutas) {
  const encontradas = {};
  const buscar = rutas.filter((r) => esImagen(r) && !links.has(r));
  rutas.forEach((r) => { if (links.has(r)) encontradas[r] = links.get(r); });
  if (!buscar.length) return encontradas;
  const cache = await abrir();
  if (!cache) return encontradas;
  await Promise.all(buscar.map(async (ruta) => {
    try {
      const resp = await cache.match(clave(ruta));
      if (!resp) return;
      const link = URL.createObjectURL(await resp.blob());
      links.set(ruta, link);
      encontradas[ruta] = link;
    } catch {
      // Si una falla, se baja de nuevo.
    }
  }));
  return encontradas;
}

// Baja en segundo plano las que se vieron por primera vez, de a pocas para no trabar la carga.
export async function guardarFotos(pares) {
  const pendientes = pares.filter(({ ruta, url }) => url && esImagen(ruta) && !links.has(ruta));
  if (!pendientes.length) return;
  const cache = await abrir();
  if (!cache) return;
  const trabajar = async () => {
    for (let par = pendientes.shift(); par; par = pendientes.shift()) {
      try {
        const resp = await fetch(par.url);
        if (resp.ok && (resp.headers.get("content-type") || "").startsWith("image/")) await cache.put(clave(par.ruta), resp);
      } catch {
        // Sin señal: se vuelve a intentar la próxima vez que aparezca.
      }
    }
  };
  await Promise.all([trabajar(), trabajar(), trabajar()]);
  try {
    const guardadas = await cache.keys();
    await Promise.all(guardadas.slice(0, Math.max(0, guardadas.length - MAXIMO)).map((r) => cache.delete(r)));
  } catch {
    // Recortar es opcional.
  }
}

// Al cerrar sesión no quedan fotos del grupo en el teléfono.
export async function borrarFotosGuardadas() {
  links.clear();
  try {
    if ("caches" in window) await caches.delete(CACHE);
  } catch {
    // Nada que borrar.
  }
}
