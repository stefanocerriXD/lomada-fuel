// Contra la meta de cada macro: cuánto llena la barra y qué decir. Un 5 % arriba o abajo cuenta como "en la meta".
export function contraMeta(valor, meta) {
  if (!meta) return null;
  const v = Math.round(valor);
  const diferencia = v - Math.round(meta);
  const estado = Math.abs(diferencia) <= meta * 0.05 ? "justo" : diferencia < 0 ? "falta" : "pasado";
  const texto = estado === "justo" ? `En la meta (${Math.round(meta)} g)` : estado === "falta" ? `Faltaron ${Math.abs(diferencia)} g de ${Math.round(meta)} g` : `Te pasaste ${diferencia} g (meta ${Math.round(meta)} g)`;
  return { estado, texto, lleno: Math.min(100, Math.round((v / meta) * 100)), meta: Math.round(meta) };
}
