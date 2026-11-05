// Los archivos con guion bajo no se publican como endpoints en Vercel.
export async function usuarioActual(req) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const resp = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: clave },
  });
  return resp.ok ? resp.json() : null;
}

export async function usuarioLogueado(req) {
  return Boolean(await usuarioActual(req));
}
