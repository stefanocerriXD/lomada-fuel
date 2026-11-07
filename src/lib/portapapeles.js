// Lee lo copiado en el celular, sea una captura o texto.
function comoArchivo(blob, tipo) {
  return new File([blob], "captura", { type: tipo });
}

export async function leerPortapapeles() {
  if (navigator.clipboard?.read) {
    const elementos = await navigator.clipboard.read();
    for (const elemento of elementos) {
      const tipo = elemento.types.find((t) => t.startsWith("image/"));
      if (tipo) return { imagen: comoArchivo(await elemento.getType(tipo), tipo) };
    }
    const conTexto = elementos.find((e) => e.types.includes("text/plain"));
    if (conTexto) return { texto: await (await conTexto.getType("text/plain")).text() };
    return {};
  }
  return { texto: await navigator.clipboard.readText() };
}

// Para cuando se pega con el menú del teclado en vez de usar el botón.
export function imagenPegada(datos) {
  const archivo = [...(datos?.files || [])].find((f) => f.type.startsWith("image/"));
  if (archivo) return archivo;
  const elemento = [...(datos?.items || [])].find((i) => i.kind === "file" && i.type.startsWith("image/"));
  return elemento?.getAsFile() || null;
}
