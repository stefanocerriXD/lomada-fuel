import {
  Beef, BookOpen, Bomb, Camera, Candy, Crown, Droplets, Dumbbell, Flame, Leaf, Mountain, Moon, Pizza, Repeat, Scale, Soup,
  Sparkles, Sunrise, Target, Trophy, Utensils, UtensilsCrossed, Wine, CupSoda,
} from "lucide-react";
import { calcularPlan } from "./cuerpo.js";
import { desafioTerminado, puntajes } from "./desafios.js";
import { fechaLocal } from "./fechas.js";
import { calcularRacha } from "./macros.js";
import { comidasFavoritas } from "./perfil.js";

export const MEDALLAS = [
  { codigo: "primera_comida", grupo: "objetivos", icono: Utensils, nombre: "Primer plato", detalle: "Subiste tu primera comida" },
  { codigo: "racha_7", grupo: "objetivos", icono: Flame, nombre: "Semana completa", detalle: "7 días seguidos cargando" },
  { codigo: "racha_30", grupo: "objetivos", icono: Mountain, nombre: "Mes imparable", detalle: "30 días seguidos cargando" },
  { codigo: "comidas_30", grupo: "objetivos", icono: BookOpen, nombre: "Bien documentado", detalle: "30 comidas en un mes" },
  { codigo: "proteina_7", grupo: "objetivos", icono: Dumbbell, nombre: "Modo proteína", detalle: "7 días llegando a tu proteína" },
  { codigo: "agua_7", grupo: "objetivos", icono: Droplets, nombre: "Bien hidratado", detalle: "7 días con 2 litros de agua" },
  { codigo: "gano_desafio", grupo: "objetivos", icono: Trophy, nombre: "Campeón", detalle: "Ganaste un desafío" },
  { codigo: "objetivo", grupo: "objetivos", icono: Target, nombre: "Objetivo cumplido", detalle: "Llegaste a tu peso objetivo" },
  { codigo: "fotogenico", grupo: "objetivos", icono: Sparkles, nombre: "Fotogénico", detalle: "Una comida con 5 reacciones" },

  { codigo: "milanesa", grupo: "alimentacion", icono: Crown, nombre: "Rey de la milanesa", detalle: "5 milanesas en un mes" },
  { codigo: "parrillero", grupo: "alimentacion", icono: Beef, nombre: "Parrillero", detalle: "3 asados en un mes" },
  { codigo: "pizza", grupo: "alimentacion", icono: Pizza, nombre: "Pizza party", detalle: "5 pizzas en un mes" },
  { codigo: "empanadas", grupo: "alimentacion", icono: UtensilsCrossed, nombre: "Empanadero", detalle: "5 veces empanadas" },
  { codigo: "pastas", grupo: "alimentacion", icono: Soup, nombre: "Nonno", detalle: "5 platos de pasta" },
  { codigo: "mate", grupo: "alimentacion", icono: CupSoda, nombre: "Cebador oficial", detalle: "10 mates registrados" },
  { codigo: "ensalada", grupo: "alimentacion", icono: Leaf, nombre: "Conejo", detalle: "7 ensaladas en un mes" },
  { codigo: "dulce", grupo: "alimentacion", icono: Candy, nombre: "Diente dulce", detalle: "5 antojos dulces" },
  { codigo: "madrugador", grupo: "alimentacion", icono: Sunrise, nombre: "Madrugador", detalle: "5 desayunos antes de las 8" },
  { codigo: "heladera", grupo: "alimentacion", icono: Moon, nombre: "Ataque a la heladera", detalle: "Comiste entre las 0 y las 5" },
  { codigo: "bomba", grupo: "alimentacion", icono: Bomb, nombre: "Bomba calórica", detalle: "Una comida de 1.500 kcal" },
  { codigo: "gordito", grupo: "alimentacion", icono: Scale, nombre: "Gordito certificado", detalle: "1.000 kcal arriba de tu meta" },
  { codigo: "cuatro", grupo: "alimentacion", icono: Wine, nombre: "Cuatro de cuatro", detalle: "Las 4 comidas en un día" },
  { codigo: "fotografo", grupo: "alimentacion", icono: Camera, nombre: "Fotógrafo gastronómico", detalle: "20 fotos en un mes" },
  { codigo: "monotematico", grupo: "alimentacion", icono: Repeat, nombre: "Monotemático", detalle: "Lo mismo 7 veces" },
];

export const medalla = (codigo) => MEDALLAS.find((m) => m.codigo === codigo);

const normal = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const textoDe = (c) => normal([c.descripcion, ...(c.alimentos || []).map((a) => a.nombre)].join(" "));

