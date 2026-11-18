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
    server: { port: 5199, strictPort: true, fs: { strict: false } },
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
