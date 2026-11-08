// Recibe los datos del Atajo del iPhone. Los Atajos pueden mandar valores como "1.650,5 kcal".
const ERRORES = { token_invalido: 401, fecha_invalida: 400, valores_invalidos: 400 };

const NUMERO = "\\d+(?:[.,]\\d+)*";
const CON_UNIDAD = new RegExp(`(${NUMERO})\\s*(?:k?cal|kj|g\\b)`, "i");
const SUELTO = new RegExp(NUMERO);

// Un Atajo manda números crudos ("2.595000028610229"), a veces con unidad, fecha o una lista de días: se toma un solo valor.
// Con un solo separador y tres cifras después son miles; si no, decimal. Con varios, el último es el decimal salvo que todos sean iguales ("1.234.567").
export function aNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (Array.isArray(valor)) return valor.length ? aNumero(valor[valor.length - 1]) : null;
  const original = String(valor);
  const texto = original.match(CON_UNIDAD)?.[1] ?? original.match(SUELTO)?.[0];
  if (!texto) return null;
  const separadores = texto.match(/[.,]/g) || [];
  let limpio = texto;
  if (separadores.length === 1) {
    // "1,650" o "1.650" son miles; "2.595000028610229" o "82,4" son decimales.
    const [entero, resto] = texto.split(/[.,]/);
    limpio = resto.length === 3 && entero.length <= 3 ? `${entero}${resto}` : `${entero}.${resto}`;
  } else if (separadores.length > 1) {
    const ultimo = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
    limpio = new Set(separadores).size === 1
      ? texto.replace(/[.,]/g, "")
      : `${texto.slice(0, ultimo).replace(/[.,]/g, "")}.${texto.slice(ultimo + 1)}`;
  }
  const numero = Number(limpio);
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

  if (resp.ok) return res.status(200).json({ ok: true, fecha, guardado: valores });
  const cuerpo = await resp.json().catch(() => ({}));
  const codigo = Object.keys(ERRORES).find((c) => cuerpo.message?.includes(c));
  if (!codigo) console.error("Apple Salud no se pudo guardar:", cuerpo);
  // Nunca se devuelve la llave: solo si llegó y cuánto mide, para detectar un error al pegarla.
  const llave = typeof datos.token === "string" && datos.token ? `${datos.token.length} caracteres` : "no llegó";
  return res.status(ERRORES[codigo] || 502).json({ error: codigo || "No se pudo guardar", detalle: codigo ? undefined : `${cuerpo.code || resp.status}: ${cuerpo.message || ""}`.slice(0, 200), llave: codigo === "token_invalido" ? llave : undefined, campos: Object.keys(datos), recibido });
}
