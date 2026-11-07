import {
  Beef, Bomb, Camera, Candy, CupSoda, Droplets, Dumbbell, Flame, Leaf, Moon, Pizza, Repeat, Scale, Soup, Sparkles,
  Sunrise, Target, Trophy, Utensils, UtensilsCrossed, Wine, Crown,
} from "lucide-react";
import { calcularPlan } from "./cuerpo.js";
import { desafioTerminado, puntajes } from "./desafios.js";
import { aFecha, fechaLocal } from "./fechas.js";
import { comidasFavoritas } from "./perfil.js";

const logro = (codigo, grupo, icono, unidad, niveles) => ({
  codigo,
  grupo,
  icono,
  unidad,
  niveles: niveles.map(([meta, nombre]) => ({ meta, nombre })),
});

// Cada logro tiene cinco niveles: cuanto más lejos llegás, mejor es el título.
export const LOGROS = [
  logro("comidas", "objetivos", Utensils, "comidas", [[1, "Primer plato"], [30, "Bien documentado"], [100, "Registrador"], [300, "Archivista"], [1000, "Historiador de la comida"]]),
  logro("racha", "objetivos", Flame, "días seguidos", [[7, "Semana completa"], [14, "Quincena firme"], [30, "Mes imparable"], [90, "Trimestre de hierro"], [365, "Un año sin fallar"]]),
  logro("proteina", "objetivos", Dumbbell, "días con tu proteína", [[7, "Modo proteína"], [20, "Proteico"], [50, "Constructor"], [120, "Bestia proteica"], [300, "Hecho de proteína"]]),
  logro("agua", "objetivos", Droplets, "días con 2 litros", [[7, "Bien hidratado"], [20, "Camello"], [50, "Manantial"], [120, "Río"], [300, "Océano"]]),
  logro("reto", "objetivos", Trophy, "retos ganados", [[1, "Primera victoria"], [3, "Campeón"], [5, "Multicampeón"], [10, "Dinastía"], [25, "Leyenda del grupo"]]),
  logro("peso", "objetivos", Target, "kg hacia tu objetivo", [[1, "Primer kilo"], [3, "Buen ritmo"], [5, "Cambio real"], [10, "Transformación"], [20, "Otra persona"]]),
  logro("fotogenico", "objetivos", Sparkles, "reacciones recibidas", [[5, "Fotogénico"], [25, "Popular"], [100, "Influencer"], [300, "Celebridad"], [1000, "Ícono del grupo"]]),

  logro("milanesa", "alimentacion", Crown, "milanesas", [[5, "Bebé de la milanesa"], [15, "Aprendiz de la milanesa"], [40, "Milanesero"], [100, "Maestro de la milanesa"], [250, "Rey de la milanesa"]]),
  logro("parrillero", "alimentacion", Beef, "asados", [[3, "Ayudante de parrilla"], [10, "Asador de domingo"], [30, "Parrillero"], [75, "Maestro parrillero"], [200, "Rey del asado"]]),
  logro("pizza", "alimentacion", Pizza, "pizzas", [[5, "Bebé de la pizza"], [15, "Fanático de la muzza"], [40, "Pizzero"], [100, "Maestro pizzero"], [250, "Rey de la pizza"]]),
  logro("empanadas", "alimentacion", UtensilsCrossed, "veces empanadas", [[5, "Bebé de la empanada"], [15, "Repulgue novato"], [40, "Empanadero"], [100, "Maestro del repulgue"], [250, "Rey de la empanada"]]),
  logro("pastas", "alimentacion", Soup, "platos de pasta", [[5, "Aprendiz de la pasta"], [15, "Amasador"], [40, "Nonno"], [100, "Nonno mayor"], [250, "Rey de la pasta"]]),
  logro("mate", "alimentacion", CupSoda, "mates", [[10, "Cebador novato"], [20, "Cebador principiante"], [50, "Cebador intermedio"], [100, "Cebador avanzado"], [300, "Rey del mate"]]),
  logro("ensalada", "alimentacion", Leaf, "ensaladas", [[7, "Conejo bebé"], [20, "Conejo"], [50, "Herbívoro"], [120, "Huerta andante"], [300, "Rey de la huerta"]]),
  logro("dulce", "alimentacion", Candy, "antojos dulces", [[5, "Golosito"], [15, "Diente dulce"], [40, "Goloso profesional"], [100, "Maestro del postre"], [250, "Rey del postre"]]),
  logro("madrugador", "alimentacion", Sunrise, "desayunos antes de las 8", [[5, "Madrugador novato"], [15, "Madrugador"], [40, "Tempranero"], [100, "Primero en levantarse"], [250, "Gallo oficial"]]),
  logro("heladera", "alimentacion", Moon, "comidas de madrugada", [[1, "Visita nocturna"], [5, "Ataque a la heladera"], [15, "Sonámbulo"], [40, "Fantasma de la cocina"], [100, "Rey de la heladera"]]),
  logro("bomba", "alimentacion", Bomb, "comidas de 1.500 kcal", [[1, "Petardo"], [5, "Bomba calórica"], [15, "Granada"], [40, "Misil"], [100, "Bomba nuclear"]]),
  logro("gordito", "alimentacion", Scale, "días 1.000 kcal arriba de tu meta", [[1, "Gordito novato"], [5, "Gordito en formación"], [15, "Gordito certificado"], [40, "Gordito profesional"], [100, "Gordito legendario"]]),
  logro("cuatro", "alimentacion", Wine, "días con las 4 comidas", [[1, "Cuatro de cuatro"], [7, "Ordenado"], [30, "Reloj suizo"], [90, "Metrónomo"], [300, "Máquina de registrar"]]),
  logro("fotografo", "alimentacion", Camera, "fotos", [[10, "Fotógrafo aficionado"], [50, "Fotógrafo gastronómico"], [150, "Foodie"], [400, "Crítico gastronómico"], [1000, "Leyenda de la foto"]]),
  logro("monotematico", "alimentacion", Repeat, "veces lo mismo", [[7, "Repetidor"], [15, "Monotemático"], [30, "Cabeza dura"], [75, "Fanático"], [200, "Una sola comida"]]),
];

