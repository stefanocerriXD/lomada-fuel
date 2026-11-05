import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo corre las funciones de /api igual que Vercel, sin instalar nada más.
function apiLocal() {
  return {
    name: "api-local",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://local");
        const nombre = url.pathname.match(/^\/api\/([a-z]+)$/)?.[1];
        if (!nombre) return next();
        try {
          const { default: handler } = await server.ssrLoadModule(`/api/${nombre}.js`);
          let cuerpo = "";
          for await (const parte of req) cuerpo += parte;
          req.query = Object.fromEntries(url.searchParams);
          req.body = cuerpo ? JSON.parse(cuerpo) : undefined;
          res.status = (codigo) => ((res.statusCode = codigo), res);
          res.json = (datos) => {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(datos));
          };
          await handler(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return { plugins: [react(), apiLocal()] };
});
