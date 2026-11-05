// Siempre fecha local: con UTC, una cena después de las 21 h quedaría en el día siguiente.
export function fechaLocal(d = new Date()) {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function haceDias(n, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return fechaLocal(d);
}

export const aFecha = (texto) => new Date(`${texto}T12:00:00`);

export function ultimosDias(n) {
  return Array.from({ length: n }, (_, i) => haceDias(n - 1 - i));
}

export function nombreDia(texto) {
  if (texto === fechaLocal()) return "Hoy";
  if (texto === haceDias(1)) return "Ayer";
  return aFecha(texto).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export function diaCorto(texto) {
  return aFecha(texto).toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
}

export function hora(iso) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function haceCuanto(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return nombreDia(fechaLocal(new Date(iso)));
}

export function saludo() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buen día";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function tipoSegunHora() {
  const h = new Date().getHours();
  if (h < 11) return "desayuno";
  if (h < 16) return "almuerzo";
  if (h < 20) return "merienda";
  return "cena";
}
