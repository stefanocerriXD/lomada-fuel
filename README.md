# Lomada Fuel

App para subir las comidas del día con foto, calcular macros con bases de alimentos gratuitas, ver lo que come el grupo, chatear y seguir el resumen diario y semanal.

Todo corre con cuentas **personales**: GitHub, Supabase y Vercel. Nada de la empresa.

## Puesta en marcha

### 1. Supabase (cuenta personal)
1. Crear un proyecto nuevo.
2. En **SQL Editor**, ejecutar en orden `supabase/schema.sql`, `supabase/002_rediseno.sql`, `supabase/004_personal_y_bot.sql`, `supabase/005_retos_y_habitos.sql` y `supabase/006_mails_permitidos.sql`. Crean las tablas, la seguridad (RLS), el bucket privado `fotos`, el tiempo real y todas las funciones de la app.
3. En **Authentication → URL Configuration**, cargar la URL de la app (la de Vercel, y `http://localhost:5173` para desarrollo) como *Site URL* y *Redirect URL*. Sin esto, el link del mail no vuelve a la app.
4. Copiar la URL del proyecto y la clave publicable (Project Settings → API).

### 2. Desarrollo local
```
cp .env.example .env.local   # completar las variables
npm install
npm run dev
```
`npm run dev` también corre las funciones de `/api`, así que el buscador funciona sin instalar nada más.

### 3. Vercel (cuenta personal)
1. Importar el repo de GitHub personal.
2. En **Settings → Environment Variables**, cargar las variables de `.env.example`.
3. Deploy. La URL que queda es el link para compartir con los amigos.

## De dónde salen los macros
| Fuente | Qué cubre | Costo |
|---|---|---|
| [Open Food Facts](https://world.openfoodfacts.org) | Productos envasados con código de barras, incluidos los de supermercados argentinos. Es colaborativa: puede tener errores o faltar productos. | Gratis, sin clave |
| [USDA FoodData Central](https://fdc.nal.usda.gov) | Alimentos genéricos, en inglés. | Gratis. Conviene una clave propia (`USDA_API_KEY`) |
| `src/data/alimentos-ar.js` | Platos típicos y alimentos básicos con valores aproximados. | Incluido |

El buscador prioriza lo típico y lo argentino. Si un producto no aparece, se escanea o se carga a mano.

## Plan personal
Con sexo, año de nacimiento, altura, peso, días de actividad y peso objetivo, la app estima el gasto diario con la fórmula de Mifflin-St Jeor y sugiere una meta. Para bajar de peso, el recorte no supera el 25% del gasto ni deja la meta por debajo del metabolismo en reposo o de 1.200 kcal. Son estimaciones y no reemplazan a un profesional. Altura, peso y objetivo son privados: cada persona ve solo los suyos.

## Bot semanal
Publica en el chat los premios de la semana anterior: quién comió más, quién sumó más proteína, quién fue más constante y quién subió más comidas. Se dispara cuando alguien abre la app desde el lunes a las 9 (hora de Argentina) y publica una sola vez por semana, sin ningún servicio aparte.

## Retos y hábitos
- **Desafíos:** proteína, racha de registros, agua y fotos. Participa todo el grupo.
- **Medallas:** se ganan solas al cumplir cada logro.
- **Agua y ayuno:** en el resumen del día.
- **Favoritas:** una comida del muro se guarda con la estrella y se repite con un toque.
- **Meta adaptativa:** con 14 días de seguimiento, 4 pesajes y 10 días completos de comidas, compara lo que comés con tu peso real. El ajuste se aplica solo si lo aceptás.
- **Comidas privadas:** no las ve el grupo, ni cuentan en desafíos o premios.

## Recomendador de comidas
Compara lo cargado en el día con tu meta, reparte lo que falta entre las comidas pendientes y busca en un recetario propio (`src/data/recetas.js`) las opciones que mejor cierran el día. Ajusta los gramos de cada ingrediente dentro de porciones razonables. No usa IA ni tiene costo.

## Notificaciones
1. Generar las claves con `npx web-push generate-vapid-keys`.
2. Cargar en Vercel `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SECRET_KEY` y `APP_URL`.
3. Cada persona las activa desde Ajustes. En iPhone hace falta agregar la app a la pantalla de inicio.

## Instalar en el celular
Con la app publicada, abrir el link y elegir **Agregar a pantalla de inicio** desde el navegador. Abre a pantalla completa, como una app.

## WHOOP (opcional)
Conexión oficial que trae recuperación, sueño, esfuerzo y calorías quemadas. Cada uno ve solo sus datos. WHOOP no tiene datos de comidas.

1. Ejecutar `supabase/003_whoop.sql` en Supabase.
2. Crear una app en [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com) con los permisos `read:recovery`, `read:cycles` y `read:sleep`, y esta dirección de retorno: `https://TU-APP.vercel.app/api/whoop`.
3. Cargar en Vercel `APP_URL`, `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` y `SUPABASE_SECRET_KEY`.

Una app nueva admite hasta 10 miembros de WHOOP.

## Costo
La app está pensada para costo cero: no usa IA paga ni servicios con cobro por uso. Corre en los planes gratuitos de Supabase y Vercel, con sus límites, y sin cargar tarjeta. La foto es solo para mostrar en el muro; los macros salen del buscador, del código de barras o de la carga a mano.

## Seguridad
- Solo pueden registrarse los mails cargados en `mails_permitidos` (`supabase/006_mails_permitidos.sql`).
- Todas las tablas tienen RLS: solo usuarios logueados ven datos, y cada uno edita o borra solo lo suyo.
- Las fotos están en un bucket privado y se sirven con links firmados de 1 hora.
- Las funciones de `/api` verifican que quien llama esté logueado.
- Los tokens de WHOOP están en una tabla sin permisos para el navegador.
