// Crear grupos, pedir entrar y lo que hace quien administra. Todo pasa por funciones de la base.
import { supabase } from "./supabase.js";

const ERRORES = {
  codigo_invalido: "Ese código no es de ningún grupo.",
  demasiados_pedidos: "Ya tenés 5 pedidos esperando. Esperá a que te respondan.",
  grupo_sin_admin: "Ese grupo no tiene quien acepte pedidos.",
  nombre_invalido: "El nombre lleva de 2 a 40 letras.",
  demasiados_grupos: "Ya creaste 3 grupos hoy. Probá mañana.",
  no_sos_admin: "Solo quien administra el grupo puede hacer eso.",
  sin_pedido: "Ese pedido ya se respondió.",
};

export function textoError(error, porDefecto = "No se pudo. Probá de nuevo.") {
  const clave = Object.keys(ERRORES).find((k) => error?.message?.includes(k));
  return clave ? ERRORES[clave] : porDefecto;
}

// Sin el SQL 046 la función no existe todavía: se entra como antes.
const faltaFuncion = (error) => /could not find the function|does not exist|PGRST202/i.test(`${error?.message || ""} ${error?.code || ""}`);

// Devuelve { estado: "pendiente" | "ya_estas" | "adentro", nombre } o tira el error con el texto para mostrar.
export async function pedirEntrar(codigo) {
  const { data, error } = await supabase.rpc("pedir_entrar_a_grupo", { p_codigo: codigo.trim() });
  if (!error) return data;
  if (faltaFuncion(error)) {
    const viejo = await supabase.rpc("unirme_a_grupo", { p_codigo: codigo.trim() });
    if (viejo.error) throw new Error(textoError(viejo.error, "No se pudo entrar. Probá de nuevo."));
    return { estado: "adentro", nombre: viejo.data };
  }
  throw new Error(textoError(error, "No se pudo mandar el pedido. Probá de nuevo."));
}

export async function crearGrupo(nombre) {
  const { data, error } = await supabase.rpc("crear_grupo", { p_nombre: nombre.trim() });
  if (error) throw new Error(faltaFuncion(error) ? "Todavía no se pueden crear grupos." : textoError(error, "No se pudo crear el grupo. Probá de nuevo."));
  return data;
}

export async function misPedidos() {
  const { data, error } = await supabase.rpc("mis_solicitudes");
  return error ? [] : data || [];
}

export async function cancelarPedido(grupoId) {
  const { error } = await supabase.rpc("cancelar_solicitud", { p_grupo: grupoId });
  return !error;
}

export async function gruposQueAdministro() {
  const { data, error } = await supabase.rpc("grupos_que_administro");
  return error ? [] : data || [];
}

export async function pedidosPendientes() {
  const { data, error } = await supabase.rpc("pedidos_pendientes");
  return error ? 0 : data || 0;
}

// Para avisar al resto de la app que cambió algo (el puntito de Ajustes).
export const EVENTO_PEDIDOS = "lomada:pedidos-grupo";

// Mandar el código por WhatsApp o donde sea; si no se puede, se copia.
export async function compartirCodigo(nombre, codigo) {
  const texto = `Sumate a "${nombre}" en Lomada Fuel: ${window.location.origin}\nCódigo del grupo: ${codigo}`;
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return "compartido";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelado";
    }
  }
  try {
    await navigator.clipboard.writeText(codigo);
    return "copiado";
  } catch {
    return "nada";
  }
}