const ANTOJOS = [
  ["milanesa", /milanes|milanga/, 5],
  ["parrillero", /\basado|vacio|chorip|parrill|entrana/, 3],
  ["pizza", /pizza|fugazz/, 5],
  ["empanadas", /empanada/, 5],
  ["pastas", /fideo|noqui|raviol|sorrentino|tallarin|lasagn|canelon/, 5],
  ["mate", /\bmates?\b/, 10],
  ["ensalada", /ensalada/, 7],
  ["dulce", /alfajor|factura|medialuna|chocotorta|helado|\btorta\b|\bflan\b|dulce de leche|brownie/, 5],
];

// La hora solo vale si la comida se cargó en el momento, no si vino importada o de otro día.
const enVivo = (c) => !["importado", "foto"].includes(c.alimentos?.[0]?.fuente) && fechaLocal(new Date(c.creado_en)) === c.fecha;

// Lo marcado como privado no da logros que después ve el grupo.
function logrosDivertidos(propias, meta) {
  const visibles = propias.filter((c) => !c.privada && c.tipo !== "resumen");
  const ganados = ANTOJOS.filter(([, re, cuantas]) => visibles.filter((c) => re.test(textoDe(c))).length >= cuantas).map(([codigo]) => codigo);
  const sumar = (codigo, condicion) => condicion && ganados.push(codigo);

  const horaDe = (c) => new Date(c.creado_en).getHours();
  const conHora = visibles.filter(enVivo);
  sumar("madrugador", conHora.filter((c) => c.tipo === "desayuno" && horaDe(c) >= 5 && horaDe(c) < 8).length >= 5);
  sumar("heladera", conHora.some((c) => horaDe(c) < 5));
  sumar("bomba", visibles.some((c) => Number(c.calorias) >= 1500));
  sumar("fotografo", visibles.filter((c) => c.foto_path).length >= 20);
  sumar("monotematico", (comidasFavoritas(visibles, 1)[0]?.veces || 0) >= 7);

  const porDia = {};
  visibles.forEach((c) => {
    const d = (porDia[c.fecha] ||= { kcal: 0, tipos: new Set() });
    d.kcal += Number(c.calorias) || 0;
    d.tipos.add(c.tipo);
  });
  sumar("cuatro", Object.values(porDia).some((d) => d.tipos.size === 4));
  sumar("gordito", meta > 0 && Object.values(porDia).some((d) => d.kcal >= meta + 1000));
  return ganados;
}

// Devuelve los códigos que la persona acaba de ganar.
export function medallasGanadas({ usuarioId, comidas, agua, reacciones, desafios, perfiles, salud, pesos, yaGanadas }) {
  const propias = comidas.filter((c) => c.usuario_id === usuarioId);
  const racha = calcularRacha(propias.map((c) => c.fecha));
  const ganadas = [];
  const sumar = (codigo, condicion) => condicion && ganadas.push(codigo);

  sumar("primera_comida", propias.length >= 1);
  sumar("racha_7", racha >= 7);
  sumar("racha_30", racha >= 30);
  sumar("comidas_30", propias.length >= 30);
  sumar("agua_7", agua.filter((a) => a.usuario_id === usuarioId && a.ml >= 2000).length >= 7);

  if (salud) {
    const plan = calcularPlan(salud);
    const porDia = {};
    propias.forEach((c) => (porDia[c.fecha] = (porDia[c.fecha] || 0) + Number(c.proteinas || 0)));
    sumar("proteina_7", Object.values(porDia).filter((g) => g >= plan.proteinas).length >= 7);
    const inicial = Number(pesos[0]?.peso_kg ?? salud.peso_kg);
    const objetivo = Number(salud.peso_objetivo);
    const actual = Number(salud.peso_kg);
    sumar("objetivo", pesos.length >= 2 && Math.abs(inicial - objetivo) >= 0.5 && (inicial > objetivo ? actual <= objetivo : actual >= objetivo));
  }

  const conteo = {};
  reacciones.forEach((r) => (conteo[r.comida_id] = (conteo[r.comida_id] || 0) + 1));
  sumar("fotogenico", propias.some((c) => (conteo[c.id] || 0) >= 5));

  sumar("gano_desafio", desafios.some((d) => {
    if (!desafioTerminado(d)) return false;
    const [primero] = puntajes(d, perfiles, comidas, agua);
    return primero?.perfil.id === usuarioId && primero.puntos > 0;
  }));

  ganadas.push(...logrosDivertidos(propias, perfiles[usuarioId]?.meta_calorias));
  return ganadas.filter((c) => !yaGanadas.includes(c));
}
