// Recibe los datos del Atajo del iPhone. Los Atajos pueden mandar valores como "1.650,5 kcal".
const ERRORES = { token_invalido: 401, fecha_invalida: 400, valores_invalidos: 400 };

const NUMERO = "\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?";
const CON_UNIDAD = new RegExp(`(${NUMERO})\\s*(?:k?cal|kj|g\\b)`, "i");
const SUELTO = new RegExp(NUMERO);

// Un Atajo puede mandar "1.650,5 kcal", una lista de días o un texto con la fecha: se toma un solo valor.
export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (Array.isArray(valor)) return valor.length ? aNumero(valor[valor.length - 1]) : null;
  const original = String(valor);
  let texto = (original.match(CON_UNIDAD) || original.match(SUELTO))?.[1] ?? original.match(SUELTO)?.[0];
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

  const valores = { calorias: aNumero(datos.calorias), proteinas: aNumero(datos.proteinas), carbohidratos: aNumero(datos.carbohidratos), grasas: aNumero(datos.grasas), peso: aNumero(datos.peso) };
  // Lo que llegó, sin la llave, para poder revisar el Atajo.
  const recibido = Object.fromEntries(Object.keys(valores).filter((k) => datos[k] !== undefined).map((k) => [k, JSON.stringify(datos[k]).slice(0, 120)]));
  if (Object.values(valores).some((v) => v !== null && (v < 0 || v > 100000))) return res.status(400).json({ error: "valores_invalidos", recibido });

  const resp = await fetch(`${url}/rest/v1/rpc/registrar_salud`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: clave },
    body: JSON.stringify({
      p_token: String(datos.token || ""),
      p_fecha: fecha,
      p_calorias: valores.calorias,
      p_proteinas: valores.proteinas,
      p_carbohidratos: valores.carbohidratos,
      p_grasas: valores.grasas,
      p_peso: valores.peso,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (resp.ok) return res.status(200).json({ ok: true, fecha, guardado: valores, recibido });
  const cuerpo = await resp.json().catch(() => ({}));
  const codigo = Object.keys(ERRORES).find((c) => cuerpo.message?.includes(c));
  if (!codigo) console.error("Apple Salud no se pudo guardar:", cuerpo);
  // Nunca se devuelve la llave: solo si llegó y cuánto mide, para detectar un error al pegarla.
  const llave = typeof datos.token === "string" && datos.token ? `${datos.token.length} caracteres` : "no llegó";
  return res.status(ERRORES[codigo] || 502).json({ error: codigo || "No se pudo guardar", detalle: codigo ? undefined : `${cuerpo.code || resp.status}: ${cuerpo.message || ""}`.slice(0, 200), llave: codigo === "token_invalido" ? llave : undefined, campos: Object.keys(datos), recibido });
}