export const nivelDe = (l, cantidad) => l.niveles.filter((n) => cantidad >= n.meta).length;

export function nombreDeCodigo(codigo) {
  const [id, nivel] = codigo.split(":");
  return LOGROS.find((l) => l.codigo === id)?.niveles[Number(nivel) - 1]?.nombre;
}

// El nivel más alto guardado de cada logro. Es lo que ven los demás en el perfil.
export function nivelesGuardados(codigos) {
  const niveles = {};
  for (const c of codigos) {
    const [id, nivel] = c.split(":");
    const n = Number(nivel);
    if (LOGROS.some((l) => l.codigo === id) && n > (niveles[id] || 0)) niveles[id] = n;
  }
  return niveles;
}

// Cada nivel de cada logro suma un punto. Los títulos generales cuestan cada vez más.
const RANGOS = [[0, "Novato"], [5, "Aprendiz"], [15, "Constante"], [30, "Experto"], [50, "Maestro"], [80, "Leyenda"], [110, "Inmortal"]];

export function nivelGeneral(niveles) {
  const puntos = Object.values(niveles).reduce((t, n) => t + n, 0);
  const i = RANGOS.filter(([p]) => puntos >= p).length - 1;
  const [desde, rango] = RANGOS[i];
  const proximo = RANGOS[i + 1];
  return {
    puntos,
    nivel: Math.max(puntos, 1),
    rango,
    siguiente: proximo ? { puntos: proximo[0], nombre: proximo[1] } : null,
    avance: proximo ? (puntos - desde) / (proximo[0] - desde) : 1,
  };
}

const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const textoDe = (c) => normal([c.descripcion, ...(c.alimentos || []).map((a) => a.nombre)].join(" "));

const ANTOJOS = {
  milanesa: /milanes|milanga/,
  parrillero: /\basado|vacio|chorip|parrill|entrana/,
  pizza: /pizza|fugazz/,
  empanadas: /empanada/,
  pastas: /fideo|noqui|raviol|sorrentino|tallarin|lasagn|canelon/,
  mate: /\bmates?\b/,
  ensalada: /ensalada/,
  dulce: /alfajor|factura|medialuna|chocotorta|helado|\btorta\b|\bflan\b|dulce de leche|brownie/,
};

// La hora solo vale si la comida se cargó en el momento, no si vino importada o de otro día.
const enVivo = (c) => !["importado", "foto"].includes(c.alimentos?.[0]?.fuente) && fechaLocal(new Date(c.creado_en)) === c.fecha;

