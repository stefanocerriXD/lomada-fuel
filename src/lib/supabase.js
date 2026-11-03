import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env.local");
}

// La clave anónima es pública por diseño: la seguridad la dan las políticas RLS del schema.sql.
export const supabase = createClient(url, anonKey);
