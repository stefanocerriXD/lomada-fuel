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

// Comidas sueltas de Apple Salud (MyFitnessPal escribe una entrada por comida, con su hora).
// El Atajo manda, por cada dato, la lista de horas y la lista de valores en el mismo orden.
const LISTAS = [["kcal", "kcal"], ["p", "proteinas"], ["c", "carbos"], ["g", "grasas"]];
const MESES = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
const dos = (n) => String(n).padStart(2, "0");

export function aLista(valor) {
  if (valor === null || valor === undefined || valor === "") return [];
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "string") return valor.split(/\n+/).map((v) => v.trim()).filter(Boolean);
  return [valor];
}

// Una fecha de Atajos ("2026-11-12T13:10:00-03:00", "12/11/2026, 13:10", "12 nov 2026 1:10 p. m.", "hoy 13:10")
// pasa a hora argentina al minuto. Sin día, es el día que mandó el Atajo.
export function aMomento(valor, fechaBase) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (iso) {
    const conZona = /(?:Z|[+-]\d{2}:?\d{2})$/.test(texto);
    const fecha = new Date(conZona ? texto : `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:00-03:00`);
    if (Number.isNaN(fecha.getTime())) return null;
    const local = new Date(fecha.getTime() - 3 * 3600000).toISOString();
    return `${local.slice(0, 16)}:00-03:00`;
  }
  const hora = texto.match(/(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([ap])?\.?\s*(?:m\.?)?/i);
  if (!hora) return null;
  let h = Number(hora[1]);
  if (hora[3]?.toLowerCase() === "p" && h < 12) h += 12;
  if (hora[3]?.toLowerCase() === "a" && h === 12) h = 0;
  if (h > 23 || Number(hora[2]) > 59) return null;
  let [a, m, d] = fechaBase.split("-").map(Number);
  const barras = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  const conMes = texto.match(/(\d{1,2})(?:\s+de)?\s+([a-zA-Z]{3})[a-zA-Z]*\.?(?:\s+de)?,?\s+(\d{4})/);
  const ingles = texto.match(/([a-zA-Z]{3})[a-zA-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (barras) [d, m, a] = [Number(barras[1]), Number(barras[2]), Number(barras[3]) < 100 ? 2000 + Number(barras[3]) : Number(barras[3])];
  else if (conMes && MESES[conMes[2].toLowerCase()]) [d, m, a] = [Number(conMes[1]), MESES[conMes[2].toLowerCase()], Number(conMes[3])];
  else if (ingles && MESES[ingles[1].toLowerCase()]) [d, m, a] = [Number(ingles[2]), MESES[ingles[1].toLowerCase()], Number(ingles[3])];
  else if (/\b(ayer|yesterday)\b/i.test(texto)) {
    const ayer = new Date(Date.UTC(a, m - 1, d - 1));
    [a, m, d] = [ayer.getUTCFullYear(), ayer.getUTCMonth() + 1, ayer.getUTCDate()];
  }
  return `${a}-${dos(m)}-${dos(d)}T${dos(h)}:${hora[2]}:00-03:00`;
}

// Junta por minuto lo que llegó de cada lista: una entrada por comida con sus calorías y macros.
export function comidasDeSalud(datos, fechaBase) {
  const porMinuto = new Map();
  for (const [clave, nombre] of LISTAS) {
    const horas = aLista(datos[`${nombre}_horas`]);
    const valores = aLista(datos[`${nombre}_valores`]);
    for (let i = 0; i < Math.min(horas.length, valores.length); i++) {
      const momento = aMomento(horas[i], fechaBase);
      const valor = aNumero(valores[i]);
      if (!momento || valor === null) continue;
      const entrada = porMinuto.get(momento) || { momento, kcal: 0, p: 0, c: 0, g: 0 };
      entrada[clave] += valor;
      porMinuto.set(momento, entrada);
    }
  }
  return [...porMinuto.values()].slice(0, 80);
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

  if (resp.ok) {
    // Las comidas sueltas son un extra: si fallan, el total del día ya quedó guardado.
    const entradas = comidasDeSalud(datos, fecha);
    let comidas;
    if (entradas.length) {
      const r = await fetch(`${url}/rest/v1/rpc/registrar_comidas_salud`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: clave },
        body: JSON.stringify({ p_token: String(datos.token || ""), p_entradas: entradas }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      comidas = r?.ok ? entradas.length : "no se pudieron guardar";
      if (!r?.ok) console.error("Comidas de Apple Salud:", r && (await r.text().catch(() => r.status)));
    }
    return res.status(200).json({ ok: true, fecha, guardado: valores, ...(comidas !== undefined ? { comidas } : {}) });
  }
  const cuerpo = await resp.json().catch(() => ({}));
  const codigo = Object.keys(ERRORES).find((c) => cuerpo.message?.includes(c));
  if (!codigo) console.error("Apple Salud no se pudo guardar:", cuerpo);
  // Nunca se devuelve la llave: solo si llegó y cuánto mide, para detectar un error al pegarla.
  const llave = typeof datos.token === "string" && datos.token ? `${datos.token.length} caracteres` : "no llegó";
  return res.status(ERRORES[codigo] || 502).json({ error: codigo || "No se pudo guardar", detalle: codigo ? undefined : `${cuerpo.code || resp.status}: ${cuerpo.message || ""}`.slice(0, 200), llave: codigo === "token_invalido" ? llave : undefined, campos: Object.keys(datos), recibido });
}