export function mejorRacha(fechas) {
  const dias = [...new Set(fechas)].sort();
  let mejor = 0;
  let actual = 0;
  let previo = null;
  for (const d of dias) {
    const pegado = previo !== null && Math.round((aFecha(d) - aFecha(previo)) / 86400000) === 1;
    actual = pegado ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
    previo = d;
  }
  return mejor;
}

// Cuánto lleva la persona en cada logro.
export function cantidades({ usuarioId, comidas, agua, reacciones, perfiles, salud, pesos, victorias = 0 }) {
  const propias = comidas.filter((c) => c.usuario_id === usuarioId);
  const reales = propias.filter((c) => c.alimentos?.[0]?.fuente !== "foto");
  // Lo marcado como privado no da logros de comida, que después ve todo el grupo.
  const visibles = propias.filter((c) => !c.privada && c.tipo !== "resumen");
  const meta = perfiles[usuarioId]?.meta_calorias;

  const total = {
    comidas: reales.length,
    racha: mejorRacha(propias.map((c) => c.fecha)),
    proteina: 0,
    agua: agua.filter((a) => a.usuario_id === usuarioId && a.ml >= 2000).length,
    reto: victorias,
    peso: 0,
    fotogenico: 0,
  };

  if (salud) {
    const plan = calcularPlan(salud);
    const porDia = {};
    propias.forEach((c) => (porDia[c.fecha] = (porDia[c.fecha] || 0) + Number(c.proteinas || 0)));
    total.proteina = Object.values(porDia).filter((g) => g >= plan.proteinas).length;
    const inicial = Number(pesos[0]?.peso_kg ?? salud.peso_kg);
    const direccion = inicial >= Number(salud.peso_objetivo) ? 1 : -1;
    total.peso = Math.max(0, Math.floor((inicial - Number(salud.peso_kg)) * direccion));
  }

  const ids = new Set(propias.map((c) => c.id));
  total.fotogenico = reacciones.filter((r) => ids.has(r.comida_id)).length;

  for (const [codigo, re] of Object.entries(ANTOJOS)) total[codigo] = visibles.filter((c) => re.test(textoDe(c))).length;

  const horaDe = (c) => new Date(c.creado_en).getHours();
  const conHora = visibles.filter(enVivo);
  total.madrugador = conHora.filter((c) => c.tipo === "desayuno" && horaDe(c) >= 5 && horaDe(c) < 8).length;
  total.heladera = conHora.filter((c) => horaDe(c) < 5).length;
  total.bomba = visibles.filter((c) => Number(c.calorias) >= 1500).length;
  total.fotografo = visibles.filter((c) => c.foto_path).length;
  total.monotematico = comidasFavoritas(visibles, 1)[0]?.veces || 0;

  const dias = {};
  visibles.forEach((c) => {
    const d = (dias[c.fecha] ||= { kcal: 0, tipos: new Set() });
    d.kcal += Number(c.calorias) || 0;
    d.tipos.add(c.tipo);
  });
  total.cuatro = Object.values(dias).filter((d) => d.tipos.size === 4).length;
  total.gordito = meta > 0 ? Object.values(dias).filter((d) => d.kcal >= meta + 1000).length : 0;
  return total;
}

// Devuelve lo nuevo para guardar: retos ganados ("victoria:id") y niveles alcanzados ("mate:2").
export function medallasGanadas({ usuarioId, comidas, agua, reacciones, desafios, perfiles, salud, pesos, yaGanadas }) {
  const victoriasPrevias = yaGanadas.filter((c) => c.startsWith("victoria:"));
  const nuevasVictorias = desafios
    .filter((d) => {
      if (!desafioTerminado(d) || victoriasPrevias.includes(`victoria:${d.id}`)) return false;
      const [primero] = puntajes(d, perfiles, comidas, agua);
      return primero?.perfil.id === usuarioId && primero.puntos > 0;
    })
    .map((d) => `victoria:${d.id}`);

  const total = cantidades({ usuarioId, comidas, agua, reacciones, perfiles, salud, pesos, victorias: victoriasPrevias.length + nuevasVictorias.length });
  const guardados = nivelesGuardados(yaGanadas);
  const niveles = LOGROS.flatMap((l) => {
    const alcanzado = nivelDe(l, total[l.codigo] || 0);
    const desde = (guardados[l.codigo] || 0) + 1;
    return Array.from({ length: Math.max(0, alcanzado - desde + 1) }, (_, i) => `${l.codigo}:${desde + i}`);
  });
  return [...nuevasVictorias, ...niveles];
}
