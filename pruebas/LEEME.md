# Pruebas

```
npm install
npm run pruebas              # todo: la base y la app
npm run pruebas -- sql       # solo la base
npm run pruebas -- app       # solo la app
npm run pruebas -- chat      # solo las pruebas de la app con "chat" en el nombre
```

- **`sql/`**: corre `supabase/schema.sql` y todos los `0XX_*.sql` en orden sobre un Postgres embebido (PGlite) y prueba cada función, permiso (RLS) y aviso. También prueba el backup. No toca la base real.
- **`app/`**: levanta la app con Vite en el puerto 5199, con una base de Supabase simulada (`app/supabase-mock.js`), y la recorre en Chrome como un celular. Necesita Google Chrome instalado. Las capturas quedan en `app/capturas/` (no se suben).

Para probar algo nuevo de la app, copiá una prueba parecida. Las banderas del simulador (por ejemplo `window.__con054`) arman cada escenario; están todas en `supabase-mock.js`.

Cuando se agrega un SQL nuevo, se suma su prueba al final de `sql/todo.mjs`.

Los nombres de las pruebas son inventados. No se suben fotos reales: `correr.mjs` dibuja las imágenes que hacen falta.
