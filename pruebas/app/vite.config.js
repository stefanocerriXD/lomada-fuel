import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "../../vite.config.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const mock = path.join(aqui, "supabase-mock.js").replaceAll("\\", "/");

export default (entorno) => {
  const config = base(entorno);
  return {
    ...config,
    root: path.resolve(aqui, "../.."),
    cacheDir: path.join(aqui, ".cache-vite"),
    // Sin el cartel de error de Vite: si una prueba cierra la ventana mientras baja un archivo, Vite lo toma como
    // error y lo muestra en todas las ventanas abiertas, tapando botones. Los errores reales los atrapa cada prueba.
    server: { port: 5199, strictPort: true, fs: { strict: false }, hmr: { overlay: false } },
    plugins: [
      {
        name: "dobles-de-prueba",
        enforce: "pre",
        resolveId(id) {
          if (id.split("/").pop() === "supabase.js") return mock;
          if (id.endsWith("_auth.js")) return "\0auth-prueba";
        },
        load(id) {
          if (id === "\0auth-prueba") return "export const usuarioLogueado = async () => true;";
        },
      },
      ...config.plugins,
    ],
  };
};
