import { Apple, ClipboardList, Coffee, Cookie, Martini, Moon, UtensilsCrossed } from "lucide-react";

const ICONOS = { desayuno: Coffee, almuerzo: UtensilsCrossed, merienda: Cookie, cena: Moon, colacion: Apple, fiesta: Martini, resumen: ClipboardList };

export default function IconoComida({ tipo, size = 20 }) {
  const Icono = ICONOS[tipo] || UtensilsCrossed;
  return <Icono size={size} aria-hidden="true" />;
}
