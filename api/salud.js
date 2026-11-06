// Recibe los datos del Atajo del iPhone. Los Atajos pueden mandar valores como "1.650,5 kcal".
const ERRORES = { token_invalido: 401, fecha_invalida: 400, valores_invalidos: 400 };

export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  let texto = String(valor).replace(/[^\d.,]/g, "");
  if (!texto) return null;
  const decimal = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
  if (decimal >= 0 && texto.length - decimal - 1 !== 3) {
    texto = `${texto.slice(0, decimal).replace(/[.,]/g, "")}.${texto.slice(decimal + 1)}`;
  } else {
    texto = texto.replace(/[.,]/g, "");
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

const hoyEnArgentina = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const datos = typeof req.body === "object" && req.body ? req.body : {};
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha || "") ? datos.fecha : hoyEnArgentina();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const clave = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  const resp = await fetch(`${url}/rest/v1/rpc/registrar_salud`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: clave },
    body: JSON.stringify({
      p_token: String(datos.token || ""),
      p_fecha: fecha,
      p_calorias: aNumero(datos.calorias),
      p_proteinas: aNumero(datos.proteinas),
      p_carbohidratos: aNumero(datos.carbohidratos),
      p_grasas: aNumero(datos.grasas),
      p_peso: aNumero(datos.peso),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (resp.ok) return res.status(200).json({ ok: true, fecha });
  const cuerpo = await resp.json().catch(() => ({}));
  const codigo = Object.keys(ERRORES).find((c) => cuerpo.message?.includes(c));
  return res.status(ERRORES[codigo] || 502).json({ error: codigo || "No se pudo guardar" });
}
