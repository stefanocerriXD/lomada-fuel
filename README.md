# Comidas entre amigos

App para subir las comidas del día (desayuno, almuerzo, merienda y cena), estimar los macros con una foto, corregirlos a mano, chatear con el grupo y ver el resumen semanal.

Todo corre con cuentas **personales**: GitHub, Supabase y Vercel. Nada de la empresa.

## Puesta en marcha

### 1. Supabase (cuenta personal)
1. Crear un proyecto nuevo.
2. En **SQL Editor**, pegar y ejecutar `supabase/schema.sql`. Crea las tablas, las políticas de seguridad (RLS), el bucket privado `fotos` y el chat en tiempo real.
3. En **Authentication → URL Configuration**, cargar la URL de la app (la de Vercel, y `http://localhost:5173` para desarrollo) como *Site URL* y *Redirect URL*. Sin esto, el link del mail no vuelve a la app.
4. Copiar la URL del proyecto y la clave `anon` (Project Settings → API).

### 2. Desarrollo local
```
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```
La foto con IA usa `/api/analyze`, que corre en Vercel. Para probarla en local hace falta `vercel dev`.

### 3. Vercel (cuenta personal)
1. Importar el repo de GitHub personal.
2. En **Settings → Environment Variables**, cargar las variables de `.env.example`. La `ANTHROPIC_API_KEY` va **solo** acá, nunca en el front ni en el chat.
3. Deploy. La URL que queda es el link para compartir con los amigos.

## Costo de la IA
Cada foto usa unos 1.600 tokens de entrada y 200 de salida. Con Haiku (modelo por defecto) son centésimas de centavo por foto. El consumo de la API se cobra aparte de la suscripción de Claude.

Si la estimación no sirve, cada uno puede corregir los macros a mano desde la tarjeta de la comida.

## Seguridad
- Todas las tablas tienen RLS: solo usuarios logueados ven datos, y cada uno edita o borra solo lo suyo.
- Las fotos están en un bucket privado y se sirven con links firmados de 1 hora.
- La clave de Anthropic vive solo en Vercel. La función verifica que quien llama esté logueado antes de usar la IA.
